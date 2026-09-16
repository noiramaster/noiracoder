/**
 * Headless server exposing the same orchestrate() API the CLI uses.
 * This is the "client-server native" architecture: a future web UI consumes
 * the exact same endpoint as the terminal. Minimal stdlib HTTP server.
 */

import { createServer, type Server } from "node:http";
import { randomBytes } from "node:crypto";
import type { Level } from "../types.js";
import type { Logger } from "../core/logger.js";
import { orchestrate } from "../agents/orchestrator.js";
import { confirm } from "../sandbox/approve.js";
import type { McpRegistry } from "../mcp/registry.js";

export interface ServerOptions {
  port: number;
  log: Logger;
  level: Level;
  lang: string;
  /** Bearer token required on every request (except /health). Defaults to a random one. */
  authToken?: string;
  /** Connected MCP registry (optional). */
  mcp?: McpRegistry;
  /** Confirmación no-bloqueante (el servidor nunca debe esperar stdin). */
  confirm?: (msg: string) => Promise<boolean>;
}

/**
 * Security: the server binds ONLY to 127.0.0.1 (loopback) so no one on the
 * network can reach it, and requires a per-server Bearer token on every
 * code-executing request. Without the token, nothing runs.
 */
const HOST = "127.0.0.1";

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export async function startServer(opts: ServerOptions): Promise<number> {
  const authToken = opts.authToken ?? (process.env.NOIRA_SERVE_TOKEN || generateToken());
  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const json = (code: number, body: unknown) => {
      res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(body));
    };

    // Health endpoint is intentionally unauthenticated (process/port liveness).
    if (req.method === "GET" && url.pathname === "/health") {
      json(200, { ok: true, app: "noiracoder", level: opts.level });
      return;
    }

    // ── Auth: every other request must carry a valid Bearer token. ──
    const authz = (req.headers.authorization ?? "").trim();
    const token = authz.startsWith("Bearer ") ? authz.slice("Bearer ".length) : "";
    const { safeEqual } = await import("../auth/crypto.js");
    if (!token || !safeEqual(token, authToken)) {
      res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "no autorizado: falta token Bearer valido" }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/session") {
      let body = "";
      for await (const chunk of req) body += chunk;
      let prompt: string;
      let level: Level = opts.level;
      try {
        const parsed = JSON.parse(body);
        prompt = typeof parsed.prompt === "string" ? parsed.prompt : "";
        if (["low", "medium", "high", "max"].includes(parsed.level)) level = parsed.level;
      } catch {
        json(400, { error: "JSON invalido" });
        return;
      }
      if (!prompt) {
        json(400, { error: "campo 'prompt' requerido" });
        return;
      }
      try {
        const result = await orchestrate(prompt, {
          level,
          cwd: process.cwd(),
          log: opts.log,
          confirm: opts.confirm ?? confirm,
          freeOnly: true,
          lang: opts.lang,
          mcp: opts.mcp,
        });
        json(200, { output: result.output, steps: result.steps, level });
      } catch (e) {
        json(500, { error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }

    json(404, { error: "no encontrado" });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port, HOST, () => resolve());
  });

  opts.log.ok(`Noira server escuchando en http://${HOST}:${opts.port} (solo loopback)`);
  opts.log.raw(`[auth] Token de acceso (Bearer): ${authToken}`);
  opts.log.raw(`[auth] Cada request (salvo /health) debe incluir: Authorization: Bearer ${authToken}`);
  return 0;
}
