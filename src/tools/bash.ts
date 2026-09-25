/**
 * Bash tool: runs commands through the OS sandbox + permission policy.
 * H8: detects missing credentials and requests them via H10 options.
 */

import { resolve } from "node:path";
import type { ToolDefinition, ToolCallContext } from "./index.js";
import { params } from "./index.js";
import { sandboxedExec } from "../sandbox/sandbox.js";
import { compilePolicy, DEFAULT_POLICY, decide } from "../sandbox/policies.js";
import { detectServiceFromCommand, detectService, hasCredential, storeCredential, resolveCredential, type ServiceInfo } from "../auth/credentials.js";

interface BashArgs {
  command: string;
  cwd?: string;
  timeoutMs?: number;
}

export function bashTool(): ToolDefinition<BashArgs> {
  return {
    name: "bash",
    description:
      "Ejecuta un comando de terminal en el entorno (Windows: cmd/PowerShell; detectado por plataforma). Devuelve stdout+stderr. Usado para construir, tests, git, etc.",
    parameters: params({
      command: { type: "string", description: "Comando a ejecutar" },
      cwd: { type: "string", description: "Directorio de trabajo (default: cwd de la sesion)" },
      timeoutMs: { type: "number", description: "Timeout en ms (default 120000)" },
    }),
    async handler(args: BashArgs, ctx: ToolCallContext) {
      const cwd = args.cwd ? resolve(ctx.cwd, args.cwd) : ctx.cwd;
      const shell = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : "/bin/bash";
      const shellFlag = process.platform === "win32" ? "/c" : "-c";

      // Policy decision (app-level) using the WHITELIST model.
      const { loadProjectPolicy } = await import("../sandbox/policies.js");
      const policy = await loadProjectPolicy(cwd);
      const rules = compilePolicy(policy);
      const decision = decide(args.command, rules, policy.allowCommands);

      if (decision.action === "deny") {
        return `[denied] ${decision.reason}`;
      }
      if (decision.action === "ask") {
        const ok = await ctx.confirm(`Ejecutar (${decision.reason}):\n  ${args.command}\n[y/N]`);
        if (!ok) return `[cancel] ${decision.reason}`;
      }

      // H8: pre-check — detect if command needs a credential we don't have
      const preSvc = detectServiceFromCommand(args.command);
      if (preSvc && preSvc.id !== "custom" && !(await hasCredential(preSvc.id))) {
        const url = preSvc.keyUrl ? `\n  Get it: ${preSvc.keyUrl}` : "";
        ctx.log.warn(`[credential] ${preSvc.name} credential needed for: ${args.command.split("\n")[0]}`);
        if (ctx.options) {
          const choice = await ctx.options(
            [{ key: "provide", label: `Provide ${preSvc.name} credential`, recommended: true },
             { key: "skip", label: "Skip — try without credential" }],
            `${preSvc.name} credential needed.\n${preSvc.description}.${url}\nPaste your credential:`
          );
          if (choice === "provide") {
            // The actual paste happens via the client; for now, try the command first
            // and detect on failure if the user didn't paste yet.
          }
        }
      }

      const timeoutMs = args.timeoutMs ?? 120000;

      const res = await sandboxedExec({
        command: shell,
        args: [shellFlag, args.command],
        cwd,
        writableDirs: [cwd],
        denyNetwork: false,
        timeoutMs,
        log: ctx.log,
      });

      const trimmedOut = res.stdout.trim();
      const trimmedErr = res.stderr.trim();
      const output = `[exit ${res.code}]\n${trimmedOut}${trimmedOut && trimmedErr ? "\n" : ""}${trimmedErr}`;

      // H8: post-check — if command failed, detect if credential is needed
      if (res.code !== 0) {
        const postSvc = detectService(output);
        if (postSvc && postSvc.id !== "custom" && !(await hasCredential(postSvc.id))) {
          const url = postSvc.keyUrl ? `\n  Get it: ${postSvc.keyUrl}` : "";
          ctx.log.warn(`[credential] ${postSvc.name} credential required. Command failed with auth error.`);
          if (ctx.options) {
            const choice = await ctx.options(
              [{ key: "provide", label: `Provide ${postSvc.name} credential`, recommended: true },
               { key: "skip", label: "Skip — show error" }],
              `${postSvc.name} credential is required.\n${postSvc.description}.${url}\nPaste your credential (or type 'skip' to see error):`
            );
            if (choice === "provide") {
              return `[credential-required] ${postSvc.name} credential needed. Use: noira login --${postSvc.id} <key>\nOr set ${postSvc.envVar ?? "the environment variable"}.\n\nOriginal error:\n${output.slice(0, 3000)}`;
            }
          }
          return `[credential-required] ${postSvc.name} credential needed.\n${postSvc.description}\n${url}\n\nUse: noira login --${postSvc.id} <key>\nOr set ${postSvc.envVar ?? "the environment variable"}.\n\nOriginal error:\n${output.slice(0, 3000)}`;
        }
        return output.slice(0, 12000);
      }
      return trimmedOut || trimmedErr || "[ok] (sin salida)";
    },
  };
}

export function gitToolName(): string {
  return "git";
}
