/**
 * Core LLM client for OpenRouter chat completions.
 *
 * Pure fetch, no SDK. Supports streaming (SSE) and non-streaming. Exposes a
 * minimal, agent-oriented surface. The router layer feeds the model name and
 * the context layer feeds serialized system+history.
 */

import type { ChatMessage, ModelInfo } from "../types.js";

export interface ChatOptions {
  /** Base URL of the OpenAI-compatible endpoint. */
  baseURL?: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Optional upper bound on the prompt price the caller is prepared to pay. */
  maxPrice?: number;
  /** Optional model metadata so we can enforce free-only when needed. */
  modelInfo?: ModelInfo;
  /** OpenAI-compatible tool_choice ("auto" | "none" | object). */
  tool_choice?: unknown;
  /** OpenAI-compatible tools definitions. */
  tools?: unknown[];
  onToken?: (delta: string) => void;
  signal?: AbortSignal;
  httpReferer?: string;
  appTitle?: string;
}

export interface ChatCompletion {
  id: string;
  content: string;
  finishReason: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  /** Parsed tool calls, if any. */
  toolCalls?: NonNullable<ChatMessage["tool_calls"]>;
  model: string;
}

export interface LlmError extends Error {
  status?: number;
  body?: unknown;
  /** OpenRouter error code, if attached (e.g. 402 for free-tier rate limit). */
  openRouterCode?: number;
  retryable: boolean;
}

export class LlmErrorImpl extends Error implements LlmError {
  status?: number;
  body?: unknown;
  openRouterCode?: number;
  retryable: boolean;
  constructor(message: string, opts: { status?: number; body?: unknown; openRouterCode?: number; retryable?: boolean } = {}) {
    super(message);
    this.name = "LlmError";
    this.status = opts.status;
    this.body = opts.body;
    this.openRouterCode = opts.openRouterCode;
    this.retryable = opts.retryable ?? false;
  }
}

const DEFAULT_BASE = "https://openrouter.ai/api/v1";

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 408 || status === 409 || status >= 500;
}

export class OpenRouterClient {
  private baseURL: string;
  private apiKey: string;
  private httpReferer: string;
  private appTitle: string;

  constructor(opts: { apiKey: string; baseURL?: string; httpReferer?: string; appTitle?: string }) {
    this.baseURL = (opts.baseURL ?? DEFAULT_BASE).replace(/\/$/, "");
    this.apiKey = opts.apiKey;
    this.httpReferer = opts.httpReferer ?? "https://noiracoder.noira";
    this.appTitle = opts.appTitle ?? "NoiraCoder";
  }

  get base(): string {
    return this.baseURL;
  }

  private async request(path: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    const combinedSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    try {
      const res = await fetch(`${this.baseURL}${path}`, {
        ...init,
        signal: combinedSignal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": this.httpReferer ?? "",
          "X-Title": this.appTitle ?? "",
          ...((init.headers as Record<string, string>) ?? {}),
        },
      });
      return res;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async parseError(res: Response): Promise<LlmErrorImpl> {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text().catch(() => undefined);
    }
    const raw = (body as any)?.error as any;
    const status = res.status;
    const openRouterCode = Number(raw?.code ?? NaN);
    const message =
      (typeof raw?.message === "string" && raw.message) ||
      (typeof raw === "string" && raw) ||
      `HTTP ${status}`;
    return new LlmErrorImpl(message, {
      status,
      body,
      openRouterCode: Number.isNaN(openRouterCode) ? undefined : openRouterCode,
      retryable: isRetryableStatus(status),
    });
  }

  async complete(opts: ChatOptions): Promise<ChatCompletion> {
    const body: Record<string, unknown> = {
      model: opts.model,
      messages: opts.messages.map(sanitizeMessage),
      temperature: opts.temperature ?? 0.3,
      stream: false,
    };
    if (opts.maxTokens) body.max_tokens = opts.maxTokens;
    if (opts.maxPrice !== undefined) body.max_price = opts.maxPrice;
    if (opts.tool_choice !== undefined) body.tool_choice = opts.tool_choice;
    if (opts.tools !== undefined) body.tools = opts.tools;

    // Retry con backoff para 429/5xx (1s, 2s) — como hacen los #1
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await this.request("/chat/completions", { method: "POST", body: JSON.stringify(body) }, opts.signal);
      if (res.ok) {
        const data = (await res.json()) as any;
        const choice = data.choices?.[0];
        const message = choice?.message ?? {};
        return {
          id: data.id ?? "",
          content: message.content ?? "",
          finishReason: choice?.finish_reason ?? "",
          usage: data.usage ? { promptTokens: data.usage.prompt_tokens ?? 0, completionTokens: data.usage.completion_tokens ?? 0, totalTokens: data.usage.total_tokens ?? 0 } : undefined,
          toolCalls: message.tool_calls,
          model: data.model ?? opts.model,
        };
      }
      const err = await this.parseError(res);
      lastErr = err;
      if (!err.retryable || attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
    throw lastErr as Error;
  }

  async completeStreamed(opts: ChatOptions): Promise<ChatCompletion> {
    const body: Record<string, unknown> = {
      model: opts.model,
      messages: opts.messages.map(sanitizeMessage),
      temperature: opts.temperature ?? 0.3,
      stream: true,
    };
    if (opts.maxTokens) body.max_tokens = opts.maxTokens;
    if (opts.maxPrice !== undefined) body.max_price = opts.maxPrice;
    if (opts.tool_choice !== undefined) body.tool_choice = opts.tool_choice;
    if (opts.tools !== undefined) body.tools = opts.tools;

    const res = await this.request("/chat/completions", { method: "POST", body: JSON.stringify(body) }, opts.signal);
    if (!res.ok) throw await this.parseError(res);

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/event-stream")) {
      // A non-streaming JSON response in a streaming request is rare, but handle it.
      const data = (await res.json()) as any;
      const choice = data.choices?.[0];
      const message = choice?.message ?? {};
      return {
        id: data.id ?? "",
        content: message.content ?? "",
        finishReason: choice?.finish_reason ?? "",
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens ?? 0,
              completionTokens: data.usage.completion_tokens ?? 0,
              totalTokens: data.usage.total_tokens ?? 0,
            }
          : undefined,
        toolCalls: message.tool_calls,
        model: data.model ?? opts.model,
      };
    }

