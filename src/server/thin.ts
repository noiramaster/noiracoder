/**
 * HITO 1 — Servidor delgado para la pantalla Go (cliente fino).
 * Implementa docs/PROTOCOL.md v1: SSE + turnos + confirmaciones remotas +
 * sesiones + modelos + undo/redo. El motor TS sigue siendo el único cerebro.
 *
 * Se arranca con: noira serve --thin [--port P] [--token T]
 * (token también vía NOIRA_SERVE_TOKEN; si falta, aleatorio por arranque).
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import type { Level } from "../types.js";
import type { Logger } from "../core/logger.js";
import { orchestrate } from "../agents/orchestrator.js";
import type { McpRegistry } from "../mcp/registry.js";
import { SessionStore } from "../memory/sessions.js";
import { doUndo, doRedo } from "../tools/undoSnapshot.js";
import { DEFAULT_POLICY } from "../sandbox/policies.js";

export const THIN_PROTOCOL = 1;
const HOST = "127.0.0.1";
const CONFIRM_TIMEOUT_MS = 120000;
const TURN_NO_EVENT_TIMEOUT_MS = 60000;
const MAX_BODY_BYTES = 1024 * 1024;

export interface ThinServerOptions {
  port: number;
  log: Logger;
  level: Level;
  lang: string;
  authToken?: string;
  mcp?: McpRegistry;
}

interface PendingConfirm {
  resolve: (approved: boolean) => void;
  settled: boolean;
  timer: NodeJS.Timeout;
}

interface ActiveTurn {
  id: string;
  sessionId: string;
  abort: AbortController;
  lastEventAt: number;
  /** Una herramienta en curso puede tardar (bash hasta 10 min): el watchdog
     le da margen desde su inicio, no desde el último token. */
  lastToolStartAt: number;
}

