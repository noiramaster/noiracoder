/**
 * Process-wide /parallel toggle.
 *
 * When enabled, the orchestrator runs genuinely independent leaf agents
 * (security + review) concurrently with Promise.all instead of sequentially.
 * This is real parallelism, not a cosmetic message.
 */
let parallelEnabled = false;

export function setParallelEnabled(v: boolean): void {
  parallelEnabled = v;
}

export function isParallelEnabled(): boolean {
  return parallelEnabled;
}
