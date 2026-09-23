/**
 * Adaptive routing memory.
 *
 * Beyond static role→model preferences, Noira learns at runtime which models
 * succeed per role and which fail. Successes raise a model's score; failures
 * (non-retryable errors, quota exhaustion) put it on a cooldown so the next
 * decision skips it and falls back to the next-best candidate. All state is
 * persisted under ~/.noirarc so it survives restarts.
 *
 * This is a real edge over Claude Code / OpenCode: the router gets better for
 * YOUR task mix and YOUR free-quota situation over time, instead of guessing
 * from a fixed list.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import os from "node:os";

export type AdaptiveRole = "orchestrator" | "code" | "research" | "review" | "security" | "cheap";

interface AdaptiveData {
  scores: Record<string, Record<string, number>>;
  cooldowns: Record<string, number>;
  /** Exponential moving average latency (ms) per role→model. */
  latencies: Record<string, Record<string, number>>;
  until: string;
}

const ACTIVE_ROLES: AdaptiveRole[] = ["orchestrator", "code", "research", "review", "security", "cheap"];
const FILE = () => join(os.homedir(), ".noirarc", "adaptive.json");

// Cooldowns.
const QUOTA_COOLDOWN_MS = 6 * 60 * 60 * 1000; // hard penalty on quota/429/402
const ERROR_COOLDOWN_MS = 5 * 60 * 1000; // soft penalty on transient errors

export class AdaptiveRanker {
  private scores: Record<string, Record<string, number>> = {};
  private cooldowns: Record<string, number> = {};
  private latencies: Record<string, Record<string, number>> = {};
  private loaded = false;
  private file: string;

  constructor(file?: string) {
    this.file = file ?? FILE();
  }

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.file, "utf8");
      const d = JSON.parse(raw) as Partial<AdaptiveData>;
      this.scores = d.scores ?? {};
      this.cooldowns = d.cooldowns ?? {};
      this.latencies = d.latencies ?? {};
      // Drop stale cooldowns immediately so we never hang on a dead model.
      const now = Date.now();
      for (const [m, until] of Object.entries(this.cooldowns)) {
        if (until < now) delete this.cooldowns[m];
      }
    } catch {
      this.scores = {};
      this.cooldowns = {};
    }
    this.loaded = true;
  }

  async persist(): Promise<void> {
    try {
      await mkdir(dirname(this.file), { recursive: true });
      await writeFile(this.file, JSON.stringify({ scores: this.scores, cooldowns: this.cooldowns, latencies: this.latencies, until: new Date().toISOString() }, null, 2), "utf8");
    } catch {
      // non-fatal
    }
  }

  private ensureRole(role: string): void {
    if (!this.scores[role]) this.scores[role] = {};
  }

  private scoreOf(role: string, model: string): number {
    return this.scores[role]?.[model] ?? 0;
  }

  /**
   * Ranks candidates for a role: skip anything on cooldown, then order by
   * learned score (higher first), with latency as tiebreak (faster preferred).
   * Preserves catalog-preference order as final tiebreak.
   */
  order(role: string, candidates: string[]): string[] {
    const now = Date.now();
    const active = candidates.filter((m) => !(this.cooldowns[m] && this.cooldowns[m] > now));
    return [...active].sort((a, b) => {
      const sa = this.scoreOf(role, a);
      const sb = this.scoreOf(role, b);
      if (sa !== sb) return sb - sa;
      // Tiebreak: faster historical latency wins.
      const la = this.latencies[role]?.[a] ?? Infinity;
      const lb = this.latencies[role]?.[b] ?? Infinity;
      if (la !== lb) return la - lb;
      const ia = candidates.indexOf(a);
      const ib = candidates.indexOf(b);
      return ia - ib;
    });
  }

  /** Called when a model produced a good result for a role. */
  async recordSuccess(role: string, model: string, latencyMs?: number): Promise<void> {
    this.ensureRole(role);
    const cur = this.scoreOf(role, model);
    // Bounded inflate; clamp to avoid unbounded dominance.
    this.scores[role][model] = Math.min(10, cur + 1);
    // Update EMA latency (alpha=0.3 gives weight to recent observations).
    if (latencyMs !== undefined && latencyMs > 0 && latencyMs < 300_000) {
      const prev = this.latencies[role]?.[model];
      this.latencies[role] ??= {};
      this.latencies[role][model] = prev !== undefined ? prev * 0.7 + latencyMs * 0.3 : latencyMs;
    }
    await this.persist();
  }

  /** Called when a model errored. Soft cooldown for transient, hard for quota. */
  async recordFailure(model: string, kind: "transient" | "quota" = "transient"): Promise<void> {
    const until = Date.now() + (kind === "quota" ? QUOTA_COOLDOWN_MS : ERROR_COOLDOWN_MS);
    const existing = this.cooldowns[model] ?? 0;
    this.cooldowns[model] = Math.max(existing, until);
    await this.persist();
  }

  /** Pull a model out of a penalty cooldown early (e.g. reset detected). */
  async clearCooldown(model: string): Promise<void> {
    delete this.cooldowns[model];
    await this.persist();
  }

  cooldownActive(model: string): boolean {
    const until = this.cooldowns[model];
    return !!until && until > Date.now();
  }

  roles(): AdaptiveRole[] {
    return ACTIVE_ROLES;
  }

  /** Average latency (ms) for a model across all roles, or null if no data. */
  avgLatency(model: string): number | null {
    let sum = 0, n = 0;
    for (const role of ACTIVE_ROLES) {
      const v = this.latencies[role]?.[model];
      if (v !== undefined) { sum += v; n++; }
    }
    return n > 0 ? sum / n : null;
  }

  /** Score for a specific role+model, or 0 if no data. */
  score(role: string, model: string): number {
    return this.scoreOf(role, model);
  }

  /** All models seen across all roles. */
  allModels(): string[] {
    const s = new Set<string>();
    for (const role of ACTIVE_ROLES) {
      for (const m of Object.keys(this.scores[role] ?? {})) s.add(m);
    }
    return [...s];
  }

  isLoaded(): boolean {
    return this.loaded;
  }
}
