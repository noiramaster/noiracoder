#!/usr/bin/env node
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, basename } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const distEntry = join(here, "..", "dist", "cli", "cli.js");
const invokedAs = basename(process.argv[1] ?? "");
// TUI Go: noira-go.exe (Windows) o noira-go (Unix). El nombre depende de la
// plataforma con la que se compiló el asset del release.
const goBin = existsSync(join(here, "noira-go.exe"))
  ? join(here, "noira-go.exe")
  : join(here, "noira-go");

const args = process.argv.slice(2);
const isCliFlag = args.some((a) => ["--help","-h","--version","-v","serve","login","--lang"].includes(a) || a === "-l" || a === "--level");
// Escape hatch: fuerza el camino Node (sin TUI Go) aunque haya terminal.
const forceNode = args.includes("--no-tui") || args.includes("--repl") || process.env.NOIRA_NO_TUI === "1";
// La TUI Go necesita un terminal interactivo REAL para leer teclas: sin stdin
// TTY (pipes, scripts, CI, npx con stdio redirigido) se quedaría esperando
// teclas eternamente sin responder. En ese caso se usa siempre el camino
// Node (runRepl), que completa por EOF y sale con código 0.
const interactiveTTY = !!process.stdin.isTTY && !!process.stdout.isTTY;
// Clon OpenCode: si no hay flag de CLI y hay terminal real, lanza Go TUI pulido.
if (!isCliFlag && !forceNode && interactiveTTY && existsSync(goBin)) {
  try {
    const home = process.env.NOIRARC_HOME || process.env.USERPROFILE || process.env.HOME || "";
    const p = join(home, ".noirarc", "keys.json");
    const raw = existsSync(p) ? readFileSync(p, "utf8") : "";
    if (raw) {
      const j = JSON.parse(raw);
      if (j.openrouter && !process.env.OPENROUTER_API_KEY) process.env.OPENROUTER_API_KEY = j.openrouter;
      if (j.groq && !process.env.GROQ_API_KEY) process.env.GROQ_API_KEY = j.groq;
    }
  } catch {}
  const r = spawnSync(goBin, args, { stdio: "inherit", env: process.env });
  process.exit(r.status ?? 0);
}
if (!isCliFlag && !interactiveTTY && existsSync(goBin) && !forceNode) {
  console.error("> Sin terminal interactivo: se usa el modo Node (la TUI Go necesita teclas reales).");
}

import(pathToFileURL(distEntry).href)
  .then(({ cliMain }) => cliMain(process.argv.slice(2), { invokedAs }))
  .then((code) => { process.exitCode = code ?? 0; })
  .catch((err) => {
    console.error(`[error] no se pudo arrancar NoiraCoder: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  });
