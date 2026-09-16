/**
 * Git tool: common git operations with mandatory confirmation for push.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ToolDefinition, ToolCallContext } from "./index.js";
import { params } from "./index.js";

const execFileP = promisify(execFile);

interface GitArgs {
  args: string[];
  cwd?: string;
}

const NEEDS_CONFIRM = ["push", "commit --amend", "reset --hard", "rebase"];

export function gitTool(): ToolDefinition<GitArgs> {
  return {
    name: "git",
    description:
      "Ejecuta 'git <args>'. Las operaciones peligrosas (push, commit --amend, reset --hard, rebase) requieren confirmacion explicita.",
    parameters: params({
      args: { type: "array", description: "Argumentos de git, p.ej. ['status'] o ['commit','-am','msg']" },
      cwd: { type: "string", description: "Directorio (default: cwd de la sesion)" },
    }),
    async handler(args: GitArgs, ctx: ToolCallContext) {
      const cwd = args.cwd ?? ctx.cwd;
      const joined = args.args.join(" ");

      // Confirmation for destructive git actions.
      if (NEEDS_CONFIRM.some((c) => joined.includes(c))) {
        const ok = await ctx.confirm(`git ${joined}\nEsta operacion no es reversible. [y/N]`);
        if (!ok) return "[cancel] operacion git no confirmada";
      }

      // 60s + sin prompt de credenciales: un `git push` pidiendo login
      // dejaría al agente colgado para siempre sin mostrar nada.
      const { stdout, stderr } = await execFileP("git", ["-c", "credential.helper=", ...args.args], {
        cwd,
        maxBuffer: 10 * 1024 * 1024,
        timeout: 60_000,
      }).catch((e) => ({
        stdout: "",
        stderr: e?.killed ? "[error] git tardó más de 60s (¿pedía credenciales?)." : (e?.stderr ?? e?.message ?? String(e)),
      }));
      const out = (stdout || "").trim();
      const err = (stderr || "").trim();
      if (!out && !err) return "[ok] git sin salida";
      return `${out}${out && err ? "\n" : ""}${err}`.slice(0, 12000);
    },
  };
}