    return this.consumeSse(res, opts.onToken);
  }

  private async consumeSse(res: Response, onToken?: (d: string) => void): Promise<ChatCompletion> {
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buffer = "";
    let content = "";
    let finishReason = "";
    let usage: ChatCompletion["usage"];
    let toolCalls: NonNullable<ChatMessage["tool_calls"]> | undefined;
    let id = "";
    let model = "";

    // Sin timeout de inactividad, un stream que se queda mudo (red o modelo
    // colgado a mitad de respuesta) deja al agente esperando PARA SIEMPRE
    // sin mostrar nada. 90s sin ningún chunk = error claro y reintentable.
    const IDLE_MS = 90_000;
    const readWithIdleTimeout = async (): Promise<{ done: boolean; value?: Uint8Array }> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            // Orden crítico: rechazar PRIMERO (Promise.race toma el primer
            // settled; si cancelamos antes, el read resuelto gana y el
            // timeout quedaría en silencio). Luego se libera el reader.
            reject(
              new LlmErrorImpl(`stream detenido: 90s sin datos del modelo (red o modelo colgado).`, {
                retryable: true,
              }),
            );
            try { (reader.cancel("idle-timeout") as Promise<void>).catch(() => {}); } catch {}
          }, IDLE_MS);
        });
        const r = await Promise.race([reader.read(), timeout]);
        return { done: (r as { done: boolean }).done, value: (r as { value?: Uint8Array }).value };
      } finally {
        if (timer) clearTimeout(timer);
      }
    };

    const flushLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) return;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") return;
      let evt: any;
      try {
        evt = JSON.parse(payload);
      } catch {
        return;
      }
      if (evt.id) id = evt.id;
      if (evt.model) model = evt.model;
      const delta = evt.choices?.[0]?.delta;
      if (delta?.content) {
        content += delta.content;
        onToken?.(delta.content);
      }
      if (delta?.tool_calls) {
        if (!toolCalls) toolCalls = [];
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          while (toolCalls.length <= idx) {
            toolCalls.push({ id: "", type: "function", function: { name: "", arguments: "" } } as any);
          }
          const slot = toolCalls[idx];
          if (tc.id) slot.id = tc.id;
          if (tc.function?.name) slot.function.name += tc.function.name;
          if (tc.function?.arguments) slot.function.arguments += tc.function.arguments;
          slot.type = "function";
        }
      }
      const choice = evt.choices?.[0];
      if (choice?.finish_reason) finishReason = choice.finish_reason;
      if (evt.usage) {
        usage = {
          promptTokens: evt.usage.prompt_tokens,
          completionTokens: evt.usage.completion_tokens,
          totalTokens: evt.usage.total_tokens,
        };
      }
    };

    for (;;) {
      const { done, value } = await readWithIdleTimeout();
      if (done || !value) break;
      buffer += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        flushLine(line);
      }
    }
    if (buffer.trim()) flushLine(buffer);

    return { id, content, finishReason, usage, toolCalls, model };
  }

  /** Fetch the model catalog — tolerante a APIs no 100% OpenRouter (Groq envía {data}, otros {models}). */
  async listModels(): Promise<ModelInfo[]> {
    const res = await this.request("/models", { method: "GET" });
    if (!res.ok) throw await this.parseError(res);
    const data = (await res.json()) as any;
    const list = data.data ?? data.models ?? data ?? [];
    if (!Array.isArray(list)) return [];
    return list.map((m: any) => {
      const cl = Number(m.context_length);
      return {
        id: String(m.id ?? ""),
        name: m.name ?? m.id,
        // OpenRouter priced catalogs carry {"prompt","completion"}; others (Groq) don't.
        pricing: {
          prompt: String(m.pricing?.prompt ?? "0"),
          completion: String(m.pricing?.completion ?? "0"),
        },
        context_length: Number.isFinite(cl) && cl > 0 ? cl : 8192,
        free: m.free ?? false,
        // OpenRouter /models devuelve supported_parameters como ARRAY de strings
        // (["tools","temperature",...]). Los modelos gen (lyria, imagen/video)
        // NO incluyen "tools" y el router debe excluirlos.
        tools: Array.isArray(m.supported_parameters)
          ? m.supported_parameters.includes("tools")
          : (m.supported_parameters?.tools ?? true),
      };
    });
  }
}

function sanitizeMessage(m: ChatMessage): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  out.role = m.role;
  if (m.content) out.content = m.content;
  if (m.tool_call_id) out.tool_call_id = m.tool_call_id;
  if (m.name) out.name = m.name;
  if (m.tool_calls && m.tool_calls.length) out.tool_calls = m.tool_calls;
  return out;
}
