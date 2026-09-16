/**
 * Cache-aware context management.
 *
 * Two goals:
 *   1. Keep stable prefixes (identity + base rules + AGENTS.md memory) identical
 *      across calls so providers that support prompt caching (Anthropic,
 *      OpenRouter cache APIs, DeepSeek) hit their cache.
 *   2. Prune / compress tool output before it lands in history, instead of
 *      sending raw noisy dumps to the model.
 */

import type { ChatMessage, ToolResult } from "../types.js";
import { NOIRA_BASE_SYSTEM_PROMPT } from "../core/identity.js";

export interface MemoryBlock {
  /** Project memory from AGENTS.md, normalized. */
  agentsMd: string;
  /** Global preferences from ~/.noirarc/memory/global.md. */
  global?: string;
  /** Already-filtered, relevance-matched memory notes, serialized. */
  noteLines?: string[];
  /** Relevant skill instructions (SKILL.md), already selected. */
  skills: string[];
}

/**
 * Builds the cacheable system prefix. Call this ONCE per session and reuse the
 * returned array for every model call so the serialized prefix is byte-identical.
 * The base prompt + project memory are stable (cache-friendly); only the
 * relevance-filtered notes change as the task does.
 */
export function buildSystemPrefix(block: MemoryBlock): ChatMessage[] {
  const parts: string[] = [];
  parts.push(NOIRA_BASE_SYSTEM_PROMPT);
  if (block.global?.trim()) {
    parts.push(`\n# Preferencias globales (usuario)\n${block.global.trim()}\n`);
  }
  if (block.agentsMd.trim()) {
    parts.push(
      `\n# Memoria de proyecto (AGENTS.md)\n${block.agentsMd.trim()}\n`
    );
  }
  if (block.noteLines?.length) {
    parts.push(`\n# Notas relevantes de memoria\n${block.noteLines.join("\n")}\n`);
  }
  if (block.skills.length) {
    parts.push(`\n# Skills disponibles\n${block.skills.map((s) => s.trim()).join("\n\n")}\n`);
  }
  return [{ role: "system", content: parts.join("\n") }];
}

export interface PrunedToolResult extends ToolResult {
  /** true if content was truncated/compressed. */
  truncated: boolean;
}

const MAX_TOOL_OUTPUT_CHARS = 12000;
const HEAD_KEEP = 4500;
const TAIL_KEEP = 2000;

/**
 * Compresses a raw tool output. Keeps semantics (head + tail), drops the noisy
 * middle. Falls back gracefully for short content.
 */
export function pruneToolResult(result: ToolResult): PrunedToolResult {
  const content = result.content ?? "";
  if (content.length <= MAX_TOOL_OUTPUT_CHARS) {
    return { ...result, content, truncated: false };
  }
  const head = content.slice(0, HEAD_KEEP);
  const tail = content.slice(-TAIL_KEEP);
  const skipped = content.length - HEAD_KEEP - TAIL_KEEP;
  const compressed = `${head}\n\n... [${skipped} chars elided by Noira]\n\n${tail}`;
  return { ...result, content: compressed, truncated: true };
}

/**
 * Maps raw tool results into assistant-visible tool messages, pruning each.
 * Returns messages ordered as the API expects: a sequence of tool result
 * messages after an assistant message with tool_calls.
 */
export function toToolMessages(results: PrunedToolResult[]): ChatMessage[] {
  return results.map((r) => ({
    role: "tool" as const,
    tool_call_id: r.tool_call_id,
    content: r.content,
    name: "tool",
  }));
}

/**
 * Sums token estimate of an array; used to hard-cap session growth.
 */
export function estimateTokens(messages: ChatMessage[]): number {
  let n = 0;
  for (const m of messages) {
    n += countTokens(m.content);
    if (m.tool_calls) {
      for (const tc of m.tool_calls) {
        n += countTokens(tc.function.name) + countTokens(tc.function.arguments) + 8;
      }
    }
  }
  return n;
}

export function countTokens(text: string): number {
  if (!text) return 0;
  // Rough heuristic: ~4 chars per token for latin text. Good enough for the
  // compaction trigger thresholds.
  return Math.ceil(text.length / 4);
}

export interface CompactionResult {
  messages: ChatMessage[];
  compacted: boolean;
}

/**
 * If history exceeds the cap, collapse old tool noise: prune again and, if
 * still too large, summarize the earlier region into a single system note.
 */
export function maybeCompact(
  messages: ChatMessage[],
  systemPrefix: ChatMessage[],
  capTokens: number
): CompactionResult {
  if (estimateTokens(messages) <= capTokens) return { messages, compacted: false };

  // Re-prune stale oversized tool messages.
  const remapped = messages.map((m) => {
    if (m.role === "tool" && countTokens(m.content) > MAX_TOOL_OUTPUT_CHARS / 4) {
      const p = pruneToolResult({ tool_call_id: m.tool_call_id ?? "", content: m.content });
      return { ...m, content: p.content };
    }
    return m;
  });

  if (estimateTokens(remapped) <= capTokens) return { messages: remapped, compacted: true };

  // Semantic compaction: keep system prefix + last N messages + summarized middle.
  // Instead of blind truncation, we preserve a compressed summary.
  const keepTail = 14;
  const keepHead = Math.min(4, remapped.length - keepTail);
  const head = remapped.slice(0, keepHead);
  // Build a tiny summary of the dropped middle (tool names + key outputs)
  const dropped = remapped.slice(keepHead, Math.max(keepHead, remapped.length - keepTail));
  const droppedSummary = dropped.length
    ? dropped
        .filter((m) => m.role === "tool" || m.role === "assistant")
        .slice(0, 8)
        .map((m) => {
          const c = (m.content ?? "").slice(0, 200).replace(/\n/g, " ").trim();
          return c ? `- ${m.role}: ${c}` : null;
        })
        .filter(Boolean)
        .join("\n")
    : "";
  const note: ChatMessage = {
    role: "system",
    content:
      `[Noira] Historial compactado: ${dropped.length} mensajes resumidos para caber en contexto.\n` +
      (droppedSummary ? `Resumen:\n${droppedSummary}\n` : "") +
      `Conserva las decisiones ya aplicadas (míralas en archivos). Continúa desde el último paso sin repetir trabajo.`,
  };
  const sliced = remapped.slice(Math.max(0, remapped.length - keepTail));
  return { messages: [...systemPrefix, ...head, note, ...sliced], compacted: true };
}

/**
 * Splits a long user task into a short stable instruction + the detail.
 * Keeps the stable part as a fixed system block so it caches.
 */
export function cacheAwareTask(task: string): { stable: ChatMessage; detail: ChatMessage } {
  return {
    stable: {
      role: "system",
      content: "Eres el orquestador de Noira. Recibes una tarea y decides que sub-agentes y herramientas usan, en que orden.",
    },
    detail: { role: "user", content: task },
  };
}
