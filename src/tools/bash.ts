/**
 * Bash tool: runs commands through the OS sandbox + permission policy.
 */

import { resolve } from "node:path";
import type { ToolDefinition, ToolCallContext } from "./index.js";
import { params } from "./index.js";
import { sandboxedExec } from "../sandbox/sandbox.js";
import { compilePolicy, DEFAULT_POLICY, decide } from "../sandbox/policies.js";

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
      // Igual que files/*: las rutas relativas del modelo se resuelven contra
      // el cwd de la sesión, no contra el process.cwd() del lanzador.
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

      const timeoutMs = args.timeoutMs ?? 120000;

      // Quick-path echo to keep it deterministic and avoid quoting issues in
      // cross-platform environments while still going through the sandbox.
      // Use sandboxedExec for OS-level sandboxing on Linux/macOS.
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
      if (res.code !== 0) {
        return `[exit ${res.code}]\n${trimmedOut}${trimmedOut && trimmedErr ? "\n" : ""}${trimmedErr}`.slice(0, 12000);
      }
      return trimmedOut || trimmedErr || "[ok] (sin salida)";
    },
  };
}

export function gitToolName(): string {
  return "git";
}
