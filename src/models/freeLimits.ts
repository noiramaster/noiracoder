/**
 * Seed values for known free-tier daily request ceilings.
 *
 * CORRECTNESS NOTE (verified against provider docs 2026):
 * - OpenRouter free is enforced PER ACCOUNT across all `:free` models
 *   (50/day without lifetime credits, 1000/day with a one-time $10+
 *   purchase — NOT per model). Those budgets live in accountQuota.ts as a
 *   shared bucket; do NOT add per-model OpenRouter seeds here.
 * - Groq free IS per model per key (1000 RPD most chat models; tokens/min
 *   usually bind first — the router relies on 429 failover for those).
 * - Zen publishes no stable limits (promotional free models that rotate);
 *   tracked as unknown, 429/cooldown failover is the safety net.
 * - Together/Cerebras have no permanent free tier — excluded on purpose.
 */

export const freeLimits: Record<string, number> = {
  // ── Groq free tier: per-model daily budgets (real, per key; ids verified live) ──
  "groq/compound": 250,
  "groq/compound-mini": 250,
  "openai/gpt-oss-120b": 1000,
  "openai/gpt-oss-20b": 1000,
  "llama-3.3-70b-versatile": 1000,
  "llama-3.1-8b-instant": 1000,

  // ── Legacy seeds kept only as floors for models sometimes free ──
  "meta-llama/llama-3.3-70b-instruct": 20,
  "google/gemini-2.0-flash-exp": 20,
  "deepseek/deepseek-chat": 20,
  "qwen/qwen-2.5-72b-instruct": 20,
  "mistralai/mistral-nemo": 20,
};
