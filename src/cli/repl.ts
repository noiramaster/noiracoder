/**
 * Interactive chat session ("noira") — terminal REPL in the style of
 * Claude Code.
 *
 * - Banner + status line (version · level · cwd).
 * - First-run onboarding: welcome, connect (OAuth via direct link if no key),
 *   and a couple of preference questions to tailor the experience.
 * - Continuous conversation: each turn keeps prior context (session tail) and
 *   is persisted so sessions can be resumed.
 * - Slash commands (/login, /logout, /sessions, /resume, /new, /level,
 *   /lang, /help, /exit).
 *
 * Uses a single readline instance (callback API wrapped in promises) so that
 * both interactive (TTY) and piped (non-TTY, e.g. `echo ... | noira`) input
 * behave correctly and the process never hangs or spurts warnings.
 */

import { createInterface, emitKeypressEvents, type Interface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import os from "node:os";
import { join } from "node:path";
import { appInfo } from "../core/appInfo.js";
import { createLogger, color, type Logger } from "../core/logger.js";
import { LanguageSelector } from "../i18n/index.js";
import { storeKey } from "../auth/keys.js";
import { interactiveSignIn } from "../auth/oauth.js";
import { orchestrate } from "../agents/orchestrator.js";
import { SessionStore, type SessionMeta } from "../memory/sessions.js";
import type { Level } from "../types.js";

export interface ReplOptions {
  /** Initial prompt to inject as the first user turn. */
  initialPrompt?: string;
  level?: Level;
  cwd: string;
  lang?: string | null;
}

interface Ctx {
  rl: Interface;
  log: Logger;
  selector: LanguageSelector;
  cwd: string;
  level: Level;
  store: SessionStore;
  session: SessionMeta | null;
  key: string | null;
  version: string;
  closed: boolean;
  mcp: import("../mcp/registry.js").McpRegistry | null;
}

const LEVELS: Level[] = ["low", "medium", "high", "max", "offline"];

function printBanner(log: Logger, version: string, cwd: string, key: string | null, online: boolean): void {
  log.raw("");
  log.raw(`${color.gold("> NOIRA")} ${color.dim("v" + version)}`);
  log.raw(color.dim(`> ${cwd}`));
  if (!online) {
    log.raw(color.yellow("> Offline") + color.dim(" · Modelos locales activos"));
  } else if (!key) {
    log.raw(color.yellow("> Awaiting connection...") + color.dim(" (usa /login para conectar)"));
  } else {
    log.raw(color.dim("> Ready."));
  }
  log.raw("");
}

function printSessionPanel(log: Logger, sessions: SessionMeta[]): void {
  if (sessions.length === 0) {
    log.raw(color.dim("> No sessions yet. Start typing to create one."));
    log.raw("");
    log.raw(color.dim("  Comandos: /login · /new · /level · /help"));
    log.raw("");
    return;
  }
  log.raw(color.dim("> Recent sessions:"));
  sessions.slice(0, 5).forEach((s, i) => {
    const emoji = getSessionEmoji(s.title ?? "");
    const date = formatDate(s.updatedAt);
    const title = (s.title ?? "new session").slice(0, 40);
    log.raw(color.dim(`  ${color.yellow(`[${i}]`)} ${emoji} ${color.yellow(title)} ${color.dim(date)}`));
  });
  log.raw("");
  log.raw(color.dim("  /resume [indice] · /new · /search · /level · /help"));
  log.raw("");
}

/** Wraps readline.question in a promise; resolves "" on close/EOF. */
function ask(ctx: Ctx, question: string): Promise<string> {
  if (ctx.closed) return Promise.resolve("");
  return new Promise((resolve) => {
    try {
      ctx.rl.question(question, (ans) => resolve(ans));
    } catch {
      ctx.closed = true;
      resolve("");
    }
  });
}

async function localConfirm(ctx: Ctx, msg: string): Promise<boolean> {
  const ans = (await ask(ctx, `${msg} [y/N] `)).trim().toLowerCase();
  return ans === "y" || ans === "yes";
}

/** Repeating divider used throughout the onboarding (Claude Code style). */
function sep(): string {
  return color.dim("══".repeat(process.stdout.columns ? Math.floor(process.stdout.columns / 2) : 40));
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function getSessionEmoji(title: string): string {
  if (!title) return "💬";
  const t = title.toLowerCase();
  if (t.includes("fix") || t.includes("bug") || t.includes("error")) return "🔧";
  if (t.includes("create") || t.includes("new") || t.includes("build")) return "🏗️";
  if (t.includes("deploy") || t.includes("publish")) return "🚀";
  if (t.includes("test")) return "🧪";
  if (t.includes("refactor") || t.includes("clean")) return "♻️";
  if (t.includes("doc") || t.includes("readme")) return "📝";
  if (t.includes("style") || t.includes("css") || t.includes("ui")) return "🎨";
  if (t.includes("auth") || t.includes("login") || t.includes("oauth")) return "🔐";
  if (t.includes("api") || t.includes("endpoint")) return "🔌";
  if (t.includes("data") || t.includes("database") || t.includes("sql")) return "🗄️";
  if (t.includes("security") || t.includes("vulnerability")) return "🛡️";
  if (t.includes("performance") || t.includes("speed") || t.includes("optim")) return "⚡";
  return "💬";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getMonth()];
  const hours = d.getHours().toString().padStart(2, "0");
  const mins = d.getMinutes().toString().padStart(2, "0");
  return `${day} ${month} ${hours}:${mins}`;
}

function formatOutput(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (line.startsWith("+")) return color.ok(line);
      if (line.startsWith("-")) return color.error(line);
      if (line.startsWith("@@")) return color.cyan(line);
      if (line.startsWith("```")) return color.dim(line);
      if (line.match(/^\d+\s/)) return color.dim(line);
      return line;
    })
    .join("\n");
}

