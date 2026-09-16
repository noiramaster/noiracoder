/**
 * LSP diagnostics tool — lee errores del lenguaje sin ejecutar build completo.
 * Usa `tsc --noEmit`, `go vet`, `cargo check` según stack detectado.
 *
 * Windows-safe: no usa pipes Unix (`| head`) que rompen en cmd.exe; trunca
 * la salida en JavaScript.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ToolDefinition, ToolCallContext } from "./index.js";
import { params } from "./index.js";

const execFileP = promisify(execFile);

/** Resolve a command and its args, platform-aware, without Unix pipes. */
function stackCommand(cwd: string): { cmd: string; args: string[]; shell: boolean } | null {
  if (existsSync(join(cwd, "tsconfig.json"))) {
    return { cmd: process.platform === "win32" ? "npx.cmd" : "npx", args: ["tsc", "--noEmit", "--pretty", "false"], shell: false };
  }
  if (existsSync(join(cwd, "go.mod"))) {
    return { cmd: "go", args: ["vet", "./..."], shell: false };
  }
  if (existsSync(join(cwd, "Cargo.toml"))) {
    return { cmd: "cargo", args: ["check"], shell: false };
  }
  if (existsSync(join(cwd, "pyproject.toml"))) {
    return { cmd: process.platform === "win32" ? "python.exe" : "python", args: ["-m", "py_compile"], shell: false };
  }
  return null;
}

export function diagnosticsTool(): ToolDefinition<{ path?: string }> {
  return {
    name: "diagnostics",
    description: "Lee diagnósticos LSP (errores de tipos, sintaxis) del proyecto sin ejecutar. Útil para verificar antes de entregar.",
    parameters: params({ path: { type: "string", description: "Archivo o dir (default: cwd)" } }),
    async handler(_args, ctx) {
      const cwd = ctx.cwd;
      const stack = stackCommand(cwd);
      if (!stack) return "[ok] sin diagnósticos (stack no detectado, usa bash para check manual)";
      try {
        const { stdout, stderr } = await execFileP(stack.cmd, stack.args, { cwd, timeout: 15000, shell: stack.shell });
        const out = ((stdout ?? "") + (stderr ?? "")).trim();
        if (!out) return "[ok] 0 diagnósticos";
        return out.slice(0, 8000);
      } catch (e: unknown) {
        // execFile rejects on non-zero exit; stderr/stdout carry the diagnostics.
        const err = e as { stdout?: string; stderr?: string; message?: string };
        const out = ((err.stdout ?? "") + (err.stderr ?? "") + (err.message ?? "")).trim();
        return out.slice(0, 8000) || "[ok] 0 diagnósticos";
      }
    },
  };
}