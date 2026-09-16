/**
 * Reusable agent loop: drives a model + tool registry until the model stops
 * requesting tools or the step budget is exhausted. Handles tool calls,
 * prunes tool output (cache-aware), and compacts history when needed.
 *
 * Adaptive fallback: if the provider rejects a model call (rate-limit / quota
 * / transient 5xx), the loop asks the caller for the next-best model and
 * retries before giving up. Successes and failures are reported back so the
 * adaptive ranker can learn which models actually work.
 */

import type { ChatMessage, ToolResult } from "../types.js";
import type { LlmError, ChatOptions, ChatCompletion, OpenRouterClient } from "../models/provider.js";
import { LlmErrorImpl } from "../models/provider.js";

/** Minimal chat surface — satisfied by OpenRouterClient and any ProviderClient. */
export interface ChatClient {
  complete(opts: ChatOptions): Promise<ChatCompletion>;
  completeStreamed(opts: ChatOptions): Promise<ChatCompletion>;
}
import type { ToolRegistry, ToolCallCtx } from "./toolRegistry.js";
import { pruneToolResult, maybeCompact, estimateTokens } from "../models/context.js";
import { isFreeQuotaError } from "../models/catalog.js";

export interface LoopResult {
  content: string;
  messages: ChatMessage[];
  steps: number;
  toolCalls: number;
}

export interface FallbackDecision {
  model: string;
  free: boolean;
  /** When the next model lives on another provider, switch clients too. */
  client?: ChatClient;
}

export interface AgentLoopOptions {
  client: ChatClient;
  registry: ToolRegistry;
  toolCtx: ToolCallCtx;
  /** System messages (the stable prefix). */
  system: ChatMessage[];
  /** Initial user task + any accumulated context. */
  seed: ChatMessage[];
  model: string;
  free: boolean;
  apiKey: string;
  /** OpenRouter-compatible tool descriptors. */
  tools: unknown[];
  maxSteps?: number;
  maxHistoryTokens?: number;
  onModelEmit?: (text: string) => void;
  onToken?: (delta: string) => void;
  /** Next candidate after a retryable failure; null/undefined = give up. */
  nextModel?: () => FallbackDecision | null;
  /** Called when the working model succeeds, so the ranker can learn. */
  onModelSuccess?: (model: string) => void;
  /** Called when a model fails retryably (before switching). */
  onModelError?: (model: string, kind: "transient" | "quota" | "auth") => void;
}