/**
 * Interactive single-select menu (Claude Code style). Uses raw-mode keypress
 * reading: Up/Down to move, Enter to confirm, numbered keys as shortcuts.
 * Returns the chosen index (0-based).
 */
function select(ctx: Ctx, title: string, options: string[], initial = 0): Promise<number> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY || ctx.closed) {
      resolve(initial);
      return;
    }
    const draw = (sel: number): void => {
      output.write("\x1b[?25l"); // hide cursor
      output.write(color.bold(title) + "\n");
      options.forEach((opt, i) => {
        output.write(i === sel ? ` ${color.yellow("❯")} ${opt} ${color.dim("✔")}\n` : `   ${opt}\n`);
      });
    };
    let sel = initial;
    input.setRawMode?.(true);
    input.resume();
    const onKey = (_str: string, key: { name?: string; ctrl?: boolean }): void => {
      if (key.name === "up") {
        sel = (sel - 1 + options.length) % options.length;
        redraw();
      } else if (key.name === "down") {
        sel = (sel + 1) % options.length;
        redraw();
      } else if (key.name === "return" || key.name === "enter") {
        done(sel);
      } else if (key.name === "c" && key.ctrl) {
        done(-1);
      } else if (/^[1-9]$/.test(key.name ?? _str)) {
        const n = Number(key.name ?? _str) - 1;
        if (n >= 0 && n < options.length) {
          done(n);
        }
      }
    };
    function redraw(): void {
      // move cursor up by (1 title + n options) lines and rewrite
      output.write(`\x1b[${options.length + 1}A`);
      output.write("\x1b[0J");
      draw(sel);
    }
    function done(selOut: number): void {
      input.setRawMode?.(false);
      input.removeListener("keypress", onKey);
      output.write(`\x1b[?25h`); // show cursor
      output.write(`\x1b[${options.length + 1}A`);
      output.write("\x1b[0J");
      const finalIdx = selOut >= 0 && selOut < options.length ? selOut : initial;
      options.forEach((opt, i) => {
        output.write(i === finalIdx ? ` ${color.ok("❯")} ${opt} ✔\n` : `   ${opt}\n`);
      });
      output.write("\n");
      input.pause();
      resolve(finalIdx);
    }
    input.on("keypress", onKey);
    input.setEncoding("utf8");
    emitKeypressEvents(input);
    output.write("\x1b[2J\x1b[0;0H"); // clear screen, reset cursor
    draw(initial);
  });
}

