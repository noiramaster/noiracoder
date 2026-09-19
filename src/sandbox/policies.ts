/**
 * Application-level permission policy that sits ABOVE (and alongside) the
 * OS-level sandbox. Even with bwrap/seatbelt, we enforce human-readable rules
 * so that Noira asks before destructive, risky, or money-moving actions.
 */

/**
 * Application-level permission policy — WHITELIST model.
 *
 * Security core: instead of a deny-list ("block known dangerous commands"),
 * we use an explicit ALLOW-LIST. Anything not explicitly permitted is either
 * denied outright (hard-deny patterns) or requires explicit human
 * confirmation. A deny-list is trivially bypassed (space variants, unicode,
 * env tricks, `;`, `&&`, shell built-ins that mirror a command, etc.); an
 * allow-list means the agent can only ever run what a human explicitly
 * approved, so an unknown/dangerous command can never execute silently.
 */

/** A single allow-list rule. `name` must match the leading token of a command. */
export interface AllowRule {
  name: string;
  reason: string;
  /** When true, still demands explicit confirmation even though allowed. */
  requireConfirm: boolean;
}

export interface SandboxPolicy {
  /**
   * WHITELIST of safe shell command *names* (leading token). Anything with a
   * leading token NOT in this list is treated as "ask" (requires explicit
   * confirmation). This is the core of sandboxing.
   */
  allowCommands: string[];
  /** Known-dangerous command tokens that are ALWAYS denied (never auto-allow, even if asked). */
  hardDeny: string[];
  /** Substrings that mark a path as sensitive (project-specific, e.g. infra, secrets). */
  sensitivePaths: string[];
  /**
   * Legacy fields kept for config compatibility. `askBefore` commands are
   * folded into the whitelist with requireConfirm:true (they may still run,
   * but only after explicit confirmation). `allowedAsDefault` overrides
   * nothing: unknown commands always default to "ask".
   */
  askBefore: string[];
}

export interface PolicyRule {
  action: "ask" | "deny" | "allow";
  reason: string;
  pattern: RegExp;
  requireConfirm: boolean;
}

export interface PolicyDecision {
  action: "ask" | "deny" | "allow";
  reason?: string;
  requireConfirm?: boolean;
}

/**
 * Default whitelist of benign commands the agent may run WITHOUT confirmation.
 * Deliberately conservative: no rm/del/truncate/dd/mkfs, no package managers
 * that alter global state silently, no network mutators. Everything else
 * falls through to "ask".
 */
export const DEFAULT_ALLOWED_COMMANDS: string[] = [
  // navigation / inspection
  "ls", "dir", "pwd", "cd", "cat", "type", "echo", "printf", "find", "where",
  "which", "head", "tail", "wc", "grep", "rg", "sed", "awk", "tree", "stat",
  // build / test / run (read-mostly; writes are still project-scoped)
  "node", "npm", "npx", "pnpm", "yarn", "bun", "tsc", "python", "python3",
  "pip", "go", "cargo", "rustc", "ruby", "php", "java", "javac", "dotnet",
  "make", "cmake", "mvn", "gradle", "gcc", "clang", "cl", "g++", "clang++",
  "git",
  // env / process introspection
  "env", "printenv", "hostname", "uname", "date", "time", "whoami",
  "git-bash", "powershell", "pwsh", "cmd",
];

export const DEFAULT_POLICY: SandboxPolicy = {
  allowCommands: DEFAULT_ALLOWED_COMMANDS,
  // Hard deny always wins — even a confirmed attempt is refused.
  hardDeny: [
    "rm -rf /",
    "mkfs.",
    "fdisk",
    "mkpart",
    "dd of=/dev/",
    "format",
    "del /s /q c:\\",
    "Remove-Item -Recurse -Force C:\\",
    "rcopy",
    "shutdown",
    "reboot",
    "curl http", // unvalidated network writes stay out of the silent path
    // HITO 2.5: payloads codificados/ofuscados (bypass de patrones por -enc).
    "-EncodedCommand",
    "FromBase64String",
    "Invoke-Expression",
    "iex",
  ],
  sensitivePaths: [],
  askBefore: [
    "rm", "rmdir", "del", "del /s", "Remove-Item", "deploy", "terraform apply",
    "kubectl delete", "docker compose down -v", "sudo", "git push", "git push -f",
    // HITO 2.5: código en línea (el contenido interior no se audita) -> preguntar.
    "python -c", "python3 -c", "node -e",
  ],
};

