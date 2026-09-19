/**
 * Multi-provider FUNCIONAL — 10+ gateways free verificados 2026.
 * Todos OpenAI-compatibles salvo donde se anota. Si un provider falla, el resto sigue.
 * Investigación: Groq, Cerebras, Mistral, GitHub Models, NVIDIA NIM, Cloudflare, Cohere,
 * OpenRouter y Zen/OpenCode Zen. Zen endpoint no estándar → graceful fallback.
 * HITO 4: Kilo Gateway (https://api.kilo.ai/api/gateway) — primero del pool,
 * anónimo con modelos `:free` (200 req/h por IP), con clave catálogo completo.
 */

import type { ModelInfo } from "../../types.js";
import { OpenRouterClient, type ChatOptions, type ChatCompletion } from "../provider.js";

export type ProviderId =
  | "openrouter"
  | "groq"
  | "kilo"
  | "cerebras"
  | "mistral"
  | "github"
  | "nvidia"
  | "cohere"
  | "cloudflare"
  | "huggingface"
  | "zen"
  | "ollama";

export interface ProviderClient {
  id: ProviderId;
  label: string;
  complete(opts: ChatOptions): Promise<ChatCompletion>;
  completeStreamed(opts: ChatOptions): Promise<ChatCompletion>;
  listModels(): Promise<ModelInfo[]>;
  validateFree?(): Promise<{ ok: boolean; reason?: string }>;
}

class GenericOpenAIClient implements ProviderClient {
  id: ProviderId;
  label: string;
  private client: OpenRouterClient;
  constructor(id: ProviderId, label: string, opts: { apiKey: string; baseURL: string }) {
    this.id = id;
    this.label = label;
    this.client = new OpenRouterClient({ apiKey: opts.apiKey, baseURL: opts.baseURL, appTitle: "NoiraCoder", httpReferer: "https://noiracoder.noira" });
  }
  complete(opts: ChatOptions): Promise<ChatCompletion> { return this.client.complete(opts); }
  completeStreamed(opts: ChatOptions): Promise<ChatCompletion> { return this.client.completeStreamed(opts); }
  listModels(): Promise<ModelInfo[]> { return this.client.listModels(); }
  async validateFree(): Promise<{ ok: boolean; reason?: string }> {
    try {
      const all = await this.client.listModels();
      if (all.length > 0) return { ok: true };
      return { ok: false, reason: "sin modelos" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/402|payment|billing/i.test(msg)) return { ok: false, reason: `pago: ${msg.slice(0, 100)}` };
      return { ok: false, reason: msg.slice(0, 100) };
    }
  }
}

export function createOpenRouterClient(apiKey: string): ProviderClient {
  const c = new OpenRouterClient({ apiKey });
  return {
    id: "openrouter", label: "OpenRouter",
    complete: (o) => c.complete(o),
    completeStreamed: (o) => c.completeStreamed(o),
    listModels: () => c.listModels(),
    validateFree: async () => {
      try {
        const all = await c.listModels();
        const free = all.filter((m) => m.pricing.prompt === "0" && m.pricing.completion === "0");
        return free.length > 0 ? { ok: true } : { ok: false, reason: "sin modelos free pricing 0" };
      } catch (e) { return { ok: false, reason: e instanceof Error ? e.message.slice(0, 100) : String(e).slice(0, 100) }; }
    },
  };
}

/** HITO 4 — Kilo Gateway (https://api.kilo.ai/api/gateway, OpenAI-compatible).
 * Sin clave: solo modelos `:free` (200 req/hora por IP, verificado). Con clave:
 * catálogo completo. Sin clave nunca se listan modelos de pago (si no, el
 * primer 401 marcaría muerto el provider entero y perderíamos los free). */