function generateSuggestions(output: string, session: SessionMeta): string[] {
  const suggestions: string[] = [];
  const lower = output.toLowerCase();
  if (lower.includes("error") || lower.includes("fallo")) suggestions.push("Explica el error");
  if (lower.includes("create") || lower.includes("crear")) suggestions.push("Ejecuta el código");
  if (lower.includes("fix") || lower.includes("arregla")) suggestions.push("Verifica el fix");
  if (lower.includes("test") || lower.includes("prueba")) suggestions.push("Ejecuta tests");
  if (lower.includes("deploy") || lower.includes("publica")) suggestions.push("Confirma deploy");
  if (lower.includes("refactor") || lower.includes("limpia")) suggestions.push("Revisa cambios");
  if (session.turns.length > 3) suggestions.push("Resume la conversación");
  if (suggestions.length === 0) suggestions.push("¿Algo más?");
  return suggestions.slice(0, 3);
}

async function showSuggestions(ctx: Ctx, suggestions: string[]): Promise<void> {
  ctx.log.raw("");
  ctx.log.raw(color.dim("> Sugerencias:"));
  suggestions.forEach((s, i) => {
    ctx.log.raw(color.dim(`  ${color.yellow(`[${i + 1}]`)} ${s}`));
  });
  ctx.log.raw(color.dim("  Enter para nueva tarea · Esc para cancelar"));
}

async function firstRunOnboard(ctx: Ctx): Promise<void> {
  // Cualquier provider con clave cuenta como "conectado" (no solo OpenRouter).
  const { loadAllKeys } = await import("../auth/keys.js");
  const all = await loadAllKeys().catch(() => ({} as Record<string, string | undefined>));
  const names = Object.entries(all)
    .filter(([k, v]) => k !== "zenBaseUrl" && k !== "cloudflareAccountId" && typeof v === "string" && v.length > 8)
    .map(([k]) => k);
  ctx.key = names.length ? names.join(",") : null;

  const prefs = await readPrefs();
  const firstRun = !prefs.onboarded;

  if (!process.stdin.isTTY) return;

  await writePrefs({ onboarded: true, language: ctx.selector.getLanguage(), level: ctx.level });
}

async function runTurn(ctx: Ctx, raw: string): Promise<void> {
  const trimmed = raw.trim();
  if (!trimmed) return;

  if (!ctx.session) ctx.session = await ctx.store.create(ctx.level, ctx.cwd);
  ctx.session = await ctx.store.append(ctx.session, "user", trimmed);

  const tail = SessionStore.tail(ctx.session, 6);
  const lang = await ctx.selector.resolveLanguage(trimmed);
  const promptText = tail
    ? `[Contexto reciente de esta conversacion]\n${tail}\n\n[Peticion actual]\n${trimmed}`
    : trimmed;

  ctx.log.raw(`${color.yellow(">")} ${color.dim("Noira")} ${color.dim("·")} ${color.dim(ctx.level)}`);
  try {
    const result = await orchestrate(promptText, {
      level: ctx.level,
      cwd: ctx.cwd,
      log: ctx.log,
      confirm: (m) => localConfirm(ctx, m),
      freeOnly: true,
      lang,
      allowInteractiveAuth: true,
      mcp: ctx.mcp ?? undefined,
    });
    ctx.session = await ctx.store.append(ctx.session, "assistant", result.output);
    ctx.log.raw("\n" + formatOutput(result.output));
    ctx.log.ok(`${color.dim("Paso(s):")} ${color.yellow(result.steps.toString())}`);
    const suggestions = generateSuggestions(result.output, ctx.session);
    await showSuggestions(ctx, suggestions);
  } catch (e) {
    ctx.log.error(e instanceof Error ? e.message : String(e));
  }
}