export function compilePolicy(policy: SandboxPolicy): PolicyRule[] {
  const rules: PolicyRule[] = [];
  // 1) Hard denies first: they must always win over any other rule.
  // HITO 2.5: cada entrada genera ADEMÁS una variante normalizada
  // ("/s /q" -> "/s/q", el espacio va ANTES de la barra) para que el
  // espaciado no degrade deny a ask.
  for (const p of policy.hardDeny) {
    rules.push({ action: "deny", pattern: new RegExp(`(^|[\\s;&|])${escapeRe(p)}`, "i"), reason: `bloqueado por politica: ${p}`, requireConfirm: false });
    const norm = p.replace(/\s+/g, " ").replace(/\s+\//g, "/");
    if (norm !== p) {
      rules.push({ action: "deny", pattern: new RegExp(`(^|[\\s;&|])${escapeRe(norm)}`, "i"), reason: `bloqueado por politica: ${p}`, requireConfirm: false });
    }
  }
  // 2) Legacy askBefore: these may run but ONLY with explicit confirmation.
  for (const p of policy.askBefore) {
    rules.push({ action: "ask", pattern: new RegExp(`(^|[\\s;&|])${escapeRe(p)}`, "i"), reason: `requiere confirmacion: ${p}`, requireConfirm: true });
  }
  return rules;
}

/** Isolate the leading token of a shell command (handles `; & | &&`, quotes, paths). */
export function leadingToken(command: string): string {
  const head = command.trim().split(/[\s;&|<>()]+/, 1)[0] ?? "";
  // strip quotes and windows backslash-path prefixes and command extensions
  const bare = head.replace(/^["']+/, "").replace(/["']+$/, "").replace(/\.(exe|com|bat|cmd)$/i, "").toLowerCase();
  // basename (cmd.exe -> cmd, C:\Windows\System32\cmd.exe -> cmd)
  const base = bare.split(/[\\/]/).pop() ?? bare;
  return base;
}

/**
 * Whitelist decision: the policy returns
 *   - "deny"  -> hard-denied pattern, always refused (even if confirmed)
 *   - "allow" -> leading token is in the allow-list AND no hard-deny hit:
 *                safe to run silently (unless a askBefore rule matched,
 *                which upgrades it to "ask")
 *   - "ask"   -> NOT in the allow-list (or explicitly listed as askBefore):
 *                requires explicit human confirmation before running.
 */
export function decide(command: string, rules: PolicyRule[], allowCommands: string[]): PolicyDecision {
  // 1) hard-denies win over everything. Se prueban contra el comando tal cual
  // y contra una forma normalizada (espacios colapsados, "/s /q" -> "/s/q"):
  // HITO 2.5, las variantes de espaciado no deben degradar deny a ask.
  const normCmd = command.replace(/\s+/g, " ").replace(/\s+\//g, "/");
  for (const r of rules) {
    if (r.action === "deny" && (r.pattern.test(command) || r.pattern.test(normCmd))) {
      return { action: "deny", reason: r.reason, requireConfirm: false };
    }
  }
  // 1b) HITO 2.5: decodificadores .NET (siempre exec-adjacent). El límite
  // incluye ':' '.' '[' '(' porque llegan como [Convert]::FromBase64String.
  if (/(^|[\s;&|\[(:.])FromBase64String/i.test(command)) {
    return { action: "deny", reason: "bloqueado por politica: FromBase64String", requireConfirm: false };
  }
  // 1b) HITO 2.5: powershell/pwsh/cmd con flags cortos ofuscados (-e, -enc)
  // o iex en cualquier orden de flags: se deniega siempre.
  const head = leadingToken(command);
  if ((head === "powershell" || head === "pwsh" || head === "cmd") &&
      /(^|[\s;&|])(-e\b|-enc|iex\b|invoke-expression)/i.test(command)) {
    return { action: "deny", reason: "bloqueado por politica: payload codificado u ofuscado (powershell/cmd)", requireConfirm: false };
  }
  // 2) askBefore upgrade (still may run, but needs confirmation)
  for (const r of rules) {
    if (r.action === "ask" && r.pattern.test(command)) {
      return { action: "ask", reason: r.reason, requireConfirm: true };
    }
  }
  // 3) whitelist: leading token must be an explicitly allowed command.
  const token = leadingToken(command);
  if (token && allowCommands.includes(token)) {
    return { action: "allow", requireConfirm: false };
  }
  // 4) anything not explicitly allowed -> ask for confirmation (whitelist model).
  return { action: "ask", requireConfirm: true, reason: `comando no permitido por la lista blanca: "${token}"` };
}

export function isSensitivePath(path: string, policy: SandboxPolicy): boolean {
  const p = (path ?? "").toLowerCase();
  return policy.sensitivePaths.some((s) => s.length > 0 && p.includes(s.toLowerCase()));
}

export function definePolicy(p: Partial<SandboxPolicy>): SandboxPolicy {
  return {
    ...DEFAULT_POLICY,
    ...p,
    allowCommands: [...DEFAULT_POLICY.allowCommands, ...(p.allowCommands ?? [])],
    hardDeny: [...DEFAULT_POLICY.hardDeny, ...(p.hardDeny ?? [])],
    sensitivePaths: [...DEFAULT_POLICY.sensitivePaths, ...(p.sensitivePaths ?? [])],
  };
}

/**
 * Loads a project-specific policy from `<cwd>/.noira/policy.json` if present,
 * otherwise returns the default. Sensitive paths are defined PER PROJECT (e.g.
 * infra, secrets, trading bots) — never hardcoded in the binary.
 */
export async function loadProjectPolicy(cwd: string): Promise<SandboxPolicy> {
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const raw = await readFile(join(cwd, ".noira", "policy.json"), "utf8");
    const parsed = JSON.parse(raw) as Partial<SandboxPolicy>;
    return definePolicy(parsed);
  } catch {
    return { ...DEFAULT_POLICY };
  }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
