/**
 * Account-level shared quota buckets.
 *
 * OpenRouter's free tier is enforced PER ACCOUNT, not per model: all `:free`
 * models share one daily budget (50 req/day without lifetime credits, 1000/day
 * once the account has bought $10+ in credits — one-time purchase). Counting
 * per model (as freeLimits seeds used to imply) overestimates the budget ~30x.
 *
 * Groq is the opposite: limits are PER MODEL per key, so per-model seeds stay.
 * Zen publishes no stable limits (promotional free models) — tracked as
 * unknown, with 429/cooldown failover as the safety net.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import os from "node:os";

export const OPENROUTER_FREE_ACCOUNT_ID = "openrouter:free";

export const OPENROUTER_FREE_DAILY = {
  /** Default: no lifetime credit purchase on the account. */
  noCredits: 50,
  /** After a one-time $10+ lifetime credit purchase. */
  withCredits: 1000,
} as const;

export const GROQ_FREE_RPD = 1000;

function configFile(): string {
  const base = process.env.NOIRARC_HOME ?? join(os.homedir(), ".noirarc");
  return join(base, "config.json");
}

export interface NoiraConfig {
  /** True if this OpenRouter account ever bought $10+ in credits (one-time). */
  openrouterPaidCredits?: boolean;
}

export async function loadNoiraConfig(): Promise<NoiraConfig> {
  try {
    const raw = await readFile(configFile(), "utf8");
    const parsed = JSON.parse(raw) as NoiraConfig;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveNoiraConfig(patch: NoiraConfig): Promise<void> {
  const file = configFile();
  const cur = await loadNoiraConfig();
  await mkdir(join(file, ".."), { recursive: true });
  await writeFile(file, JSON.stringify({ ...cur, ...patch }, null, 2), "utf8");
}

/** Effective shared daily budget for OpenRouter free models. Conservative by default. */
export function openRouterSharedLimit(cfg: NoiraConfig): number {
  return cfg.openrouterPaidCredits ? OPENROUTER_FREE_DAILY.withCredits : OPENROUTER_FREE_DAILY.noCredits;
}