async function handleCommand(ctx: Ctx, line: string): Promise<boolean> {
  const [cmd, ...rest] = line.trim().split(/\s+/);
  switch (cmd) {
    case "/exit":
    case "/quit":
      return true;
    case "/help":
      ctx.log.raw(
        [
          `${color.yellow(">")} ${color.dim("Comandos:")}`,
          "",
          `  ${color.yellow("/login")}     ${color.dim("conectar con OpenRouter (abre el navegador)")}`,
          `  ${color.yellow("/logout")}    ${color.dim("cerrar la sesion local")}`,
          `  ${color.yellow("/resume")}    ${color.dim("retomar una sesion guardada")}`,
          `  ${color.yellow("/sessions")}  ${color.dim("listar sesiones de este directorio")}`,
          `  ${color.yellow("/new")}       ${color.dim("empezar una sesion nueva")}`,
          `  ${color.yellow("/level")}     ${color.dim("cambiar nivel: low|medium|high|max|offline")}`,
          `  ${color.yellow("/lang")}      ${color.dim("cambiar idioma")}`,
          `  ${color.yellow("/panel")}     ${color.dim("mostrar/ocultar panel de sesiones")}`,
          `  ${color.yellow("/search")}    ${color.dim("buscar en historial: /search <query>")}`,
          `  ${color.yellow("/deploy")}    ${color.dim("deploy a Vercel/Railway")}`,
          `  ${color.yellow("/agents")}    ${color.dim("ver estado de agentes")}`,
          `  ${color.yellow("/parallel")}  ${color.dim("activar modo paralelo")}`,
          `  ${color.yellow("/help")}      ${color.dim("esta ayuda")}`,
          `  ${color.yellow("/exit")}      ${color.dim("salir (Ctrl+C en linea vacia)")}`,
        ].join("\n")
      );
      break;
    case "/sessions": {
      const list = await ctx.store.list();
      if (!list.length) {
        ctx.log.info("No hay sesiones guardadas en este directorio.");
      } else {
        list.forEach((s, i) => {
          const emoji = getSessionEmoji(s.title ?? "");
          const date = formatDate(s.updatedAt);
          const title = (s.title ?? "new session").slice(0, 40);
          ctx.log.raw(`${color.yellow(`[${i}]`)} ${emoji} ${color.yellow(title)} ${color.dim(date)} · ${s.turns.length} turnos`);
        });
      }
      break;
    }
    case "/resume": {
      const list = await ctx.store.list();
      if (!list.length) {
        ctx.log.info("No hay sesiones para retomar.");
        break;
      }
      list.forEach((s, i) => {
        const emoji = getSessionEmoji(s.title ?? "");
        const date = formatDate(s.updatedAt);
        const title = (s.title ?? "new session").slice(0, 40);
        ctx.log.raw(`${color.yellow(`[${i}]`)} ${emoji} ${color.yellow(title)} ${color.dim(date)} · ${s.turns.length} turnos`);
      });
      const idx = (await ask(ctx, `${color.yellow(">")} Indice: `)).trim();
      const chosen = list[Number(idx)];
      if (chosen) {
        ctx.session = chosen;
        ctx.log.ok(`${color.dim("Retomando:")} ${color.yellow(chosen.title)} (${chosen.turns.length} turnos)`);
      } else {
        ctx.log.warn("Indice invalido.");
      }
      break;
    }
    case "/new":
      ctx.session = await ctx.store.create(ctx.level, ctx.cwd);
      ctx.log.ok("Sesion nueva iniciada.");
      break;
    case "/panel": {
      const list = await ctx.store.list();
      printSessionPanel(ctx.log, list);
      break;
    }
    case "/search": {
      const query = rest.join(" ").toLowerCase();
      if (!query) {
        ctx.log.warn("Uso: /search <query>");
        break;
      }
      const list = await ctx.store.list();
      const results = list.filter((s) =>
        (s.title ?? "").toLowerCase().includes(query) ||
        s.turns.some((t) => t.content.toLowerCase().includes(query))
      );
      if (!results.length) {
        ctx.log.info(`No se encontraron sesiones con "${query}".`);
      } else {
        results.slice(0, 10).forEach((s, i) => {
          const emoji = getSessionEmoji(s.title ?? "");
          const date = formatDate(s.updatedAt);
          const title = (s.title ?? "new session").slice(0, 40);
          ctx.log.raw(`${color.yellow(`[${i}]`)} ${emoji} ${color.yellow(title)} ${color.dim(date)}`);
        });
      }
      break;
    }
    case "/deploy": {
      const { deployTool } = await import("../tools/deploy.js");
      const confirmDeploy = (m: string) => localConfirm(ctx, m);
      const res = await deployTool().handler(
        { dryRun: false },
        {
          cwd: ctx.cwd,
          confirmDestructive: true,
          confirm: confirmDeploy,
          log: ctx.log,
        },
      );
      ctx.log.raw(res);
      break;
    }
    case "/agents": {
      const agents = [
        { name: "orchestrator", desc: "Planifica y coordina", status: ctx.session && ctx.session.turns.length ? "ultimo turno trabajado" : "idle" },
        { name: "code", desc: "Edita archivos y ejecuta", status: "idle (se activa al trabajar)" },
        { name: "research", desc: "Busca informacion", status: "idle (se activa al trabajar)" },
        { name: "review", desc: "Revisa calidad", status: "idle (se activa al trabajar)" },
        { name: "security", desc: "Verifica seguridad", status: "idle (se activa al trabajar)" },
      ];
      const { isParallelEnabled } = await import("../core/parallel.js");
      const par = isParallelEnabled();
      ctx.log.raw(`${color.yellow(">")} ${color.dim("Agentes:")}`);
      agents.forEach((a) => {
        ctx.log.raw(`  ${color.yellow(a.name)} ${color.dim(a.desc)} ${color.dim(`[${a.status}]`)}`);
      });
      ctx.log.raw(color.dim(`  Paralalelo (checks de hoja): ${par ? "ACTIVO" : "desactivado"} (usa /parallel)`));
      break;
    }
    case "/parallel": {
      const { setParallelEnabled, isParallelEnabled } = await import("../core/parallel.js");
      const next = !isParallelEnabled();
      setParallelEnabled(next);
      ctx.log.ok(next
        ? "Modo paralelo ACTIVADO: security + review correran en simultaneo real (Promise.all) cuando el pipeline lo permita."
        : "Modo paralelo desactivado: los agentes corren en secuencia.");
      break;
    }
    case "/login": {
      try {
        ctx.log.raw("Abriendo el flujo de conexion... (autoriza en el navegador)");
        const res = await interactiveSignIn({ label: `${appInfo.title}` });
        await storeKey("openrouter", res.key);
        ctx.key = res.key;
        ctx.log.ok(`Conectado a OpenRouter (user ${res.user_id ?? "?"}).`);
      } catch (e) {
        ctx.log.error(`Fallo el login: ${e instanceof Error ? e.message : String(e)}`);
      }
      break;
    }
    case "/logout": {
      const { removeStoredKeys } = await import("../auth/keys.js");
      const res = await removeStoredKeys();
      ctx.key = null;
      if (res.deleted) {
        ctx.log.ok(`Claves eliminadas del disco: ${res.file}`);
      } else {
        ctx.log.warn("No habia archivo de claves en disco (nada que borrar).");
      }
      ctx.log.ok("Sesion local cerrada. Usa /login para reconectar con una clave nueva.");
      break;
    }
    case "/level": {
      const lvl = rest[0]?.toLowerCase();
      if (lvl && LEVELS.includes(lvl as Level)) {
        ctx.level = lvl as Level;
        ctx.log.ok(`${color.dim("Nivel de trabajo:")} ${color.yellow(ctx.level)}`);
      } else {
        ctx.log.warn(`Uso: /level <${LEVELS.join("|")}>`);
      }
      break;
    }
    case "/lang": {
      const code = rest[0]?.toLowerCase();
      if (code) {
        await ctx.selector.setLanguage(code).catch(() => {});
        ctx.log.ok(`Idioma guardado: ${code}`);
      } else {
        ctx.log.info(`Idioma actual: ${ctx.selector.getLanguage()}`);
      }
      break;
    }
    default:
      ctx.log.warn(`Comando desconocido: ${cmd}. Escribe /help para la lista.`);
  }
  return false;
}