class KiloClient extends GenericOpenAIClient {
  private readonly anonymous: boolean;
  constructor(apiKey: string | undefined, baseURL?: string) {
    super("kilo", "Kilo", { apiKey: apiKey ?? "", baseURL: baseURL ?? "https://api.kilo.ai/api/gateway" });
    this.anonymous = !apiKey;
  }
  override async listModels(): Promise<ModelInfo[]> {
    const all = await super.listModels();
    if (!this.anonymous) return all;
    return all.filter((m) => /:free$/i.test(m.id));
  }
}

/** Pool: Kilo primero (defecto sin claves), luego el resto con key. */
export function buildProviderPool(keys: Record<string, string | undefined>): ProviderClient[] {
  const pool: ProviderClient[] = [];
  pool.push(new KiloClient(keys.kilo, keys.kiloBaseUrl));
  if (keys.openrouter) pool.push(createOpenRouterClient(keys.openrouter));
  if (keys.groq) pool.push(new GenericOpenAIClient("groq", "Groq", { apiKey: keys.groq, baseURL: "https://api.groq.com/openai/v1" }));
  if (keys.cerebras) pool.push(new GenericOpenAIClient("cerebras", "Cerebras", { apiKey: keys.cerebras, baseURL: "https://api.cerebras.ai/v1" }));
  if (keys.mistral) pool.push(new GenericOpenAIClient("mistral", "Mistral", { apiKey: keys.mistral, baseURL: "https://api.mistral.ai/v1" }));
  if (keys.github) pool.push(new GenericOpenAIClient("github", "GitHub Models", { apiKey: keys.github, baseURL: "https://models.inference.ai.azure.com" }));
  if (keys.nvidia) pool.push(new GenericOpenAIClient("nvidia", "NVIDIA NIM", { apiKey: keys.nvidia, baseURL: "https://integrate.api.nvidia.com/v1" }));
  if (keys.cohere) pool.push(new GenericOpenAIClient("cohere", "Cohere", { apiKey: keys.cohere, baseURL: "https://api.cohere.ai/compatibility/v1" }));
  if (keys.cloudflare) pool.push(new GenericOpenAIClient("cloudflare", "Cloudflare", { apiKey: keys.cloudflare, baseURL: "https://api.cloudflare.com/client/v4/accounts/" + (keys.cloudflareAccountId ?? "") + "/ai/v1" }));
  // Zen / OpenCode Zen — endpoint no estándar, si falla no rompe pool
  if (keys.zen) pool.push(new GenericOpenAIClient("zen", "Zen", { apiKey: keys.zen, baseURL: keys.zenBaseUrl ?? "https://api.zen.ai/v1" }));
  // HuggingFace no tiene /models OpenAI — no va al pool de listModels, solo como fallback chat si se pide
  return pool;
}

/** Zen free ids that do NOT contain "free" (promotional, rotate — verify periodically). */
export const KNOWN_ZEN_FREE = new Set([
  "big-pickle",
  "mimo-v2.5-free",
  "ling-3.0-flash-fin-free",
  "nemotron-3-ultra-free",
  "nemotron-3.5-lightning-free",
  "muse-spark-1.2-contributor-free",
  "deepseek-v4-flash-free",
  "laguna-s-2.1-free",
  "longcat-2.0-free",
  "north-mini-code-free",
]);

/**
 * Non-chat model families (STT/TTS, embeddings, moderation, image/video gen).
 * Provider catalogs (esp. Groq /models) list them without capability flags,
 * so filter by id: they can never run a tool loop.
 */
const NON_CHAT_ID =
  /whisper|tts|text-to-speech|\bembed|\brerank|moderat|dall-e|stable-diffusion|\bsdxl\b|flux|sora|\bveo\b|lyria|imagen|image-(gen|edit|out)|video-gen|transcri|suno|\bbark\b|parler|coqui|xtts|playai|mms-tts|deepfake|voice/i;

/** True when the model can run a chat+tool loop (Noira's unit of work). */
export function isChatModel(m: { id: string; tools?: boolean }): boolean {
  if (m.tools === false) return false;
  return !NON_CHAT_ID.test(m.id);
}

