/**
 * Model catalog + per-model quota tracking.
 *
 * The free-model set on OpenRouter changes frequently, so we never hardcode a
 * fixed list. We consult the catalog at runtime (with a cached copy on disk)
 * and classify free vs paid models by their pricing.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import os from "node:os";
import type { ModelInfo, QuotaState } from "../types.js";
import { LlmErrorImpl } from "./provider.js";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h — catálogo free cambia a diario

export interface CatalogResult {
  models: ModelInfo[];
  free: ModelInfo[];
  fetchedAt: number;
  /** Providers serving each model id (multi-provider flip on death). */
  providersById: Map<string, string[]>;
  /** free flag per (model, provider). */
  freeByProvider: Map<string, Record<string, boolean>>;
}

function toNumber(v: string | null | undefined): number {
  if (!v) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function isFree(m: ModelInfo): boolean {
  const p = (m as any)?.pricing;
  if (!p) return false;
  return toNumber(p.prompt) === 0 && toNumber(p.completion) === 0;
}

export function classify(m: ModelInfo): ModelInfo {
  return { ...m, free: isFree(m), tools: m.tools !== false };
}

/**
 * Fetches the catalog, honoring a coarse on-disk cache. Returns classified
 * models plus the free list.
 */
export async function loadCatalog(opts: {
  fetch: () => Promise<ModelInfo[] | { models: ModelInfo[]; providersById?: Record<string, string[]>; freeByProvider?: Record<string, Record<string, boolean>> }>;
  cacheDir?: string;
  forceFresh?: boolean;
}): Promise<CatalogResult> {
  const cacheDir = opts.cacheDir ?? join(os.homedir(), ".noirarc");
  // v4: catalog also carries providersById + freeByProvider (multi-provider flip).
  // v5: provider etiquetado siempre (Kilo anónimo) + nunca vacío (Hito 4).
  const cacheFile = join(cacheDir, "catalog.v5.json");

  if (!opts.forceFresh) {
    try {
      const raw = await readFile(cacheFile, "utf8");
      const cached = JSON.parse(raw) as { models: ModelInfo[]; fetchedAt: number; providersById?: Record<string, string[]>; freeByProvider?: Record<string, Record<string, boolean>> };
      if (cached.models && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        const models = cached.models.map(classify);
        return {
          models,
          free: models.filter((m) => m.free),
          fetchedAt: cached.fetchedAt,
          providersById: new Map(Object.entries(cached.providersById ?? {})),
          freeByProvider: new Map(Object.entries(cached.freeByProvider ?? {})),
        };
      }
    } catch {
      // no cache
    }
  }

  // HITO 4.5: si la red falla o un provider devuelve vacío, se prefiere el
  // caché rancio a romper (o envenenar con vacío). Nunca se cachea vacío.
  const readStale = async (): Promise<CatalogResult | null> => {
    try {
      const raw = await readFile(cacheFile, "utf8");
      const cached = JSON.parse(raw) as { models: ModelInfo[]; fetchedAt: number; providersById?: Record<string, string[]>; freeByProvider?: Record<string, Record<string, boolean>> };
      if (!cached.models || cached.models.length === 0) return null;
      const models = cached.models.map(classify);
      return {
        models,
        free: models.filter((m) => m.free),
        fetchedAt: cached.fetchedAt,
        providersById: new Map(Object.entries(cached.providersById ?? {})),
        freeByProvider: new Map(Object.entries(cached.freeByProvider ?? {})),
      };
    } catch {
      return null;
    }
  };

  let fetched: ModelInfo[] | { models: ModelInfo[]; providersById?: Record<string, string[]>; freeByProvider?: Record<string, Record<string, boolean>> };
  try {
    fetched = await opts.fetch();
  } catch {
    const stale = await readStale();
    if (stale) return stale;
    throw new Error("sin catálogo: red caída y sin caché");
  }
  const rawModels = Array.isArray(fetched) ? fetched : fetched.models;
  if (rawModels.length === 0) {
    const stale = await readStale();
    if (stale) return stale;
    throw new Error("sin modelos en el catálogo (red o provider vacíos)");
  }
  const providersById = new Map(Object.entries(Array.isArray(fetched) ? {} : (fetched.providersById ?? {})));
  const freeByProvider = new Map(Object.entries(Array.isArray(fetched) ? {} : (fetched.freeByProvider ?? {})));
  const models = rawModels.map(classify);
  const result: CatalogResult = { models, free: models.filter((m) => m.free), fetchedAt: Date.now(), providersById, freeByProvider };

  try {
    await mkdir(cacheDir, { recursive: true });
    await writeFile(
      cacheFile,
      JSON.stringify({
        models: result.models,
        fetchedAt: result.fetchedAt,
        providersById: Object.fromEntries(providersById),
        freeByProvider: Object.fromEntries(freeByProvider),
      }),
      "utf8",
    );
  } catch {
    // non-fatal
  }

  return result;
}

/** Strip base64-encoding noise / numbers from a model id for a friendly key. */
export function quotaKey(model: string): string {
  return model.replace(/[^a-zA-Z0-9:_/.-]/g, "_");
}

/**
 * Persistent per-model quota tracker. Stores used counts with a daily rolling
 * window so the router can rotate off models that are exhausted today and warn
 * before the combined budget is gone.
 */
export class QuotaTracker {
  private file: string;
  private data: Record<string, { day: string; used: number }>;
  loaded: boolean;

  constructor(cacheDir?: string) {
    this.file = join(cacheDir ?? join(os.homedir(), ".noirarc"), "quota.json");
    this.data = {};
    this.loaded = false;
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.file, "utf8");
      const parsed = JSON.parse(raw) as Record<string, { day: string; used: number }>;
      const t = this.today();
      this.data = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (v.day === t) this.data[quotaKey(k)] = v;
        else this.data[quotaKey(k)] = { day: t, used: 0 };
      }
    } catch {
      this.data = {};
    }
    this.loaded = true;
  }

  /** Record that a request for `model` was consumed (or attempted). */
  recordUsage(model: string, n = 1): void {
    const k = quotaKey(model);
    const t = this.today();
    const cur = this.data[k];
    this.data[k] = { day: t, used: (cur?.day === t ? cur.used : 0) + n };
    void this.persist();
  }

  /**
   * Account-level shared bucket (e.g. OpenRouter's free tier, which is
   * enforced per account across ALL free models, not per model).
   */
  recordAccount(accountId: string, n = 1): void {
    const k = `__account__:${accountId}`;
    const t = this.today();
    const cur = this.data[k];
    this.data[k] = { day: t, used: (cur?.day === t ? cur.used : 0) + n };
    void this.persist();
  }

  accountState(accountId: string, limit: number | null): QuotaState {
    const k = `__account__:${accountId}`;
    const t = this.today();
    const cur = this.data[k];
    const used = cur?.day === t ? cur.used : 0;
    return { used, limit, total: limit ?? null };
  }

  state(model: string, knownLimit: number | null): QuotaState {
    const k = quotaKey(model);
    const t = this.today();
    const cur = this.data[k];
    const used = cur?.day === t ? cur.used : 0;
    return { used, limit: knownLimit, total: knownLimit ?? null };
  }

  /** Combined remaining quota across all tracked/free models given their limits. */
  combinedRemaining(limits: Map<string, number | null>): { used: number; total: number } {
    let used = 0;
    let total = 0;
    for (const [model, limit] of limits) {
      if (limit === null) continue;
      const s = this.state(model, limit);
      used += Math.min(s.used, limit);
      total += limit;
    }
    return { used, total };
  }

  async persist(): Promise<void> {
    try {
      await mkdir(dirname(this.file), { recursive: true });
      await writeFile(this.file, JSON.stringify(this.data), "utf8");
    } catch {
      // non-fatal
    }
  }
}

export function isFreeQuotaError(err: unknown): boolean {
  if (err instanceof LlmErrorImpl) {
    return err.openRouterCode === 402 || err.status === 429 || err.status === 403;
  }
  return false;
}
