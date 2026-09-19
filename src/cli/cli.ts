/**
 * NoiraCoder CLI entry point.
 *
 * Commands:
 *   nc <prompt>                 one-shot task run
 *   nc login                    interactive "Sign in with OpenRouter" (OAuth PKCE)
 *   nc serve [--port PORT]      headless web server (client-server API)
 *   nc --version                version
 *   nc -l <level> <prompt>      set execution level (low|medium|high|max)
 *   nc --lang <code>            set preferred language
 */

import { createLogger } from "../core/logger.js";
import { color } from "../core/logger.js";
import { storeKey } from "../auth/keys.js";
import { interactiveSignIn } from "../auth/oauth.js";
import { LanguageSelector } from "../i18n/index.js";
import { appInfo } from "../core/appInfo.js";
import { orchestrate } from "../agents/orchestrator.js";
import { confirm } from "../sandbox/approve.js";
import { runTui } from "../tui/tui.js";
import { pathToFileURL } from "node:url";
import type { Level } from "../types.js";

export interface CliArgs {
  command: "run" | "login" | "serve" | "version" | "lang" | "connect";
  prompt: string;
  level: Level;
  lang: string | null;
  port: number;
  token?: string;
  thin: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
  let level: Level = "medium";
  let lang: string | null = null;
  let port = 3000;
  let token: string | undefined;
  let thin = false;
  let command: CliArgs["command"] = "run";
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    // Flags solo del wrapper (ya consumidos en bin/): no son parte del prompt.
    if (a === "--no-tui" || a === "--repl") continue;
    switch (a) {
      case "-l":
      case "--level":
        level = (argv[++i] as Level) ?? "medium";
        break;
      case "--lang":
        lang = argv[++i] ?? null;
        break;
      case "--port":
        port = Number(argv[++i] ?? port);
        break;
      case "--token":
        token = argv[++i] ?? undefined;
        break;
      case "--thin":
        thin = true;
        break;
      case "--groq":
      case "--cerebras":
      case "--mistral":
      case "--github":
      case "--nvidia":
      case "--cohere":
      case "--zen":
      case "--huggingface":
      case "--hf":
      case "--vercel":
        // Para `noira login --groq <key>`: lo tratamos como positional para login
        positional.push(a, argv[++i] ?? "");
        break;
      case "--version":
      case "-v":
        return { command: "version", prompt: "", level, lang, port, token, thin };
      case "login":
        // Captura todo lo que sigue a login como positional (para --groq etc)
        positional.push(a);
        for (let j = i + 1; j < argv.length; j++) positional.push(argv[j]);
        command = "login";
        i = argv.length; // el resto ya es positional
        break;
      case "serve":
        command = "serve";
        break;
      case "connect":
        command = "connect";
        break;
      case "help":
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        positional.push(a);
    }
  }

  if (command === "login") return { command, prompt: positional.join(" "), level, lang, port, token, thin };
  if (lang) return { command: "lang", prompt: "", level, lang, port, token, thin };
  return { command, prompt: positional.join(" "), level, lang, port, token, thin };
}

export function printHelp(): void {
  console.log(
    `${appInfo.title} — tu senior 24/7, gratis.\n\n` +
      `  noira              Abre el chat (como claude / opencode)\n` +
      `  noira login        Conecta (1 clic)\n` +
      `  noira connect      Kilo anónimo + estado de claves opcionales\n` +
      `  noira --no-tui     Fuerza modo texto Node (si la TUI no responde)\n` +
      `  noira --help       Más opciones\n`
  );
  // Help extendido solo si se pide explícitamente no se satura al usuario
}