export async function startThinServer(opts: ThinServerOptions): Promise<{ close: () => Promise<void> }> {
  const authToken = opts.authToken ?? process.env.NOIRA_SERVE_TOKEN ?? randomBytes(32).toString("hex");
  const store = new SessionStore(process.cwd());
  let sse: ServerResponse | null = null;
  let activeTurn: ActiveTurn | null = null;
  let preferredModel: string | undefined;
  const pendingConfirms = new Map<string, PendingConfirm>();

  const send = (event: string, data: unknown) => {
    if (!sse || sse.writableEnded) return false;
    try {
      sse.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      return true;
    } catch {
      return false;
    }
  };

  const json = (res: ServerResponse, code: number, body: unknown) => {
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(body));
  };

  const readBody = (req: IncomingMessage): Promise<string> =>
    new Promise((resolve, reject) => {
      let size = 0;
      let body = "";
      req.on("data", (c: Buffer) => {
        size += c.length;
        if (size > MAX_BODY_BYTES) {
          reject(new Error("cuerpo demasiado grande (máx 1MB)"));
          req.destroy();
          return;
        }
        body += c.toString("utf8");
      });
      req.on("end", () => resolve(body));
      req.on("error", reject);
    });

  const checkVersion = (req: IncomingMessage): boolean => {
    const h = (req.headers["x-noira-protocol"] as string) ?? "";
    if (h === String(THIN_PROTOCOL)) return true;
    const url = new URL(req.url ?? "/", "http://localhost");
    return url.searchParams.get("protocol") === String(THIN_PROTOCOL);
  };

  const smartName = (message: string): string => {
    const words = message.replace(/\s+/g, " ").trim().split(" ").slice(0, 8).join(" ");
    return words.slice(0, 60) || "nueva sesión";
  };

  // HITO 2.1: saneo mínimo en el motor (la Go vuelve a sanear al pintar).
  // Corpus completo + pruebas en Hito 2.4.
  const sanitizeOut = (s: string): string =>
    String(s)
      .replace(/\][^\x07\\]*(?:\x07|\\)/g, "")
      .replace(/\[[0-9;?]*[a-zA-Z]/g, "")
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
      .slice(0, 2000);

  const resolveConfirm = (id: string, approved: boolean, why: string) => {
    const p = pendingConfirms.get(id);
    if (!p || p.settled) {
      opts.log.warn(`[thin] confirm tardía/duplicada ignorada: ${id} (${why})`);
      return false;
    }
    p.settled = true;
    clearTimeout(p.timer);
    pendingConfirms.delete(id);
    send("confirm.result", { confirmId: id, aprobado: approved, motivo: why });
    p.resolve(approved);
    return true;
  };

  const runTurn = async (turnId: string, sessionId: string, message: string, mode: string) => {
    const abort = new AbortController();
    activeTurn = { id: turnId, sessionId, abort, lastEventAt: Date.now(), lastToolStartAt: 0 };
    const touch = () => {
      if (activeTurn?.id === turnId) activeTurn.lastEventAt = Date.now();
    };
    let fullText = "";
    // Modo Plan: TODO se deniega (además la política se endurece abajo).
    const planMode = mode === "plan";

    const remoteConfirm = async (msg: string): Promise<boolean> => {
      const detail = msg.split("\n")[0].slice(0, 500);
      if (planMode) {
        const cid = randomUUID();
        send("confirm.request", { confirmId: cid, accion: "plan-readonly", detalle: detail, timeoutMs: 0 });
        send("confirm.result", { confirmId: cid, aprobado: false, motivo: "modo plan (solo lectura)" });
        opts.log.warn(`[thin] denegado por modo plan: ${detail}`);
        return false;
      }
      if (!sse || sse.writableEnded) {
        opts.log.warn(`[thin] confirm sin cliente → denegado: ${detail}`);
        return false;
      }
      const confirmId = randomUUID();
      send("confirm.request", { confirmId, accion: "ejecutar", detalle: detail, timeoutMs: CONFIRM_TIMEOUT_MS });
      return new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          resolveConfirm(confirmId, false, "timeout 120s");
        }, CONFIRM_TIMEOUT_MS);
        // setTimeout sin ref en algunos runtimes; guarda y limpia igual.
        (timer as unknown as { unref?: () => void }).unref?.();
        pendingConfirms.set(confirmId, { resolve, settled: false, timer });
      });
    };

    try {
      const metas = await store.list();
      const meta = metas.find((m) => m.id === sessionId);
      if (!meta) {
        send("turn.error", { turnId, mensaje: "sesión no encontrada" });
        send("turn.end", { turnId, motivo: "error" });
        activeTurn = null;
        return;
      }
      await store.append(meta, "user", message);

      const policy = planMode
        ? { ...DEFAULT_POLICY, allowCommands: [] as string[] }
        : undefined;

      const result = await orchestrate(message, {
        level: opts.level,
        cwd: process.cwd(),
        log: opts.log,
        confirm: remoteConfirm,
        freeOnly: true,
        lang: opts.lang,
        mcp: opts.mcp,
        signal: abort.signal,
        model: preferredModel,
        policy,
        onToken: (d) => {
          touch();
          fullText += d;
          send("turn.text", { turnId, delta: d });
        },
        onModelSwitch: (from, to, reason) => {
          touch();
          send("model.switch", { turnId, de: from, a: to, motivo: reason });
        },
        onToolEvent: (ev) => {
          touch();
          if (ev.phase === "start") {
            if (activeTurn?.id === turnId) activeTurn.lastToolStartAt = Date.now();
            send("turn.tool_start", { turnId, nombre: ev.name, detalle: ev.preview });
          } else {
            send("turn.tool_end", {
              turnId,
              nombre: ev.name,
              exitCode: ev.error ? 1 : 0,
              salida: sanitizeOut(ev.preview),
              ms: ev.ms ?? null,
            });
          }
        },
        onModelErrorExt: (m, kind) => {
          touch();
          opts.log.warn(`[thin] modelo ${m} falló (${kind}), rotando…`);
        },
      });
      await store.append(meta, "assistant", result.output || "(sin salida)");
      send("session.updated", { id: meta.id, nombre: meta.title });
      send("turn.end", { turnId, motivo: "done" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (abort.signal.aborted || msg.includes("cancelado")) {
        send("turn.end", { turnId, motivo: "cancelled" });
      } else {
        send("turn.error", { turnId, mensaje: msg.slice(0, 500) });
        send("turn.end", { turnId, motivo: "error" });
      }
    } finally {
      if (activeTurn?.id === turnId) activeTurn = null;
    }
  };

  // Vigilante: turno sin eventos > 60 s → error + libera (nunca silencio).
  // Si hay herramienta en curso, margen hasta 10 min desde su inicio.
  const watchdog = setInterval(() => {
    if (!activeTurn) return;
    const idleMs = Date.now() - activeTurn.lastEventAt;
    const toolMs = Date.now() - (activeTurn.lastToolStartAt || activeTurn.lastEventAt);
    if (idleMs <= TURN_NO_EVENT_TIMEOUT_MS) return;
    if (activeTurn.lastToolStartAt > 0 && toolMs <= 600000) return;
      const id = activeTurn.id;
      activeTurn.abort.abort();
      send("turn.error", { turnId: id, mensaje: "timeout: 60 s sin eventos del motor" });
      send("turn.end", { turnId: id, motivo: "error" });
      activeTurn = null;
  }, 5000);
  (watchdog as unknown as { unref?: () => void }).unref?.();

  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (req.method === "GET" && url.pathname === "/health") {
      json(res, 200, { ok: true, app: "noiracoder", protocol: THIN_PROTOCOL, engine: "node-ts" });
      return;
    }

    // Auth Bearer en todo lo demás (comparación timing-safe).
    const authz = (req.headers.authorization ?? "").trim();
    const token = authz.startsWith("Bearer ") ? authz.slice("Bearer ".length) : "";
    const { safeEqual } = await import("../auth/crypto.js");
    if (!token || !safeEqual(token, authToken)) {
      json(res, 401, { error: "no autorizado: falta token Bearer válido" });
      return;
    }
    if (!checkVersion(req)) {
      json(res, 426, { error: `protocolo distinto: el motor habla v${THIN_PROTOCOL}`, protocol: THIN_PROTOCOL });
      return;
    }

    // ── SSE (un solo cliente) ──
    if (req.method === "GET" && url.pathname === "/v1/events") {
      if (sse && !sse.writableEnded) {
        json(res, 409, { error: "ya hay un cliente conectado" });
        return;
      }
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(": conectado\n\n");
      sse = res;
      send("hello", { protocol: THIN_PROTOCOL, motor: "node-ts", modelo: preferredModel ?? "(router)" });
      const hb = setInterval(() => {
        try {
          res.write(": ping\n\n");
        } catch { /* cliente caído; lo detecta 'close' */ }
      }, 15000);
      (hb as unknown as { unref?: () => void }).unref?.();
      req.on("close", () => {
        clearInterval(hb);
        if (sse === res) sse = null;
        // Cerrar el stream cancela el turno en curso (sin huérfanos lógicos).
        if (activeTurn) {
          const id = activeTurn.id;
          activeTurn.abort.abort();
          activeTurn = null;
          try {
            res.end();
          } catch { /* ya cerrado */ }
          opts.log.warn(`[thin] stream cerrado por el cliente; turno ${id} cancelado`);
        }
      });
      return;
    }

    // ── Modelos ──
    if (req.method === "GET" && url.pathname === "/v1/models") {
      try {
        const { loadAllKeys } = await import("../auth/keys.js");
        const { buildProviderPool, fetchMergedCatalog } = await import("../models/providers/index.js");
        const { loadCatalog } = await import("../models/catalog.js");
        const keys = await loadAllKeys();
        const pool = buildProviderPool(keys);
        const catalog = await loadCatalog({
          fetch: async () => {
            if (pool.length > 1) {
              try {
                const merged = await fetchMergedCatalog(pool);
                if (merged.models.length > 0) {
                  return {
                    models: merged.models,
                    providersById: Object.fromEntries(merged.providersById),
                    freeByProvider: Object.fromEntries(
                      [...merged.freeByProvider].map(([k, v]) => [k, Object.fromEntries(v)]),
                    ),
                  };
                }
              } catch { /* cae al catálogo local */ }
            }
            return { models: [] };
          },
        });
        const have = (p?: string) => (p ? Boolean((keys as Record<string, unknown>)[p]) : false);
        json(res, 200, {
          modelos: catalog.models.map((m) => ({
            id: m.id,
            proveedor: m.provider ?? "openrouter",
            gratis: m.free === true,
            disponible: have(m.provider),
          })),
          preferido: preferredModel ?? null,
        });
      } catch (e) {
        json(res, 500, { error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/model") {
      try {
        const parsed = JSON.parse(await readBody(req)) as { id?: string };
        if (!parsed.id) {
          json(res, 400, { error: "campo 'id' requerido" });
          return;
        }
        preferredModel = parsed.id;
        send("model.switch", { turnId: null, de: "(router)", a: parsed.id, motivo: "manual" });
        json(res, 200, { ok: true, preferido: preferredModel });
      } catch (e) {
        json(res, 400, { error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }

    // ── Sesiones ──
    if (req.method === "GET" && url.pathname === "/v1/sessions") {
      const metas = await store.list();
      json(res, 200, {
        sesiones: metas.map((m) => ({
          id: m.id,
          nombre: m.title,
          updatedAt: m.updatedAt,
          turnos: m.turns.length,
        })),
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/sessions") {
      try {
        const parsed = JSON.parse(await readBody(req)) as { nombre?: string };
        const meta = await store.create(opts.level, process.cwd(), parsed.nombre);
        json(res, 200, { id: meta.id, nombre: meta.title });
      } catch (e) {
        json(res, 400, { error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }

    // ── Turno ──
    if (req.method === "POST" && url.pathname === "/v1/turn") {
      if (activeTurn) {
        json(res, 409, { error: "ya hay un turno en curso", turnId: activeTurn.id });
        return;
      }
      try {
        const parsed = JSON.parse(await readBody(req)) as {
          sessionId?: string;
          message?: string;
          mode?: string;
        };
        const message = (parsed.message ?? "").trim();
        if (!message) {
          json(res, 400, { error: "campo 'message' requerido" });
          return;
        }
        const mode = parsed.mode === "plan" ? "plan" : "build";
        let sessionId = parsed.sessionId;
        if (sessionId) {
          const metas = await store.list();
          if (!metas.some((m) => m.id === sessionId)) {
            json(res, 404, { error: "sesión no encontrada" });
            return;
          }
        } else {
          const meta = await store.create(opts.level, process.cwd(), smartName(message));
          sessionId = meta.id;
        }
        const turnId = randomUUID();
        json(res, 202, { turnId, sessionId });
        void runTurn(turnId, sessionId, message, mode);
      } catch (e) {
        json(res, 400, { error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/confirm") {
      try {
        const parsed = JSON.parse(await readBody(req)) as { confirmId?: string; aprobado?: boolean };
        if (!parsed.confirmId) {
          json(res, 400, { error: "campo 'confirmId' requerido" });
          return;
        }
        const ok = resolveConfirm(parsed.confirmId, parsed.aprobado === true, "cliente");
        json(res, 200, { ok, aplicada: ok });
      } catch (e) {
        json(res, 400, { error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/cancel") {
      try {
        const parsed = JSON.parse(await readBody(req)) as { turnId?: string };
        if (activeTurn && (!parsed.turnId || parsed.turnId === activeTurn.id)) {
          activeTurn.abort.abort();
          json(res, 200, { ok: true, cancelado: activeTurn.id });
          return;
        }
        json(res, 404, { error: "no hay turno en curso con ese id" });
      } catch (e) {
        json(res, 400, { error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }

    // ── Undo/redo ──
    if (req.method === "POST" && (url.pathname === "/v1/undo" || url.pathname === "/v1/redo")) {
      try {
        const r = url.pathname === "/v1/undo" ? await doUndo(process.cwd()) : await doRedo(process.cwd());
        json(res, 200, { ok: r.ok, detalle: r });
      } catch (e) {
        json(res, 500, { error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }

    json(res, 404, { error: "no encontrado" });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port, HOST, () => resolve());
  });

  opts.log.ok(`Noira thin escuchando en http://${HOST}:${opts.port} (protocolo v${THIN_PROTOCOL})`);
  return {
    close: async () => {
      clearInterval(watchdog);
      if (activeTurn) activeTurn.abort.abort();
      for (const [id] of pendingConfirms) resolveConfirm(id, false, "cierre del servidor");
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
