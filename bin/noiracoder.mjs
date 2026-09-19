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
// HITO 0 (puerta de seguridad): por defecto SIEMPRE motor Node.
// La pantalla Go solo con --go explícito + aviso, y NUNCA vía `nc`.
// Motivo: la Go aún ejecuta herramientas propias sin el sandbox del motor;
// en el Hito 1/2 pasará a ser cliente fino del motor (docs/PROTOCOL.md).
const wantGo = args.includes("--go");
const isNc = invokedAs === "nc" || invokedAs === "nc.cmd" || invokedAs === "nc.ps1";
// Escape hatch: fuerza el camino Node (sin TUI Go) aunque haya terminal.
const forceNode = args.includes("--no-tui") || args.includes("--repl") || process.env.NOIRA_NO_TUI === "1";
// La TUI Go necesita un terminal interactivo REAL para leer teclas: sin stdin
// TTY (pipes, scripts, CI, npx con stdio redirigido) se quedaría esperando
// teclas eternamente sin responder. En ese caso se usa siempre el camino
// Node (runRepl), que completa por EOF y sale con código 0.
const interactiveTTY = !!process.stdin.isTTY && !!process.stdout.isTTY;
if (wantGo && !isNc && !forceNode && interactiveTTY && existsSync(goBin)) {
  console.error("> AVISO: la pantalla Go (--go) es experimental: ejecuta herramientas propias SIN el sandbox del motor.");
  console.error("> Úsala solo para pruebas visuales. En el Hito 2 será cliente fino del motor con sandbox completo.");
  const r = spawnSync(goBin, args.filter((a) => a !== "--go"), { stdio: "inherit", env: process.env });
  process.exit(r.status ?? 0);
}
if (wantGo && !isNc && !interactiveTTY) {
  console.error("> --go necesita terminal interactivo: se usa el motor Node.");
}
if (wantGo && isNc) {
  console.error("> `nc` es siempre el respaldo Ink/Node: --go se ignora.");
}

import(pathToFileURL(distEntry).href)
  .then(({ cliMain }) => cliMain(args.filter((a) => a !== "--go"), { invokedAs }))
  .then((code) => { process.exitCode = code ?? 0; })
  .catch((err) => {
    console.error(`[error] no se pudo arrancar NoiraCoder: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  });