export async function cliMain(argv: string[], meta?: { invokedAs?: string }): Promise<number> {
  const log = createLogger();
  const args = parseArgs(argv);
  const selector = new LanguageSelector();
  const lang = args.lang ?? selector.getLanguage();

  // "noira" always opens the interactive chat (optionally seeded with a prompt).
  // "nc" with no prompt also opens the chat (Claude Code `claude` behavior).
  const inNoira = meta?.invokedAs === "noira";
  const wantsRepl = inNoira || (args.command === "run" && !args.prompt);

  if (wantsRepl) {
    const initialPrompt = args.command === "run" && args.prompt ? args.prompt : undefined;
    const { version } = await import("../packageVersion.js");

    if (process.stdin.isTTY) {
      return runTui({
        cwd: process.cwd(),
        version,
      });
    } else {
      const { runRepl } = await import("./repl.js");
      return runRepl({
        initialPrompt,
        level: args.level,
        cwd: process.cwd(),
        lang,
      });
    }
  }

  switch (args.command) {
    case "version": {
      const { version } = await import("../packageVersion.js");
      console.log(`${appInfo.title} ${version}`);
      return 0;
    }
    case "lang": {
      if (!args.lang) {
        console.log(`[${args.lang}] Idioma actual: ${selector.getLanguage()}`);
        return 0;
      }
      await selector.setLanguage(args.lang);
      log.ok(`Idioma guardado: ${args.lang}`);
      return 0;
    }
    case "login": {
      // `noira login --groq <key>` → guarda directo sin OAuth
      const loginArgs = args.prompt; // contiene "login --groq <key> ..." si hubo flags
      const providerMap: Record<string, string> = { "--groq": "groq", "--cerebras": "cerebras", "--mistral": "mistral", "--github": "github", "--nvidia": "nvidia", "--cohere": "cohere", "--zen": "zen", "--huggingface": "huggingface", "--hf": "huggingface", "--vercel": "vercel" };
      for (const [flag, key] of Object.entries(providerMap)) {
        const idx = loginArgs.indexOf(flag);
        if (idx !== -1) {
          const after = loginArgs.slice(idx + flag.length).trim().split(/\s+/)[0];
          if (after && after.length > 8 && !after.startsWith("--")) {
            await storeKey(key, after);
            log.ok(`[ok] ${key} guardado en ~/.noirarc/keys.json`);
            return 0;
          } else {
            log.error(`Falta key para ${flag}: noira login ${flag} <tu-key>`);
            return 1;
          }
        }
      }
      // Sin flag → OAuth OpenRouter + guía multi-provider
      try {
        const res = await interactiveSignIn();
        await storeKey("openrouter", res.key);
        log.ok(`[ok] OpenRouter conectado (user ${res.user_id ?? "?"}).`);
        const { loadAllKeys } = await import("../auth/keys.js");
        const keys = await loadAllKeys();
        const extras: string[] = [];
        if (!keys.groq) extras.push("Groq (gratis, ~1000 req/día por modelo): https://console.groq.com/keys → noira login --groq <key>");
        if (!keys.zen) extras.push("Zen (modelos free rotativos): https://opencode.ai/zen → noira login --zen <key>");
        if (extras.length) {
          log.raw("\n> Con 3 claves gratis tienes presupuesto amplio (1 min cada una): `noira connect` te guía.");
          for (const e of extras) log.raw(`  · ${e}`);
          log.raw(`\n> Ya puedes usar: noira "tu tarea" — con OpenRouter solo ya funciona.`);
        } else {
          log.ok("Los 3 providers conectados — cuota máxima.");
        }
        return 0;
      } catch (e) {
        log.error(e instanceof Error ? e.message : String(e));
        return 1;
      }
    }
    case "connect": {
      const { loadAllKeys } = await import("../auth/keys.js");
      const { buildProviderPool, validatePool } = await import("../models/providers/index.js");
      const { OPENROUTER_FREE_DAILY } = await import("../models/accountQuota.js");
      const keys = await loadAllKeys();
      const pool = buildProviderPool(keys);
      log.raw("");
      log.raw(color.gold("> NOIRA — funciona SIN claves (Kilo anónimo, 200 req/hora)"));
      log.raw(color.dim("> Cada clave opcional amplía tu cuota. Tardan ~1 min y se guardan cifradas.\n"));
      const steps: { id: string; name: string; url: string; note: string }[] = [
        { id: "kilo", name: "0) Kilo", url: "sin registro", note: "Ya activo: 20 modelos :free, sin hacer nada." },
        { id: "openrouter", name: "1) OpenRouter", url: "https://openrouter.ai/keys", note: `Amplía la cuota: 25+ modelos free, ${OPENROUTER_FREE_DAILY.noCredits}/día (1000/día con 10 $ cargados). Guárdala con: noira login` },
        { id: "groq", name: "2) Groq", url: "https://console.groq.com/keys", note: "Muy rápida. Límite por modelo. Guarda con: noira login --groq <key>" },
        { id: "zen", name: "3) Zen", url: "https://opencode.ai/zen", note: "Modelos free promocionales (rotan). Guarda con: noira login --zen <key>" },
      ];
      for (const s of steps) {
        const has = s.id === "kilo" ? true : !!(keys as Record<string, string | undefined>)[s.id];
        log.raw(`${has ? color.ok("[ok]") : color.dim("[ ]")} ${s.name} — ${color.dim(s.url)}`);
        log.raw(`    ${s.note}`);
      }
      if (pool.length) {
        log.raw("\n> Comprobando que cada clave funciona (red real)...");
        const res = await validatePool(pool);
        for (const [id, r] of Object.entries(res)) {
          if (r.ok) log.ok(`${id}: conectado.`);
          else log.error(`${id}: ${r.reason}`);
        }
        log.raw(color.dim("> Listo. Elige proveedor automáticamente: se prueba el mejor y se rota si falla."));
      } else {
        log.warn("> Aún no hay claves. Empieza con: noira login  (se abre el navegador, 1 clic)");
      }
      return 0;
    }
    case "serve": {
      const { randomBytes } = await import("node:crypto");
      const { connectMcp } = await import("../mcp/connect.js");
      const authToken = args.token ?? process.env.NOIRA_SERVE_TOKEN ?? randomBytes(32).toString("hex");
      args.token = authToken;
      const mcp = await connectMcp(process.cwd());
      if (mcp) log.ok("[mcp] Servidores MCP conectados.");
      if (args.thin) {
        // HITO 1: servidor delgado para la pantalla Go (PROTOCOL.md v1).
        const { startThinServer } = await import("../server/thin.js");
        const svc = await startThinServer({ port: args.port, log, level: args.level, lang, authToken, mcp: mcp ?? undefined });
        log.raw(`[thin] token: ${authToken.slice(0, 8)}… (completo en NOIRA_SERVE_TOKEN si se fijó)`);
        // HITO 1.3: si el wrapper muere de golpe (cierre de ventana), el motor
        // se suicida para no dejar huérfanos. EPERM = sigue vivo; otro error = muerto.
        const ppid = process.ppid;
        const watch = setInterval(() => {
          try {
            process.kill(ppid, 0);
          } catch (e) {
            const code = (e as NodeJS.ErrnoException)?.code;
            if (code !== "EPERM") {
              log.warn("[thin] el wrapper murió; cerrando el motor (sin huérfanos).");
              void svc.close().finally(() => process.exit(0));
            }
          }
        }, 5000);
        (watch as unknown as { unref?: () => void }).unref?.();
        // Mantiene el proceso vivo hasta Ctrl+C.
        await new Promise(() => {});
        await svc.close();
        return 0;
      }
      // Servidor headless: JAMÁS bloquear en stdin. Las acciones destructivas
      // se niegan con mensaje claro (el operador no está delante).
      const { startServer } = await import("../server/server.js");
      const serverConfirm = async (m: string): Promise<boolean> => {
        log.warn(`[serve] confirmación denegada (modo headless, sin terminal): ${m.split("\n")[0]}`);
        return false;
      };
      return startServer({ port: args.port, log, level: args.level, lang, authToken, mcp: mcp ?? undefined, confirm: serverConfirm });
    }
    case "run": {
      if (!args.prompt) {
        printHelp();
        return 1;
      }
      log.info(`Noira · ${args.level}`);
      const { freeWarningOnce } = await import("../i18n/index.js");
      await freeWarningOnce(log, lang);
      const { connectMcp } = await import("../mcp/connect.js");
      const mcp = await connectMcp(process.cwd());
      if (mcp) log.ok("[mcp] Servidores MCP conectados.");
      try {
        const result = await orchestrate(args.prompt, {
          level: args.level,
          cwd: process.cwd(),
          log,
          confirm,
          freeOnly: true,
          lang,
          allowInteractiveAuth: true,
          mcp: mcp ?? undefined,
          // Streaming en tiempo real (estilo OpenCode): no esperar a terminar.
          onToken: (d) => { if (process.stdout.isTTY) process.stdout.write(d); },
        });
        log.raw("\n" + result.output);
        log.ok(`Paso(s): ${result.steps}`);
        mcp?.close();
        return 0;
      } catch (e) {
        log.error(e instanceof Error ? e.message : String(e));
        mcp?.close();
        return 1;
      }
    }
    default:
      printHelp();
      return 1;
  }
}

// Invoke directly when run as a script (node dist/cli/cli.js ...).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  cliMain(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