interface ReplPrefs {
  onboarded?: boolean;
  language?: string;
  level?: Level;
}

function prefsFile(): string {
  const home = process.env.NOIRARC_HOME ?? os.homedir();
  return join(home, ".noirarc", "prefs.json");
}

async function readPrefs(): Promise<ReplPrefs> {
  try {
    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(prefsFile(), "utf8");
    return JSON.parse(raw) as ReplPrefs;
  } catch {
    return {};
  }
}

async function writePrefs(p: ReplPrefs): Promise<void> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  await mkdir(dirname(prefsFile()), { recursive: true });
  await writeFile(prefsFile(), JSON.stringify(p, null, 2) + "\n", "utf8");
}

export async function runRepl(opts: ReplOptions): Promise<number> {
  const log = createLogger();
  const { version } = await import("../packageVersion.js");
  const { printWelcome } = await import("../core/welcome.js");
  if (process.stdout.isTTY) printWelcome(version);
  const selector = new LanguageSelector();
  const store = new SessionStore(opts.cwd);

  const interactive = process.stdin.isTTY;
  const rl = createInterface({ input, output, terminal: interactive });

  // Piped input arrives (and EOF fires) LONG before startup finishes
  // (MCP/red/sesiones). Si esperamos al bucle para iterar `rl`, el EOF ya
  // cerró la interfaz y las líneas se pierden: el proceso sale 0 sin hacer
  // nada. Por eso encolamos desde el primer momento (solo no-interactivo).
  const pending: string[] = [];
  let notifyInput: (() => void) | null = null;
  if (!interactive) {
    rl.on("line", (l: string) => {
      pending.push(l);
      notifyInput?.();
    });
  }

  const { connectMcp } = await import("../mcp/connect.js");
  const mcp = await connectMcp(opts.cwd);
  if (mcp) log.ok("[mcp] Servidores MCP conectados.");

  const ctx: Ctx = {
    rl,
    log,
    selector,
    cwd: opts.cwd,
    level: opts.level ?? "medium",
    store,
    session: null,
    key: null,
    version,
    closed: false,
    mcp,
  };

  // On EOF (piped input ends), mark closed so pending asks resolve and the
  // process can exit cleanly.
  rl.on("close", () => {
    ctx.closed = true;
  });

  const { isOnline } = await import("../models/local.js");
  const online = await isOnline();

  // Onboard (detección de claves) ANTES del banner para no mentir el estado.
  await firstRunOnboard(ctx);

  printBanner(log, version, opts.cwd, ctx.key, online);

  const recentSessions = await store.list();
  printSessionPanel(log, recentSessions);

  if (opts.initialPrompt) {
    await runTurn(ctx, opts.initialPrompt);
  }

  let exiting = false;
  if (!interactive) {
    // Non-interactive (`echo ... | noira`): procesa la cola hasta EOF y sale.
    // La espera es por eventos (line/close), nunca un sleep ciego.
    const waitInput = (): Promise<void> =>
      new Promise<void>((res) => {
        notifyInput = res;
        if (pending.length > 0 || ctx.closed) {
          const n = notifyInput;
          notifyInput = null;
          n();
        }
      });
    for (;;) {
      let line: string | undefined;
      while ((line = pending.shift()) !== undefined) {
        const t = line.trim();
        if (!t) continue;
        if (t.startsWith("/")) {
          exiting = await handleCommand(ctx, t);
        } else {
          await runTurn(ctx, line);
        }
        if (exiting) break;
      }
      if (exiting || ctx.closed) break;
      await waitInput();
      notifyInput = null;
    }
    log.ok("Fin de la entrada. (Usa 'noira' interactivo para un chat continuo.)");
    await distillAndClose(ctx).catch(() => {});
    process.exit(0);
  }

  while (!exiting && !ctx.closed) {
    const line = await ask(ctx, `${color.yellow(">")} `);
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("/")) {
      exiting = await handleCommand(ctx, trimmed);
    } else if (/^\d+$/.test(trimmed)) {
      const idx = Number(trimmed);
      const list = await ctx.store.list();
      const chosen = list[idx];
      if (chosen) {
        ctx.session = chosen;
        ctx.log.ok(`${color.dim("Retomando:")} ${color.yellow(chosen.title ?? "new session")} (${chosen.turns.length} turnos)`);
      } else {
        ctx.log.warn(`Indice ${idx} no encontrado.`);
      }
    } else {
      await runTurn(ctx, line);
    }
  }

  rl.close();
  await distillAndClose(ctx).catch(() => {});
  log.ok("Hasta la proxima. (Retoma con 'noira' y /resume.)");
  return 0;
}

/** Best-effort end-of-session distillation into global memory. Never throws. */
async function distillAndClose(ctx: Ctx): Promise<void> {
  try {
    const turns = ctx.session?.turns ?? [];
    if (turns.length < 2) return;
    const { distillSessionToGlobal } = await import("../memory/memory.js");
    const { dirKey } = await import("../memory/sessions.js");
    const cwd = ctx.session?.cwd || ctx.cwd;
    const r = await distillSessionToGlobal(turns, { projectTag: `project:${dirKey(cwd)}` });
    if (r.saved > 0 || r.promoted > 0) {
      ctx.log.ok(`Memoria global: ${r.saved} nota(s), ${r.promoted} promocion(es).`);
    }
  } catch {
    // best effort: never block exit on memory writes
  }
}
