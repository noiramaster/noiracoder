/**
 * Multi-model router.
 *
 * A "level" (low/medium/high/max) is NOT a single model. It is an execution
 * strategy that combines several models. The user only ever sees "Noira · <level>";
 * the router hides which underlying models are used.
 *
 * Consensus/cross-checking between multiple models only activates on tasks
 * marked sensitive (trading bot code, git push, deploy, file deletion). For
 * everything else the router optimizes for free-quota spend.
 */

import type { Level, ModelInfo, RouterDecision } from "../types.js";
import { isFreeQuotaError, QuotaTracker } from "./catalog.js";
import { AdaptiveRanker, type AdaptiveRole } from "./adaptive.js";
import { isChatModel } from "./providers/index.js";

export interface RouterConfig {
  /** Force the router to only use free (max_price=0) models. */
  freeOnly: boolean;
  /** Daily free limits keyed by quota-key. Seeded conservatively; updated at
   *  runtime when the provider reports limits. */
  limits: Record<string, number | null>;
  /** Preferred model ids per role, in order. Built by buildRolePolicy. */
  preferredByRole: Record<string, string[]>;
}

export interface RolePolicy {
  orchestrator: string[];
  code: string[];
  research: string[];
  review: string[];
  security: string[];
  cheap: string[];
}

export function emptyRolePolicy(): RolePolicy {
  return {
    orchestrator: [],
    code: [],
    research: [],
    review: [],
    security: [],
    cheap: [],
  };
}

/**
 * Builds role model lists from the live catalog. Free models are ranked by
 * context length so the "strongest" (largest context) free ones are preferred
 * for reasoning roles, while cheap free ones handle high-volume steps.
 *
 * Models that cannot do tool use (video/image/audio gen) are excluded — Noira
 * is a coding agent and every role runs a tool loop (OpenRouter 404s such
 * models: "No endpoints found that support tool use").
 */
export function buildRolePolicy(models: ModelInfo[], freeModels: ModelInfo[]): RolePolicy {
  const chat = (m: ModelInfo) => isChatModel(m);
  const free = freeModels.filter(chat).sort((a, b) => b.context_length - a.context_length);
  const paid = models.filter((m) => chat(m) && !m.free).sort((a, b) => b.context_length - a.context_length);
  const cheapPool = freeModels.filter(chat).sort((a, b) => a.context_length - b.context_length);

  const pick = (n: number, from: ModelInfo[]): string[] => from.slice(0, n).map((m) => m.id);

  return {
    // Reasoning-capable roles prefer the biggest free contexts first, fall back to paid.
    orchestrator: pick(4, free).concat(pick(3, paid)),
    code: pick(5, free).concat(pick(3, paid)),
    research: pick(4, free).concat(pick(3, paid)),
    review: pick(4, free).concat(pick(3, paid)),
    security: pick(4, free).concat(pick(3, paid)),
    // Cheap role: smallest reasonable free models for tool-heavy loops.
    cheap: cheapPool.slice(0, 5).map((m) => m.id),
  };
}

/** Default conservative free-tier limits (requests/day). OpenRouter per-model
 *  free limits vary; these are floors. The system warns well before exhaust. */
const DEFAULT_LIMITS: Record<string, number | null> = {};
// The actual per-model free limits can't be known without provider telemetry,
// so we track usage and let the user opt into known limits via config. We
// nevertheless keep a small map of commonly-known free tiers as seeds.
import { freeLimits as _seeds } from "./freeLimits.js";

const SEED_LIMITS: Record<string, number> = _seeds;

export interface SharedBucket {
  /** Account/pool id, e.g. "openrouter:free". */
  accountId: string;
  /** Effective daily budget for the whole bucket. */
  limit: number | null;
  /** True when the given model draws from this bucket. */
  appliesTo: (modelId: string, info: ModelInfo | undefined) => boolean;
}

export function pickModel(opts: {
  candidates: string[];
  quota: QuotaTracker;
  limits: Record<string, number | null>;
  used: Set<string>;
  freeOnly: boolean;
  modelsById: Map<string, ModelInfo>;
  shared?: SharedBucket;
}): string | null {
  for (const id of opts.candidates) {
    if (opts.used.has(id)) continue;
    const info = opts.modelsById.get(id);
    if (opts.freeOnly && info && !info.free) continue;
    // Shared account bucket first (OpenRouter free: one budget for all models).
    if (opts.shared && opts.shared.limit !== null && opts.shared.appliesTo(id, info)) {
      const s = opts.quota.accountState(opts.shared.accountId, opts.shared.limit);
      if (s.used >= (opts.shared.limit as number)) continue;
    }
    // If a model has a known limit and is exhausted today, skip it.
    const limit = opts.limits[id] ?? SEED_LIMITS[id] ?? null;
    if (limit !== null) {
      const s = opts.quota.state(id, limit);
      if (s.used >= limit) continue;
    }
    return id;
  }
  return null;
}