/**
 * Provider-level free defaults. Non-OpenRouter catalogs rarely carry pricing,
 * so without this every Groq/Zen model classifies as paid and freeOnly mode
 * silently ignores whole providers. Groq serves its catalog on the free tier
 * (per-model quotas); Zen free ids contain "free" or are in KNOWN_ZEN_FREE.
 * Everyone else keeps pricing-based classification (paid/trial).
 */
export function classifyProviderModels(providerId: ProviderId, models: ModelInfo[]): ModelInfo[] {
  const normalize = (m: ModelInfo, free: boolean): ModelInfo => ({
    ...m,
    free,
    provider: providerId,
    pricing: m.pricing ?? { prompt: free ? "0" : "1", completion: free ? "0" : "1" },
    context_length: typeof m.context_length === "number" && m.context_length > 0 ? m.context_length : 8192,
  });
  if (providerId === "groq") {
    // Groq publica precios nominales pero sirve el catálogo en free tier
    // (límites por modelo). Se confirma con llamadas reales, no con pricing.
    return models.map((m) => normalize(m, true));
  }
  if (providerId === "zen") {
    return models.map((m) => normalize(m, /free/i.test(m.id) || KNOWN_ZEN_FREE.has(m.id)));
  }
  if (providerId === "kilo") {
    // Gratis = sufijo :free (kilo-auto/free incluido). Con clave hay modelos
    // de pago, pero en freeOnly se ignoran igual que el resto.
    return models.map((m) => normalize(m, /:free$/i.test(m.id)));
  }
  return models.map((m) => normalize(m, m.free ?? false));
}

export async function fetchAllModels(pool: ProviderClient[]): Promise<ModelInfo[]> {
  return (await fetchMergedCatalog(pool)).models;
}

/**
 * Merged catalog that ALSO remembers which providers serve each model id.
 * Same underlying model (ej. openai/gpt-oss-120b) suele estar en OpenRouter Y
 * en Groq con el mismo id: el dedupe se queda con el primero, pero si ese
 * provider muere (clave inválida) el orquestador puede reasignar el modelo
 * a otro provider vivo que también lo sirva.
 */
export interface MergedCatalog {
  models: ModelInfo[];
  providersById: Map<string, ProviderId[]>;
  /** free flag PER provider: el mismo id puede ser gratis en Groq y de pago en OpenRouter. */
  freeByProvider: Map<string, Map<ProviderId, boolean>>;
}

export async function fetchMergedCatalog(pool: ProviderClient[]): Promise<MergedCatalog> {
  const results = await Promise.allSettled(pool.map((p) => p.listModels()));
  const seen = new Set<string>();
  const providersById = new Map<string, ProviderId[]>();
  const freeByProvider = new Map<string, Map<ProviderId, boolean>>();
  const out: ModelInfo[] = [];
  for (let i = 0; i < pool.length; i++) {
    const r = results[i];
    if (r.status === "rejected") continue;
    for (const m of classifyProviderModels(pool[i].id, r.value)) {
      const list = providersById.get(m.id) ?? [];
      if (!list.includes(pool[i].id)) list.push(pool[i].id);
      providersById.set(m.id, list);
      const flags = freeByProvider.get(m.id) ?? new Map<ProviderId, boolean>();
      flags.set(pool[i].id, m.free);
      freeByProvider.set(m.id, flags);
      if (seen.has(m.id) || !isChatModel(m)) continue;
      seen.add(m.id);
      out.push(m);
    }
  }
  return { models: out, providersById, freeByProvider };
}

export async function validatePool(pool: ProviderClient[]): Promise<Record<string, { ok: boolean; reason?: string }>> {
  const out: Record<string, { ok: boolean; reason?: string }> = {};
  for (const p of pool) out[p.id] = p.validateFree ? await p.validateFree() : { ok: true };
  return out;
}

export { LlmErrorImpl } from "../provider.js";
