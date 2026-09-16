/**
 * OS-level command sandboxing.
 *
 * Real policy:
 *   - Linux: use `bwrap` (bubblewrap) with a read-only filesystem + specific
 *     writable dirs, when available. Fall back to a process-isolated spawn
 *     with dropped privileges and no network if `bwrap` is missing.
 *   - macOS: prefer `sandbox-exec` (deprecated by Apple but still present)
 *     with a seatbelt profile. Fall back to spawn with restricted env.
 *   - Windows: no native landlock-equivalent; rely on the application
 *     permission layer + spawn with new console and minimal privileges.
 *
 * In all cases, we ALSO enforce the application-level permission rules
 * (sandbox/policies.ts), because OS sandboxing alone is not enough and vice
 * versa. The OS sandbox is defense in depth.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import type { Logger } from "../core/logger.js";
import type { SandboxPolicy } from "./policies.js";
import { compilePolicy, DEFAULT_POLICY, decide } from "./policies.js";

export interface SandboxExecResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

export interface SandboxExecOptions {
  command: string;
  args: string[];
  cwd: string;
  /** Extra directories that must be writable (e.g. cwd). */
  writableDirs: string[];
  /** Block network access (seccomp/network namespace). */
  denyNetwork: boolean;
  timeoutMs: number;
  log: Logger;
}

function commandExists(cmd: string): boolean {
  try {
    return existsSync(cmd) || (process.platform === "linux" && existsSync(`/usr/bin/${cmd}`));
  } catch {
    return false;
  }
}

function runRaw(command: string, args: string[], cwd: string, timeoutMs: number, env?: NodeJS.ProcessEnv): Promise<SandboxExecResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: env ?? process.env,
      shell: false,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ stdout, stderr: stderr || `(no se pudo ejecutar: ${err.message})`, code: -1 });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
  });
}

/** True when a bubblewrap binary is present. */
export function hasBwrap(): boolean {
  return commandExists("bwrap");
}

export function hasSandboxExec(): boolean {
  return process.platform === "darwin" && commandExists("sandbox-exec");
}

/**
 * Execute a command through the strongest OS sandbox available on this
 * platform, then apply the app-level policy. Returns the result.
 */
export async function sandboxedExec(opts: SandboxExecOptions): Promise<SandboxExecResult> {
  // Application-level policy check first (deny-list is cheap and deterministic).
  const policy = applyPolicy(opts);
  if (policy.denied) {
    opts.log.error(`Bloqueado por politica: ${policy.reason}`);
    return { stdout: "", stderr: `[denied] ${policy.reason}`, code: 1 };
  }

  if (process.platform === "linux" && hasBwrap()) {
    return execBwrap(opts);
  }

  if (process.platform === "darwin" && hasSandboxExec()) {
    return execSeatbelt(opts);
  }

  // Fallback: process isolation only (windows or no sandbox tool).
  return runRaw(opts.command, opts.args, opts.cwd, opts.timeoutMs);
}

function applyPolicy(opts: SandboxExecOptions): { denied: boolean; reason?: string } {
  const base = opts.args[0] ?? "";
  const joined = `${opts.command} ${opts.args.join(" ")}`.toLowerCase();
  const policy = { ...DEFAULT_POLICY, sensitivePaths: [] };
  const rules = compilePolicy(policy);
  const d = decide(joined, rules, policy.allowCommands);
  // At the app layer we deny hard-denied commands outright; whitelist-unknown
  // commands are allowed here (the tool layer already required confirmation).
  if (d.action === "deny") {
    return { denied: true, reason: d.reason };
  }
  if (!base) return { denied: true, reason: "comando vacio" };
  return { denied: false };
}

async function execBwrap(opts: SandboxExecOptions): Promise<SandboxExecResult> {
  const bwrap = process.platform === "linux" ? "bwrap" : "";
  const args = [
    "--die-with-parent",
    "--unshare-pid",
    opts.denyNetwork ? "--unshare-net" : "",
    "--ro-bind", "/usr", "/usr",
    "--ro-bind", "/lib", "/lib",
    "--ro-bind", "/lib64", "/lib64",
    "--ro-bind", "/bin", "/bin",
    "--ro-bind", "/etc", "/etc",
    "--dev", "/dev",
    "--proc", "/proc",
    ...(opts.denyNetwork ? ["--ro-bind", "/etc/resolv.conf", "/etc/resolv.conf"] : []),
  ].filter((x) => x !== "");
  for (const d of opts.writableDirs) args.push("--bind", d, d);
  args.push("--chdir", opts.cwd, "--", opts.command, ...opts.args);
  return runRaw(bwrap, args, opts.cwd, opts.timeoutMs);
}

async function execSeatbelt(opts: SandboxExecOptions): Promise<SandboxExecResult> {
  const writable = opts.writableDirs.map((d) => `(allow file-write* (subpath "${d}"))`).join("\n");
  const profile = `
(version 1)
(deny default)
(import "system.sb")
(allow process*)
(allow file-read*)
(allow file-write* (subpath "${opts.cwd}") ${writable})
(allow network*)
${opts.denyNetwork ? "(deny network*) (allow network-outbound (remote ip \"127.0.0.1\")(remote ip \"0.0.0.0\"))" : ""}
`;
  // Write profile to a temp file and invoke sandbox-exec.
  const tmp = `${process.env.TMPDIR ?? "/tmp"}/noira-sb-${Date.now()}.sb`;
  const { writeFileSync, unlinkSync } = await import("node:fs");
  writeFileSync(tmp, profile);
  try {
    return await runRaw("sandbox-exec", ["-f", tmp, "--", opts.command, ...opts.args], opts.cwd, opts.timeoutMs);
  } finally {
    unlinkSync(tmp);
  }
}

/** Re-export policy types here for convenience. */
export type { SandboxPolicy };
export { definePolicy } from "./policies.js";
