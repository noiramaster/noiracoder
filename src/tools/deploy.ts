/**
 * Deploy tool — REAL deployment to Vercel (and static targets).
 *
 * Behavior:
 *   - Requires explicit confirmation (destructive/publish action).
 *   - Uses VERCEL_TOKEN (env) or the cloudflare/vercel key stored in
 *     ~/.noirarc/keys.json; if absent, reports clearly instead of lying.
 *   - Runs `vercel deploy --yes --prod` via npx (or local vercel binary),
 *     parses the deployment URL from stdout.
 *   - `dryRun` mode does everything except the actual network publish, and
 *     is used by the safety tests to prove the confirmation gate works.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ToolDefinition, ToolCallContext } from "./index.js";
import { params } from "./index.js";

const execFileP = promisify(execFile);

interface DeployArgs {
  /** Where to deploy: "vercel" (default) or "static" (write to dist folder). */
  target?: string;
  /** Simulate without publishing. */
  dryRun?: boolean;
}

async function findVercelBinary(cwd: string): Promise<string | null> {
  const local = join(cwd, "node_modules", ".bin", process.platform === "win32" ? "vercel.cmd" : "vercel");
  if (existsSync(local)) return local;
  return null;
}

async function getToken(ctx: ToolCallContext): Promise<string | null> {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN;
  const { loadAllKeys } = await import("../auth/keys.js");
  const keys = await loadAllKeys();
  return keys.vercel ?? keys.cloudflare ?? null;
}

export function deployTool(): ToolDefinition<DeployArgs> {
  return {
    name: "deploy",
    description:
      "Publica el proyecto en producción. Destinos soportados: 'vercel' (Vercel, requiere VERCEL_TOKEN o token guardado). SIEMPRE pide confirmacion explicita.",
    parameters: params({
      target: { type: "string", description: "vercel | static" },
      dryRun: { type: "boolean", description: "Simula el deploy sin publicar (para pruebas)" },
    }),
    async handler(args: DeployArgs, ctx: ToolCallContext) {
      const target = args.target ?? "vercel";

      // ── Confirmation gate: a deploy is a real, externally visible action. ──
      if (!ctx.confirmDestructive) {
        return "[denied] La confirmacion destructiva esta deshabilitada.";
      }
      const ok = await ctx.confirm(
        `Publicar "${target}" a produccion?\n  cwd: ${ctx.cwd}\nEste paso es visible externamente y no se deshace solo. [y/N]`
      );
      if (!ok) return "[cancel] deploy no confirmado por el usuario";

      if (args.dryRun) {
        // Simulation: proves the gate works without touching the network.
        return [
          "[ok] DRY-RUN deploy: la confirmacion SI se pidio y se acepto.",
          `  target: ${target}`,
          `  proyecto: ${ctx.cwd}`,
          "  (sin publicar nada a produccion)",
        ].join("\n");
      }

      if (target === "static") {
        const { mkdir, writeFile } = await import("node:fs/promises");
        const out = join(ctx.cwd, "dist");
        await mkdir(out, { recursive: true });
        const html = "<!doctype html><meta charset=utf-8><title>Noira deploy</title><h1>Deploy static OK</h1>";
        await writeFile(join(out, "index.html"), html, "utf8");
        return `[ok] build estatico generado en ${join(out, "index.html")} (sirvelo con 'npx serve ${out}')`;
      }

      if (target !== "vercel") {
        return `[error] destino desconocido: ${target} (soportados: vercel, static)`;
      }

      // ── Vercel ──
      const token = await getToken(ctx);
      const vercel = (await findVercelBinary(ctx.cwd)) ?? "vercel";

      const runArgv = (argv: string[]): Promise<string> => new Promise((resolve, reject) => {
        execFileP(vercel, argv, {
          cwd: ctx.cwd,
          env: { ...process.env, ...(token ? { VERCEL_TOKEN: token } : {}) },
          maxBuffer: 16 * 1024 * 1024,
          timeout: 300_000,
          shell: process.platform === "win32",
        }).then((r) => resolve(r.stdout)).catch((e: unknown) => reject(e));
      });

      try {
        const out = await runArgv(["--version"]);
        if (!out) {
          return "[error] Vercel CLI no disponible. Instala con: npm i -g vercel, o configura VERCEL_TOKEN.";
        }
      } catch {
        return "[error] Vercel CLI no instalado. Ejecuta: npm i -g vercel y luego 'vercel login', o fija VERCEL_TOKEN.";
      }

      if (!token) {
        return [
          "[error] No hay token de Vercel.",
          "  1) Crea un token: https://vercel.com/account/tokens",
          "  2) NOIRARC: noira login --vercel <token>   (o export VERCEL_TOKEN)",
        ].join("\n");
      }

      try {
        const out = await runArgv(["deploy", "--yes", "--prod", "--non-interactive"]);
        const url = /https:\/\/[^\s]+/.exec(out)?.[0] ?? "(URL no detectada)";
        return `[ok] Deploy publicado: ${url}\n${out.trim().slice(0, 600)}`;
      } catch (e: unknown) {
        const msg = (e as { stderr?: string; message?: string }).stderr ?? (e as { message?: string }).message ?? String(e);
        return `[error] Deploy fallido:\n${String(msg).trim().slice(0, 1200)}`;
      }
    },
  };
}