export async function runAgentLoop(opts: AgentLoopOptions): Promise<LoopResult> {
  const maxSteps = opts.maxSteps ?? 40;
  const maxHistoryTokens = opts.maxHistoryTokens ?? 120000;

  const messages: ChatMessage[] = [...opts.system, ...opts.seed];
  let steps = 0;
  let toolCalls = 0;
  let content = "";
  let model = opts.model;
  let client: ChatClient = opts.client;

  const complete = async (m: string): Promise<ReturnType<OpenRouterClient["complete"]>> => {
    // Si hay onToken, usa streaming para UX tipo OpenCode
    if (opts.onToken) {
      return client.completeStreamed({
        apiKey: opts.apiKey,
        model: m,
        messages,
        temperature: 0.2,
        tool_choice: "auto",
        tools: opts.tools,
        onToken: opts.onToken,
      });
    }
    return client.complete({
      apiKey: opts.apiKey,
      model: m,
      messages,
      temperature: 0.2,
      tool_choice: "auto",
      tools: opts.tools,
    });
  };

// Guarda último error para mensaje final útil
    let lastError: unknown = null;
    // Cortafuegos: si rotamos demasiados modelos sin un solo step, aborta con
    // el último error en vez de ciclar eternamente.
    let switches = 0;
  for (;;) {
    // Compaction before each call (keeps system prefix stable).
    const c = maybeCompact(messages, opts.system, maxHistoryTokens);
    if (c.compacted) messages.splice(0, messages.length, ...c.messages);

    let resp;
    try {
      resp = await complete(model);
      lastError = null;
    } catch (e) {
      lastError = e;
      const err = e as LlmError;
      if (process.env.NOIRA_DEBUG_ROTATION) {
        console.error(`[rotacion] intento con ${model} fallo: ${String((err as Error)?.message ?? err).slice(0, 120)}`);
      }
      if (++switches > 25) {
        const boom = new LlmErrorImpl(
          `rotación agotada tras ${switches} cambios de modelo. Último error: ${err instanceof Error ? err.message : String(err)}`.slice(0, 300),
          { status: (err as LlmError)?.status },
        );
        throw boom;
      }
      if (isAuthError(err)) {
        // Clave del provider muerta/inválida (401 "User not found", "invalid api
        // key"...): avisa como "auth" para que el orquestador descarte el
        // provider entero y rote a otro con clave válida.
        opts.onModelError?.(model, "auth");
        const next = opts.nextModel?.();
        if (next) {
          model = next.model;
          if (next.client) client = next.client;
          continue;
        }
      } else if (isFreeQuotaError(err)) {
        opts.onModelError?.(model, "quota");
        const next = opts.nextModel?.();
        if (next) {
          model = next.model;
          if (next.client) client = next.client;
          continue;
        }
      } else if (isRoutingError(err)) {
        // Modelo no soporta herramientas en este provider (404 de OpenRouter
        // "No endpoints found that support tool use"): cambia de modelo.
        opts.onModelError?.(model, "transient");
        const next = opts.nextModel?.();
        if (next) {
          model = next.model;
          if (next.client) client = next.client;
          continue;
        }
      } else if (err?.retryable) {
        opts.onModelError?.(model, "transient");
        const next = opts.nextModel?.();
        if (next) {
          model = next.model;
          if (next.client) client = next.client;
          continue;
        }
      }
      // Si no hay next model, espera 1s y reintenta mismo modelo 1 vez (transient)
      if ((err as any)?.retryable && !opts.nextModel) {
        await new Promise((r) => setTimeout(r, 1000));
        try {
          resp = await complete(model);
          lastError = null;
        } catch (e2) {
          throw e2;
        }
      } else {
        throw err;
      }
    }

    // Record which model actually produced this step as a success.
    opts.onModelSuccess?.(model);

    steps++;
    if (!resp.toolCalls || resp.toolCalls.length === 0) {
      content = resp.content ?? "";
      messages.push({ role: "assistant", content });
      return { content, messages, steps, toolCalls };
    }

    messages.push({
      role: "assistant",
      content: resp.content ?? "",
      tool_calls: resp.toolCalls,
    });

    const results: ToolResult[] = [];
    for (const tc of resp.toolCalls) {
      toolCalls++;
      const argsJson = tc.function?.arguments ?? "{}";
      try {
        const out = await opts.registry.execute(tc.function.name, argsJson, opts.toolCtx);
        results.push({ tool_call_id: tc.id, content: out });
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        results.push({ tool_call_id: tc.id, content: `[error] ${m}`, isError: true });
      }
    }
    for (const r of results) {
      const pruned = pruneToolResult(r);
      messages.push({
        role: "tool",
        tool_call_id: r.tool_call_id,
        content: pruned.content,
        name: "tool",
      });
    }
  }
}

export function historyTokens(messages: ChatMessage[]): number {
  return estimateTokens(messages);
}

/**
 * True when the model failed because it cannot do tool-calls (OpenRouter 404
 * "No endpoints found that support tool use", or similar routing/support
 * rejections). These are retryable by switching to another model candidate.
 */
export function isRoutingError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /no endpoints found that support tool use|provider routing|does not support tool|unsupported tool|tool calling.{0,40}not supported|not supported with this model|does not support chat completions|requires terms acceptance|tools? (are|is) not supported|does not support (tool|function) call/i.test(msg);
}

/**
 * True when the provider key is dead/invalid (401 "User not found",
 * "invalid api key", "incorrect api key"...). Retryable ONLY by switching to
 * a model from a DIFFERENT provider with a valid key.
 */
export function isAuthError(err: unknown): boolean {
  const e = err as { status?: number; message?: string };
  if (e?.status === 401 || e?.status === 403) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /user not found|invalid api key|incorrect api key|unauthorized|invalid_api_key|authentication/i.test(msg);
}
