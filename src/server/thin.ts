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
import { sanitizeThinOut } from "./sanitize.js";
import { screenString, renderScreen } from "../i18n/screen.js";
import { DEFAULT_POLICY } from "../sandbox/policies.js";

export const THIN_PROTOCOL = 2;
const HOST = "127.0.0.1";
const CONFIRM_TIMEOUT_MS = 120000;
const TURN_NO_EVENT_TIMEOUT_MS = 60000;
const MAX_BODY_BYTES = 1024 * 1024;

export interface ThinServerOptions {
  port: number;
  log: Logger;
  level: Level;
  /** H1: true si el usuario fijó --level (entonces no aplica regla aprendida). */
  levelExplicit?: boolean;
  lang: string;
  authToken?: string;
  mcp?: McpRegistry;
}

interface PendingConfirm {
  resolve: (approved: boolean) => void;
  settled: boolean;
  timer: NodeJS.Timeout;
}

/** H10: opciones seleccionables */
interface PendingOptions {
  resolve: (choice: string) => void;
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
  let titleAuto = true; // M2.8: /title auto|off
  const pendingConfirms = new Map<string, PendingConfirm>();
  const pendingOptions = new Map<string, PendingOptions>(); // H10
  let consecutiveFailures = 0; // H9: 3-failure detection

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

  // M2.8: titulador en 2º plano. 1 llamada barata + 1 regen si sigue
  // genérico; sin cuota/error/off → fallback local. Nunca user/fijada.
  // No compite con el turno (corre tras turn.end) ni reintenta en bucle.
  const maybeTitle = async (id: string, message: string, sessionId: string): Promise<void> => {
    try {
      if (!titleAuto) return;
      const metas = await store.list();
      const meta = metas.find((m) => m.id === (sessionId || id));
      if (!meta) return;
      const firstUser = meta.turns.find((t) => t.role === "user")?.content ?? message;
      const { needsTitle, fallbackTitle, generateAutoTitle } = await import("./titles.js");
      const { sanitizeThinOut } = await import("./sanitize.js");
      if (!needsTitle(meta, firstUser)) return;
      let title = fallbackTitle(firstUser);
      const gen = await generateAutoTitle(firstUser, { preferredModel }).catch(() => null);
      if (gen && gen.title) title = gen.title;
      title = sanitizeThinOut(title).trim() || title;
      if (!title) return;
      await store.saveAutoTitle(meta.id, title);
      const fresh = await store.load(meta.id);
      send("session.updated", { id: meta.id, nombre: fresh?.title ?? title });
    } catch { /* el título nunca rompe nada */ }
  };

  // HITO 2.4: saneo compartido (la Go vuelve a sanear al pintar).
  const sanitizeOut = sanitizeThinOut;

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

  /** H10: resuelve una opción seleccionable por el usuario. */
  const resolveOptions = (id: string, choice: string, why: string) => {
    const p = pendingOptions.get(id);
    if (!p || p.settled) {
      opts.log.warn(`[thin] options tardía/duplicada ignorada: ${id} (${why})`);
      return false;
    }
    p.settled = true;
    clearTimeout(p.timer);
    pendingOptions.delete(id);
    send("options.result", { optionsId: id, choice, motivo: why });
    p.resolve(choice);
    return true;
  };

