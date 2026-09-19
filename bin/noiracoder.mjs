#!/usr/bin/env node
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, basename } from "node:path";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const distEntry = join(here, "..", "dist", "cli", "cli.js");
const invokedAs = basename(process.argv[1] ?? "");
// HITO 1: cliente fino. El binario thin (sin motor heredado) es noira-thin.
// El legacy noira-go.exe (motor propio sin sandbox) YA NO se lanza nunca.
const thinBin = existsSync(join(here, "noira-thin.exe"))
  ? join(here, "noira-thin.exe")
  : join(here, "noira-thin");

const args = process.argv.slice(2);
const isCliFlag = args.some((a) => ["--help","-h","--version","-v","serve","login","--lang"].includes(a) || a === "-l" || a === "--level");
// HITO 0/1: por defecto SIEMPRE motor Node. Pantalla Go solo con --go + aviso,
// y NUNCA vía `nc` (respaldo Ink/Node).
const wantGo = args.includes("--go");
const isNc = invokedAs === "nc" || invokedAs === "nc.cmd" || invokedAs === "nc.ps1";
// Escape hatch: fuerza el camino Node aunque haya terminal.
const forceNode = args.includes("--no-tui") || args.includes("--repl") || process.env.NOIRA_NO_TUI === "1";
// La TUI necesita terminal interactivo REAL; sin TTY se usa Node (EOF + exit 0).
const interactiveTTY = !!process.stdin.isTTY && !!process.stdout.isTTY;
const nodeArgs = args.filter((a) => a !== "--go");

function startNode() {
  import(pathToFileURL(distEntry).href)
    .then(({ cliMain }) => cliMain(nodeArgs, { invokedAs }))
    .then((code) => { process.exitCode = code ?? 0; })
    .catch((err) => {
      console.error(`[error] no se pudo arrancar NoiraCoder: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    });
}

/** HITO 1.3: arranca motor thin + pantalla Go, ciclo de vida completo. */
async function startGo() {
  if (!existsSync(thinBin)) {
    console.error("> Sin binario thin (noira-thin): se usa el respaldo Ink/Node.");
    console.error("> El binario llega en el Hito 6 con hash verificado; en desarrollo: go build ./cmd/noira-thin");
    startNode();
    return;
  }
  const { default: net } = await import("node:net");
  const port = await new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const p = s.address()?.port;
      s.close(() => resolve(p));
    });
  });
  const token = randomBytes(32).toString("hex");
  const nodeBin = process.execPath;
  const motor = spawn(nodeBin, [distEntry, "serve", "--thin", "--port", String(port)], {
    env: { ...process.env, NOIRA_SERVE_TOKEN: token },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let motorErr = "";
  motor.stderr?.on("data", (c) => { motorErr += String(c).slice(-2000); });
  const motorGone = new Promise((resolve) => motor.once("exit", (code) => resolve(code)));

  // Espera /health (máx ~6 s).
  let healthy = false;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 200));
    if (motor.exitCode !== null) break;
    try {
      const r = await fetch(`http://127.0.0.1:${port}/health`);
      if (r.ok) { healthy = true; break; }
    } catch { /* aún arrancando */ }
  }
  if (!healthy) {
    try { motor.kill(); } catch { /* ya muerto */ }
    console.error("> El motor no arrancó a tiempo; se usa el respaldo Ink/Node.");
    if (motorErr) console.error(motorErr.split("\n").slice(-5).join("\n"));
    startNode();
    return;
  }
  console.error("> Pantalla Go (cliente fino del motor, Hito 1).");
  const go = spawn(thinBin, [], {
    env: { ...process.env, NOIRA_PORT: String(port), NOIRA_TOKEN: token },
    stdio: "inherit",
  });
  const goGone = new Promise((resolve) => go.once("exit", (code) => resolve(code)));
  // Si el motor muere primero, mata la Go (sin huérfanos); la Go ya muestra fatal.
  void motorGone.then(() => {
    if (go.exitCode === null) {
      try {
        if (process.platform === "win32") {
          spawn("taskkill", ["/pid", String(go.pid), "/T", "/F"]);
        } else go.kill("SIGTERM");
      } catch { /* ya salió */ }
    }
  });
  const code = await goGone;
  try {
    if (motor.exitCode === null) {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(motor.pid), "/T", "/F"]);
      } else motor.kill("SIGTERM");
    }
  } catch { /* ya salió */ }
  if (code === 3) {
    // Protocolo distinto u otro error fatal del cliente: Ink con aviso.
    console.error("> La pantalla Go no pudo hablar con el motor; se usa el respaldo Ink/Node.");
    startNode();
    return;
  }
  process.exit(code ?? 0);
}

if (wantGo && !isNc && !forceNode && interactiveTTY) {
  void startGo();
} else {
  if (wantGo && !isNc && !interactiveTTY) {
    console.error("> --go necesita terminal interactivo: se usa el motor Node.");
  }
  if (wantGo && isNc) {
    console.error("> `nc` es siempre el respaldo Ink/Node: --go se ignora.");
  }
  startNode();
}