export function buildRouter(opts: {
  level: Level;
  rolePolicy: RolePolicy;
  modelsById: Map<string, ModelInfo>;
  quota: QuotaTracker;
  freeOnly: boolean;
  limits?: Record<string, number | null>;
  warn: (msg: string) => void;
  /** Optional adaptive ranker; when present its learned scores and cooldowns are
   *  folded into every decision and it is notified of success/failure. */
  adaptive?: AdaptiveRanker;
  /** Optional shared account bucket (OpenRouter free). Skips exhausted pools. */
  sharedQuota?: SharedBucket;
}) {
  const limits: Record<string, number | null> = { ...SEED_LIMITS, ...(opts.limits ?? {}) };
  const usedCandidates = new Set<string>();

  const candidatesFor = (role: keyof RolePolicy): string[] => {
    return opts.rolePolicy[role] ?? [];
  };

  function decide(role: keyof RolePolicy): RouterDecision {
    // Start from catalog preference, then re-rank adaptively if available.
    let list = candidatesFor(role);
    if (opts.adaptive) list = opts.adaptive.order(role, list);
    // Never re-pick a model that already failed this session (fallback must
    // actually move to a DIFFERENT candidate, else a single bad model loops).
    const chosen = usedCandidates.has(list[0])
      ? list.find((id) => !usedCandidates.has(id))
      : pickModel({
          candidates: list,
          quota: opts.quota,
          limits,
          used: usedCandidates,
          freeOnly: opts.freeOnly,
          modelsById: opts.modelsById,
          shared: opts.sharedQuota,
        }) ?? list[0];
    if (chosen) usedCandidates.add(chosen);
    const info = opts.modelsById.get(chosen ?? "");
    return { model: chosen ?? "", free: info?.free ?? false, provider: info?.provider };
  }

  /** Warn when combined free quota across known-limit models is nearly gone. */
  function checkCombinedQuota(): void {
    const limitMap = new Map<string, number | null>();
    for (const id of [...opts.rolePolicy.orchestrator, ...opts.rolePolicy.code, ...opts.rolePolicy.cheap]) {
      limitMap.set(id, limits[id] ?? null);
    }
    let { used, total } = opts.quota.combinedRemaining(limitMap);
    if (opts.sharedQuota && opts.sharedQuota.limit !== null) {
      const s = opts.quota.accountState(opts.sharedQuota.accountId, opts.sharedQuota.limit);
      used += Math.min(s.used, opts.sharedQuota.limit as number);
      total += opts.sharedQuota.limit as number;
    }
    if (total > 0) {
      const remaining = total - used;
      const pct = (remaining / total) * 100;
      if (pct <= 15 && remaining > 0) {
        opts.warn(`Cuota gratuita combinada al ${Math.round(pct)}% restante (${remaining}/${total} requests).`);
      } else if (remaining <= 0) {
        opts.warn("Cuota gratuita combinada agotada. Cambia a un modelo de pago o espera al reset diario.");
      }
    }
  }

  return {
    decide,
    checkCombinedQuota,
    limits: () => limits,
    usedCandidates,
    /** Tell the adaptive ranker a model succeeded for a role. No-op if no ranker. */
    recordSuccess(role: keyof RolePolicy, model: string) {
      if (opts.adaptive) void opts.adaptive.recordSuccess(role, model);
      // Shared bucket accounting: an OpenRouter free call spends the account budget.
      if (opts.sharedQuota) {
        const info = opts.modelsById.get(model);
        if (opts.sharedQuota.appliesTo(model, info)) {
          opts.quota.recordAccount(opts.sharedQuota.accountId);
        }
      } else {
        opts.quota.recordUsage(model);
      }
    },
    /** Tell the adaptive ranker a model failed (cooldown). No-op if no ranker. */
    recordModelError(model: string, kind: "transient" | "quota" = "transient") {
      if (opts.adaptive) void opts.adaptive.recordFailure(model, kind);
    },
  };
}

export function shouldCrossCheck(level: Level, sensitive: boolean): boolean {
  if (level === "max") return true;
  if (level === "high") return sensitive;
  return false;
}

export function shouldAutoCrossCheck(level: Level, sensitive: boolean): boolean {
  // high: cross-check only on sensitive; max: always cross-check.
  return shouldCrossCheck(level, sensitive);
}

export function isRetryableOnQuota(err: unknown): boolean {
  return isFreeQuotaError(err);
}

export interface CrossCheckResult {
  approved: boolean;
  reason: string;
  secondOpinion: string;
}

export function crossCheck(opts: {
  action: string;
  level: Level;
  primaryDecision: string;
  secondOpinion: string;
}): CrossCheckResult {
  const second = opts.secondOpinion.trim().toLowerCase();
  return {
    approved: !/rechaz|deneg|no aprob|no aplica|no hagas/i.test(second),
    reason: "verificacion cruzada de segundo modelo",
    secondOpinion: second,
  };
}