  const runTurn = async (turnId: string, sessionId: string, message: string, mode: string) => {
    const abort = new AbortController();
    activeTurn = { id: turnId, sessionId, abort, lastEventAt: Date.now(), lastToolStartAt: 0 };
    // M4.2: timers se inicializan en el try; catch los limpia si existen.
    let clearTimers: () => void = () => {};
    // HITO 4.7: aviso de primer uso (una vez por equipo, 7 idiomas).
    try {
      const { freeWarningOnce } = await import("../i18n/index.js");
      await freeWarningOnce(opts.log, opts.lang);
    } catch { /* nunca bloquea un turno */ }
    const touch = () => {
      if (activeTurn?.id === turnId) activeTurn.lastEventAt = Date.now();
    };
    let fullText = "";
    // Modo Plan: TODO se deniega (además la política se endurece abajo).
    const planMode = mode === "plan";

    // H1: nivel efectivo y registro (fuera del try para alcanzar el catch).
    const { classifyTask, recordTurn, getLearned, resolveLevel } = await import("./learn.js");
    const learned = await getLearned();
    const task = classifyTask(message);
    const effLevel = resolveLevel(task, opts.levelExplicit ? opts.level : null, learned, opts.level);
    if (effLevel !== opts.level) opts.log.info(`[learn] nivel auto ${effLevel} para ${task} (regla con evidencia)`);
    const t0 = Date.now();
    let switches = 0;
    let lastModel = preferredModel ?? "(router)";
    const toolsUsed = new Set<string>();

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

    /** H10: opciones seleccionables — envía SSE y espera elección del usuario. */
    const remoteOptions = async (optsList: Array<{ key: string; label: string; recommended?: boolean }>, prompt: string): Promise<string> => {
      if (planMode) {
        const oid = randomUUID();
        send("options.request", { optionsId: oid, opciones: optsList, prompt, timeoutMs: 0 });
        const fallback = optsList[0]?.key ?? "";
        send("options.result", { optionsId: oid, choice: fallback, motivo: "modo plan (primera opción)" });
        return fallback;
      }
      if (!sse || sse.writableEnded) {
        opts.log.warn(`[thin] options sin cliente → primera opción`);
        return optsList[0]?.key ?? "";
      }
      const optionsId = randomUUID();
      send("options.request", { optionsId, opciones: optsList, prompt, timeoutMs: CONFIRM_TIMEOUT_MS });
      return new Promise<string>((resolve) => {
        const timer = setTimeout(() => {
          resolveOptions(optionsId, optsList[0]?.key ?? "", "timeout 120s");
        }, CONFIRM_TIMEOUT_MS);
        (timer as unknown as { unref?: () => void }).unref?.();
        pendingOptions.set(optionsId, { resolve, settled: false, timer });
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

      // M4.2: eco inmediato — el cliente ve su mensaje al instante.
      send("turn.echo", { turnId, message });

      // M4.2: indicador "pensando" si la primera respuesta tarda >100ms.
      const thinkingTimer = setTimeout(() => {
        if (activeTurn?.id === turnId) send("turn.thinking", { turnId });
      }, 100);
      (thinkingTimer as unknown as { unref?: () => void }).unref?.();

      // M4.2: vigilante de silencio — avisa si 30s sin ningún token.
      let silenceFired = false;
      const silenceTimer = setTimeout(() => {
        if (activeTurn?.id === turnId && !silenceFired) {
          silenceFired = true;
          send("turn.silence", { turnId, ms: 30000, hint: "el modelo puede estar saturado o en cola" });
        }
      }, 30000);
      (silenceTimer as unknown as { unref?: () => void }).unref?.();

      clearTimers = () => {
        clearTimeout(thinkingTimer);
        clearTimeout(silenceTimer);
      };

      // Limpia timers si el watchdog aborta el turno.
      abort.signal.addEventListener("abort", () => clearTimers(), { once: true });

      const policy = planMode
        ? { ...DEFAULT_POLICY, allowCommands: [] as string[] }
        : undefined;

      // H1: nivel efectivo ya resuelto arriba (visible en catch).
      const { recomputeRules } = await import("./learn.js");
      const result = await orchestrate(message, {
        level: effLevel as typeof opts.level,
        cwd: process.cwd(),
        log: opts.log,
        confirm: remoteConfirm,
        options: remoteOptions,
        freeOnly: true,
        lang: opts.lang,
        mcp: opts.mcp,
        signal: abort.signal,
        model: preferredModel,
        policy,
        onToken: (d) => {
          touch();
          fullText += d;
          silenceFired = true; // M4.2: primer token →cancela vigilante de silencio.
          send("turn.text", { turnId, delta: d });
        },
        onModelSwitch: (from, to, reason) => {
          touch();
          switches++;
          lastModel = to;
          send("model.switch", { turnId, de: from, a: to, motivo: reason });
        },
        onToolEvent: (ev) => {
          touch();
          if (ev.phase === "start") {
            toolsUsed.add(ev.name);
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
        onMemoryEvent: (ev) => {
          touch();
          send("memory.event", { turnId, nivel: ev.nivel, resumen: ev.resumen });
        },
        onQuotaEvent: (q) => {
          touch();
          send("model.quota", {
            turnId,
            proveedor: "gratis-combinada",
            usadoPct: q.usadoPct,
            aviso: q.usadoPct >= 85 ? "cuota casi agotada" : null,
          });
        },
      });
      await store.append(meta, "assistant", result.output || "(sin salida)");
      send("session.updated", { id: meta.id, nombre: meta.title });
      clearTimers();
      send("turn.end", { turnId, motivo: "done" });
      consecutiveFailures = 0; // H9: reset on success
      // H9: resumen de tarea — muestra qué hizo el modelo
      const summaryParts: string[] = [];
      if (toolsUsed.size > 0) summaryParts.push(`tools: ${[...toolsUsed].join(", ")}`);
      if (switches > 0) summaryParts.push(`switches: ${switches}`);
      summaryParts.push(`model: ${lastModel}`);
      summaryParts.push(`time: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      send("turn.summary", { turnId, resumen: summaryParts.join(" | ") });
      // M2.8: título en 2º plano (no bloquea; 1 llamada + 1 regen; cuenta cuota).
      void maybeTitle(meta.id, message, sessionId);
      // H1.1: registra el turno (metadatos, sin contenido) + recompute perezoso.
      void recordTurn({
        session: sessionId, task, level: effLevel, model: lastModel,
        retries: switches, ms: Date.now() - t0, ok: true, tools: [...toolsUsed],
      });
      void maybeRecompute();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (abort.signal.aborted || msg.includes("cancelado")) {
        clearTimers();
        send("turn.end", { turnId, motivo: "cancelled" });
        void recordTurn({
          session: sessionId, task, level: effLevel, model: lastModel,
          retries: switches, ms: Date.now() - t0, ok: false, tools: [...toolsUsed],
        });
      } else {
        send("turn.error", { turnId, mensaje: msg.slice(0, 500) });
        clearTimers();
        send("turn.end", { turnId, motivo: "error" });
        consecutiveFailures++;
        // H9: 3-failure detection — sugiere cambiar modelo
        if (consecutiveFailures >= 3) {
          send("turn.text", { turnId, delta: `\n[hint] ${consecutiveFailures} fallos consecutivos. Prueba: /model <otro>` });
          opts.log.warn(`[thin] ${consecutiveFailures} fallos consecutivos — sugiriendo cambio de modelo`);
        }
        void recordTurn({
          session: sessionId, task, level: effLevel, model: lastModel,
          retries: switches, ms: Date.now() - t0, ok: false, tools: [...toolsUsed],
        });
      }
    } finally {
      if (activeTurn?.id === turnId) activeTurn = null;
    }
  };

  // H1.3: recompute perezoso cada ~20 turnos nuevos (nunca bloquea).
  const maybeRecompute = async (): Promise<void> => {
    try {
      const { getLearned, recomputeRules } = await import("./learn.js");
      const prev = await getLearned();
      const { loadTurns } = await import("./learn.js");
      const n = (await loadTurns()).length;
      if (!prev || n - (prev.lastCount ?? 0) >= 20) {
        await recomputeRules("auto");
      }
    } catch { /* aprender nunca rompe */ }
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
      json(res, 401, { error: screenString(opts.lang, "err_unauthorized") });
      return;
    }
    if (!checkVersion(req)) {
      json(res, 426, { error: `protocolo distinto: el motor habla v${THIN_PROTOCOL}`, protocol: THIN_PROTOCOL });
      return;
    }

    // ── Estado (lo usa el wrapper para detectar pantallas colgadas) ──
    if (req.method === "GET" && url.pathname === "/v1/status") {
      // TAREA S: se eliminó el campo `proyecto` (detección H9): nadie lo
      // consumía y rompía la forma exacta que exige la batería adversaria.
      json(res, 200, {
        ok: true,
        protocol: THIN_PROTOCOL,
        clientes: sse && !sse.writableEnded ? 1 : 0,
        turnoActivo: activeTurn !== null,
      });
      return;
    }

    // ── Catálogo de pantalla (M1.1, protocolo v2): la Go no trae
    // diccionarios; pide sus cadenas aquí. Fallback exacto → base → en.
    if (req.method === "GET" && url.pathname === "/v1/i18n") {
      const { screenStrings } = await import("../i18n/screen.js");
      const asked = url.searchParams.get("lang") ?? "en";
      const { lang, strings } = screenStrings(asked);
      json(res, 200, { lang, strings });
      return;
    }

    // ── SSE (un solo cliente) ──
    if (req.method === "GET" && url.pathname === "/v1/events") {
      if (sse && !sse.writableEnded) {
        json(res, 409, { error: screenString(opts.lang, "err_client_connected") });
        return;
      }
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(": conectado\n\n");
      sse = res;
      send("hello", { protocol: THIN_PROTOCOL, motor: "node-ts", modelo: preferredModel ?? opts.level ?? "low", level: opts.level ?? "low" });
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
        const { configDir } = await import("../auth/keys.js");
        const { classifyProviderModels } = await import("../models/providers/index.js");
        const { buildProviderPool, fetchMergedCatalog } = await import("../models/providers/index.js");
        const { loadCatalog } = await import("../models/catalog.js");
        const keys = await loadAllKeys();
        const pool = buildProviderPool(keys);
        const catalog = await loadCatalog({
          cacheDir: configDir(),
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
              } catch { /* cae al primer provider */ }
            }
            const soloRaw = await pool[0].listModels();
            const solo = classifyProviderModels(pool[0].id, soloRaw);
            return {
              models: solo,
              providersById: Object.fromEntries(solo.map((m) => [m.id, [pool[0].id]])),
              freeByProvider: Object.fromEntries(solo.map((m) => [m.id, { [pool[0].id]: m.free }])),
            };
          },
        });
        // Kilo anónimo no tiene clave pero sí está disponible (modelos :free).
        const have = (p?: string) => (p ? Boolean((keys as Record<string, unknown>)[p]) || p === "kilo" : false);
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

    // H8: casillas de conexión de claves
    if (req.method === "GET" && url.pathname === "/v1/connections") {
      try {
        const { loadAllKeys } = await import("../auth/keys.js");
        const { getAllCredentials } = await import("../auth/credentials.js");
        const keys = await loadAllKeys();
        const creds = await getAllCredentials();

        // Model providers
        const modelProviders = [
          { id: "kilo", name: "Kilo (anonymous)", note: "200 req/hora, sin clave", category: "model" as const },
          { id: "openrouter", name: "OpenRouter", note: "25+ modelos free", category: "model" as const },
          { id: "groq", name: "Groq", note: "~1000 req/día por modelo", category: "model" as const },
          { id: "zen", name: "Zen", note: "Modelos free rotativos", category: "model" as const },
        ];

        // Service credentials
        const serviceCreds = [
          { id: "github_token", name: "GitHub", note: "git push/pull to private repos", category: "service" as const },
          { id: "gitlab_token", name: "GitLab", note: "git push/pull", category: "service" as const },
          { id: "cloudflare_api_token", name: "Cloudflare", note: "Pages/Workers deploy", category: "service" as const },
          { id: "npm_token", name: "npm", note: "npm publish", category: "service" as const },
          { id: "vercel_token", name: "Vercel", note: "deploy", category: "service" as const },
          { id: "docker_token", name: "Docker Hub", note: "docker push", category: "service" as const },
          { id: "netlify_token", name: "Netlify", note: "deploy", category: "service" as const },
          { id: "pypi_token", name: "PyPI", note: "twine upload", category: "service" as const },
        ];

        const result = [
          ...modelProviders.map((p) => ({
            ...p,
            connected: p.id === "kilo" ? true : !!(keys as Record<string, string | undefined>)[p.id],
          })),
          ...serviceCreds.map((s) => ({
            ...s,
            connected: !!creds[s.id] || !!(s.id === "github_token" && process.env.GITHUB_TOKEN),
          })),
        ];

        json(res, 200, { providers: result });
      } catch (e) {
        json(res, 500, { error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }

    // H8: POST /v1/connect — validate + store a credential
    if (req.method === "POST" && url.pathname === "/v1/connect") {
      try {
        const parsed = JSON.parse(await readBody(req)) as { serviceId?: string; value?: string };
        if (!parsed.serviceId || !parsed.value) {
          json(res, 400, { error: renderScreen(screenString(opts.lang, "err_field_required"), { field: "serviceId and value" }) });
          return;
        }
        const { validateCredential, storeCredential } = await import("../auth/credentials.js");
        const result = await validateCredential(parsed.serviceId, parsed.value);
        if (!result.ok) {
          json(res, 400, { ok: false, error: result.error });
          return;
        }
        await storeCredential(parsed.serviceId, parsed.value);
        json(res, 200, { ok: true, stored: parsed.serviceId });
      } catch (e) {
        json(res, 500, { error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/model") {
      try {
        const parsed = JSON.parse(await readBody(req)) as { id?: string };
        if (!parsed.id) {
          json(res, 400, { error: renderScreen(screenString(opts.lang, "err_field_required"), { field: "id" }) });
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

    // ── Latencia y scores por modelo (M4.1) ──
    if (req.method === "GET" && url.pathname === "/v1/model/stats") {
      try {
        const { AdaptiveRanker } = await import("../models/adaptive.js");
        const ranker = new AdaptiveRanker();
        await ranker.load();
        const stats: Record<string, { avgLatencyMs: number | null; score: number }> = {};
        for (const m of ranker.allModels()) {
          let maxScore = 0;
          for (const role of ranker.roles()) {
            const s = ranker.score(role, m);
            if (s > maxScore) maxScore = s;
          }
          stats[m] = { avgLatencyMs: ranker.avgLatency(m), score: maxScore };
        }
        json(res, 200, { stats });
      } catch (e) {
        json(res, 500, { error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }

    // ── MCP: listar servidores y tools (M5.1) ──
    if (req.method === "GET" && url.pathname === "/v1/mcp/servers") {
      try {
        const servers: { name: string; tools: string[] }[] = [];
        if (opts.mcp) {
          for (const srv of opts.mcp.allServers()) {
            servers.push({ name: srv.name, tools: srv.tools.map((t) => t.name) });
          }
        }
        json(res, 200, { servers });
      } catch (e) {
        json(res, 500, { error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    if (req.method === "GET" && url.pathname === "/v1/mcp/tools") {
      try {
        const tools: { name: string; server: string; description?: string }[] = [];
        if (opts.mcp) {
          for (const t of opts.mcp.callAll()) {
            const parts = t.name.split("__");
            tools.push({ name: t.name, server: parts[1] ?? "?", description: t.description });
          }
        }
        json(res, 200, { tools });
      } catch (e) {
        json(res, 500, { error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }

    // ── Parallel toggle (M5.2) ──
    if (req.method === "POST" && url.pathname === "/v1/parallel") {
      try {
        const { setParallelEnabled, isParallelEnabled } = await import("../core/parallel.js");
        const next = !isParallelEnabled();
        setParallelEnabled(next);
        json(res, 200, { parallel: next });
      } catch (e) {
        json(res, 500, { error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    if (req.method === "GET" && url.pathname === "/v1/parallel") {
      try {
        const { isParallelEnabled } = await import("../core/parallel.js");
        json(res, 200, { parallel: isParallelEnabled() });
      } catch (e) {
        json(res, 500, { error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }

    // ── Idioma UI + respuestas (M1.5) ──
    if (req.method === "GET" && url.pathname === "/v1/langs") {
      const { LanguageSelector } = await import("../i18n/index.js");
      const sel = new LanguageSelector();
      const natives: Record<string, string> = {
        en: "English", es: "español", pt: "português", fr: "français",
        de: "Deutsch", it: "italiano", ar: "العربية",
      };
      json(res, 200, {
        ui: opts.lang,
        answer: sel.getAnswerLang(),
        langs: Object.keys(natives).map((code) => ({ code, native: natives[code] })),
      });
      return;
    }
    if (req.method === "POST" && url.pathname === "/v1/lang") {
      try {
        const { LanguageSelector, detectOsLang } = await import("../i18n/index.js");
        const { screenString, renderScreen } = await import("../i18n/screen.js");
        const parsed = JSON.parse(await readBody(req)) as { lang?: string };
        const want = (parsed.lang ?? "").trim().toLowerCase();
        const sel = new LanguageSelector();
        if (want === "auto" || want === "") {
          await sel.setLanguage(detectOsLang());
          opts.lang = sel.getLanguage();
          json(res, 200, { ok: true, lang: opts.lang, auto: true });
          return;
        }
        await sel.setLanguage(want);
        opts.lang = sel.getLanguage();
        json(res, 200, {
          ok: true,
          lang: opts.lang,
          msg: renderScreen(screenString(opts.lang, "lang_set"), { lang: opts.lang }),
        });
      } catch (e) {
        json(res, 400, { error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    if (req.method === "POST" && url.pathname === "/v1/lang/answer") {
      try {
        const { LanguageSelector } = await import("../i18n/index.js");
        const { screenString, renderScreen } = await import("../i18n/screen.js");
        const parsed = JSON.parse(await readBody(req)) as { mode?: string };
        const sel = new LanguageSelector();
        const mode = await sel.setAnswerLang((parsed.mode ?? "auto").trim().toLowerCase());
        json(res, 200, {
          ok: true,
          mode,
          msg: renderScreen(screenString(opts.lang, "lang_answer_set"), { mode }),
        });
      } catch (e) {
        json(res, 400, { error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }

    // M2.8: /title auto|off (titulador en 2º plano).
    if (req.method === "POST" && url.pathname === "/v1/title") {
      try {
        const { screenString, renderScreen } = await import("../i18n/screen.js");
        const parsed = JSON.parse(await readBody(req)) as { mode?: string };
        const mode = (parsed.mode ?? "auto").trim().toLowerCase();
        if (mode !== "auto" && mode !== "off") {
          json(res, 400, { error: renderScreen(screenString(opts.lang, "err_field_required"), { field: "mode" }) });
          return;
        }
        titleAuto = mode === "auto";
        json(res, 200, {
          ok: true,
          mode,
          msg: renderScreen(screenString(opts.lang, "title_set"), { mode }),
        });
      } catch (e) {
        json(res, 400, { error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }

    // ── Sesiones ──
    if (req.method === "GET" && url.pathname === "/v1/sessions") {
      const { relTime, dayBucket, groupLabel } = await import("../i18n/screen.js");
      const all = url.searchParams.get("all") === "1";
      const metas = all ? await SessionStore.listAll() : await store.list();
      json(res, 200, {
        sesiones: metas.map((m) => ({
          id: m.id,
          nombre: m.title,
          updatedAt: m.updatedAt,
          rel: relTime(opts.lang, m.updatedAt),
          grupo: groupLabel(opts.lang, dayBucket(m.updatedAt)),
          fija: m.pinned === true,
          activa: activeTurn?.sessionId === m.id,
          turnos: m.turns.length,
          ...("project" in m ? { project: (m as { project: string }).project } : {}),
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

    // HITO 2.3: historial para reanudar (GET /v1/sessions/:id).
    if (req.method === "GET" && url.pathname.startsWith("/v1/sessions/")) {
      const id = url.pathname.slice("/v1/sessions/".length).split("/")[0];
      const metas = await store.list();
      const meta = metas.find((m) => m.id === id);
      if (!meta) {
        json(res, 404, { error: screenString(opts.lang, "err_session_not_found") });
        return;
      }
      json(res, 200, {
        id: meta.id,
        nombre: meta.title,
        updatedAt: meta.updatedAt,
        turnos: meta.turns.map((t) => ({ role: t.role, content: t.content.slice(0, 4000), ts: t.ts })),
      });
      return;
    }

    // M2.3: renombrar/fijar (PATCH) y borrar (DELETE) con las mismas puertas.
    // El listado solo trae título y metadatos, nunca contenido.
    if (req.method === "PATCH" && url.pathname.startsWith("/v1/sessions/")) {
      const id = url.pathname.slice("/v1/sessions/".length).split("/")[0];
      try {
        const parsed = JSON.parse(await readBody(req)) as { nombre?: string; fija?: boolean };
        let meta = null;
        if (typeof parsed.nombre === "string" && parsed.nombre.trim()) {
          meta = await store.rename(id, parsed.nombre);
        }
        if (typeof parsed.fija === "boolean") {
          meta = (await store.setPin(id, parsed.fija)) ?? meta;
        }
        if (!meta) {
          json(res, 404, { error: screenString(opts.lang, "err_session_not_found") });
          return;
        }
        json(res, 200, { ok: true, id: meta.id, nombre: meta.title, fija: meta.pinned === true });
      } catch (e) {
        json(res, 400, { error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    if (req.method === "DELETE" && url.pathname.startsWith("/v1/sessions/")) {
      const id = url.pathname.slice("/v1/sessions/".length).split("/")[0];
      const metas = await store.list();
      if (!metas.some((m) => m.id === id)) {
        json(res, 404, { error: screenString(opts.lang, "err_session_not_found") });
        return;
      }
      await store.remove(id, process.cwd());
      json(res, 200, { ok: true, id });
      return;
    }

    // M2.7: UI recordada (panel abierto + sesión activa).
    if (req.method === "GET" && url.pathname === "/v1/ui") {
      const { LanguageSelector } = await import("../i18n/index.js");
      json(res, 200, new LanguageSelector().getUi());
      return;
    }
    if (req.method === "POST" && url.pathname === "/v1/ui") {
      try {
        const { LanguageSelector } = await import("../i18n/index.js");
        const parsed = JSON.parse(await readBody(req)) as { panelOpen?: boolean; sessionId?: string | null };
        const sel = new LanguageSelector();
        await sel.setUi({ panelOpen: parsed.panelOpen, sessionId: parsed.sessionId });
        json(res, 200, { ok: true, ...sel.getUi() });
      } catch (e) {
        json(res, 400, { error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }

    // ── Turno ──
    if (req.method === "POST" && url.pathname === "/v1/turn") {
      if (activeTurn) {
        json(res, 409, { error: screenString(opts.lang, "err_turn_in_progress"), turnId: activeTurn.id });
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
          json(res, 400, { error: renderScreen(screenString(opts.lang, "err_field_required"), { field: "message" }) });
          return;
        }
        const mode = parsed.mode === "plan" ? "plan" : "build";
        let sessionId = parsed.sessionId;
        if (sessionId) {
          const metas = await store.list();
          if (!metas.some((m) => m.id === sessionId)) {
            json(res, 404, { error: screenString(opts.lang, "err_session_not_found") });
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
          json(res, 400, { error: renderScreen(screenString(opts.lang, "err_field_required"), { field: "confirmId" }) });
          return;
        }
        const ok = resolveConfirm(parsed.confirmId, parsed.aprobado === true, "cliente");
        json(res, 200, { ok, aplicada: ok });
      } catch (e) {
        json(res, 400, { error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }

    // H10: opciones seleccionables
    if (req.method === "POST" && url.pathname === "/v1/options") {
      try {
        const parsed = JSON.parse(await readBody(req)) as { optionsId?: string; choice?: string };
        if (!parsed.optionsId) {
          json(res, 400, { error: renderScreen(screenString(opts.lang, "err_field_required"), { field: "optionsId" }) });
          return;
        }
        const ok = resolveOptions(parsed.optionsId, parsed.choice ?? "", "cliente");
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
        json(res, 404, { error: screenString(opts.lang, "err_no_turn_id") });
      } catch (e) {
        json(res, 400, { error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }

    // ── Undo/redo ──
    if (req.method === "POST" && (url.pathname === "/v1/undo" || url.pathname === "/v1/redo")) {
      try {
        const r = url.pathname === "/v1/undo" ? await doUndo(process.cwd()) : await doRedo(process.cwd());
        // H1.1: el deshecho es la señal de "no aceptado" (se une al analizar).
        if (url.pathname === "/v1/undo" && r.ok) {
          const { recordUndo } = await import("./learn.js");
          const metas = await store.list();
          const last = metas[0];
          if (last) void recordUndo(last.id);
        }
        json(res, 200, { ok: r.ok, detalle: r });
      } catch (e) {
        json(res, 500, { error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }

    // ── H1.4: ver lo aprendido + revertir una regla ──
    if (req.method === "GET" && url.pathname === "/v1/learn") {
      const { getLearned, computeStats, loadTurns } = await import("./learn.js");
      const rules = await getLearned();
      const stats = computeStats(await loadTurns());
      const summary: Record<string, { n: number; okPct: number; p50ms: number }> = {};
      for (const [task, st] of Object.entries(stats)) {
        summary[task] = { n: st.n, okPct: Math.round(st.okRate * 100), p50ms: st.p50ms };
      }
      json(res, 200, { rules, stats: summary });
      return;
    }
    if (req.method === "POST" && url.pathname === "/v1/learn/revert") {
      try {
        const parsed = JSON.parse(await readBody(req)) as { task?: string };
        const { getLearned } = await import("./learn.js");
        const { readFile, writeFile, mkdir } = await import("node:fs/promises");
        const { join } = await import("node:path");
        const { homedir } = await import("node:os");
        const home = process.env.NOIRARC_HOME ?? homedir();
        const f = join(home, ".noirarc", "learn", "learned.json");
        const rules = (await getLearned()) ?? { v: 1, updatedAt: "", lastCount: 0, defaultLevelByTask: {} };
        const task = parsed.task ?? "";
        if (rules.defaultLevelByTask[task]) {
          delete rules.defaultLevelByTask[task];
          rules.updatedAt = new Date().toISOString();
          await mkdir(join(home, ".noirarc", "learn"), { recursive: true });
          await writeFile(f, JSON.stringify(rules, null, 2) + "\n", "utf8");
          const audit = join(home, ".noirarc", "memory", "learned.md");
          try {
            const prev = await readFile(audit, "utf8").catch(() => "");
            await mkdir(join(home, ".noirarc", "memory"), { recursive: true });
            await writeFile(audit, prev + `\n## ${rules.updatedAt} — revert manual de ${task}\n`, "utf8");
          } catch { /* auditoría best-effort */ }
        }
        json(res, 200, { ok: true, rules });
      } catch (e) {
        json(res, 400, { error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }

    // H9: /explain — explica qué hizo el último turno
    if (req.method === "POST" && url.pathname === "/v1/explain") {
      try {
        const parsed = JSON.parse(await readBody(req)) as { sessionId?: string };
        const sid = parsed.sessionId ?? activeTurn?.sessionId;
        if (!sid) {
          json(res, 400, { error: renderScreen(screenString(opts.lang, "err_field_required"), { field: "sessionId" }) });
          return;
        }
        const metas = await store.list();
        const meta = metas.find((m) => m.id === sid);
        if (!meta || meta.turns.length === 0) {
          json(res, 404, { error: renderScreen(screenString(opts.lang, "err_session_not_found"), {}) });
          return;
        }
        const lastTurns = meta.turns.slice(-4);
        const userMsg = lastTurns.find((t) => t.role === "user")?.content.slice(0, 200) ?? "";
        const assistantMsg = lastTurns.find((t) => t.role === "assistant")?.content.slice(0, 500) ?? "";
        json(res, 200, {
          ok: true,
          pregunta: userMsg,
          respuesta: assistantMsg,
          turnos: meta.turns.length,
        });
      } catch (e) {
        json(res, 400, { error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }

    json(res, 404, { error: screenString(opts.lang, "err_not_found") });
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
