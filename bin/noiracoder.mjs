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
// HITO 0/1: motor Node es respaldo para pipes/CI/nc/--no-tui.
// 2026-09-26: Go TUI es el default en terminales interactivas.
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

/** Punto 3: mata un proceso con su árbol (sin huérfanos en Windows). */
function killTree(proc) {
  if (!proc || proc.exitCode !== null) return;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(proc.pid), "/T", "/F"]);
    } else proc.kill("SIGTERM");
  } catch { /* ya salió */ }
}

/** Punto 3: limpia huérfanos PROPIOS de arranques anteriores (padre muerto +
 * línea de comandos nuestra). Nunca toca procesos con padre vivo. Best-effort.
 */
async function cleanOrphans() {
  try {
    const { execFileSync } = await import("node:child_process");
    const ownPid = String(process.pid);
    const pats = ["serve --thin", "noira-thin"];
    if (process.platform === "win32") {
      const out = execFileSync("powershell",
        ["-NoProfile", "-Command",
          "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*serve --thin*' -or $_.Name -like 'noira-thin*' } | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress"],
        { timeout: 15000, stdio: ["ignore", "pipe", "ignore"] }).toString();
      let list = [];
      try { list = JSON.parse(out); } catch { return; }
      if (!Array.isArray(list)) list = [list];
      const alive = new Set(list.map((p) => String(p.ProcessId)));
      for (const p of list) {
        const pid = String(p.ProcessId);
        if (pid === ownPid) continue;
        const ppid = String(p.ParentProcessId);
        if (alive.has(ppid)) continue; // padre vivo: no es huérfano
        try { execFileSync("taskkill", ["/pid", pid, "/T", "/F"], { stdio: "ignore" }); } catch {}
      }
    } else {
      const out = execFileSync("ps", ["-eo", "pid,ppid,args"], { timeout: 10000 }).toString();
      const rows = out.split("\n").slice(1).map((l) => l.trim().split(/\s+/));
      const alive = new Set(rows.map((r) => r[0]));
      for (const [pid, ppid, ...args] of rows) {
        if (!pid || pid === ownPid) continue;
        const cmd = args.join(" ");
        if (!pats.some((p) => cmd.includes(p))) continue;
        if (alive.has(ppid)) continue;
        try { process.kill(Number(pid), "SIGKILL"); } catch {}
      }
    }
  } catch { /* limpieza best-effort: nunca bloquea el arranque */ }
}

/** HITO 1.3 + verificación: arranca motor thin + pantalla Go, ciclo de vida completo. */
async function startGo() {
  // Override para pruebas (binario roto a propósito): NOIRA_THIN_BIN.
  const overrideBin = process.env.NOIRA_THIN_BIN || "";
  const bin = overrideBin || thinBin;
  if (!existsSync(bin)) {
    console.error("> Sin binario thin (noira-thin): se usa el respaldo Ink/Node.");
    console.error("> El binario llega con hash verificado (Hito 6); en desarrollo: npm run build:thin");
    process.env.NOIRA_NOTICE = "Pantalla Go no disponible: falta el binario. Arreglo: npm run build:thin (o espera la 0.2.0). Sigues en el motor Node.";
    startNode();
    return;
  }
  const { default: net } = await import("node:net");
  // Punto 3: antes de arrancar, limpia huérfanos propios de sesiones muertas.
  await cleanOrphans();
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
    process.env.NOIRA_NOTICE = "Pantalla Go no disponible: el motor no arrancó. Sigues en el motor Node.";
    startNode();
    return;
  }
  console.error("> Pantalla Go (cliente fino del motor).");
  const t0 = Date.now();
  const go = spawn(bin, [], {
    env: { ...process.env, NOIRA_PORT: String(port), NOIRA_TOKEN: token },
    // stdout+stdin heredados (la TUI pinta ahí); stderr por pipe para
    // diagnosticar arranques fallidos sin manchar la pantalla.
    stdio: ["inherit", "inherit", "pipe"],
  });
  let goErr = "";
  go.stderr?.on("data", (c) => { goErr = (goErr + String(c)).slice(-2000); });
  // Punto 3: si el WRAPPER muere o lo matan (cierre de ventana, Ctrl+C,
  // taskkill), los hijos mueren con él. Sin esto quedaban huérfanos.
  let cleaning = false;
  const cleanBoth = () => {
    if (cleaning) return;
    cleaning = true;
    clearTimeout(noClientWatch);
    killTree(go);
    killTree(motor);
  };
  process.once("SIGINT", () => { cleanBoth(); process.exit(130); });
  process.once("SIGTERM", () => { cleanBoth(); process.exit(143); });
  process.once("SIGHUP", () => { cleanBoth(); process.exit(129); });
  process.once("exit", () => { cleanBoth(); });
  const goGone = new Promise((resolve) => {
    go.once("exit", (code) => resolve(code));
    go.once("error", (err) => resolve({ spawnError: err }));
  });
  // Si la pantalla no conecta al motor en 10 s (colgada antes del SSE),
  // se la mata y se cae a Ink con mensaje claro.
  const noClientWatch = setTimeout(async () => {
    if (go.exitCode !== null) return;
    try {
      const r = await fetch(`http://127.0.0.1:${port}/v1/status`, {
        headers: { Authorization: `Bearer ${token}`, "X-Noira-Protocol": "2" },
      });
      const st = await r.json().catch(() => ({}));
      if (st && st.clientes === 0) {
        console.error("> La pantalla Go no conectó en 10 s (colgada); se usa el respaldo Ink/Node.");
        process.env.NOIRA_NOTICE = "Pantalla Go no disponible: no conectó en 10 s (colgada). Sigues en el motor Node.";
        killTree(go);
      }
    } catch { /* el motor dirá; no decidir aquí */ }
  }, 10000);
  // Si el motor muere primero, mata la Go (sin huérfanos); la Go ya muestra fatal.
  void motorGone.then(() => killTree(go));
  const code = await goGone;
  clearTimeout(noClientWatch);
  killTree(motor);
  if (code !== null && typeof code === "object" && code.spawnError) {
    // El binario ni siquiera arrancó (arquitectura, permisos, fichero roto).
    console.error(`> La pantalla Go no arrancó (${code.spawnError.message || code.spawnError}); se usa el respaldo Ink/Node.`);
    process.env.NOIRA_NOTICE = "Pantalla Go no disponible: el binario no arrancó (arquitectura o permisos). Sigues en el motor Node.";
    startNode();
    return;
  }
  if (code === 3) {
    // Protocolo distinto u otro error fatal del cliente: Ink con aviso.
    console.error("> La pantalla Go no pudo hablar con el motor; se usa el respaldo Ink/Node.");
    process.env.NOIRA_NOTICE = "Pantalla Go no disponible: protocolo incompatible. Actualiza noira y noira-thin. Sigues en el motor Node.";
    startNode();
    return;
  }
  if (typeof code === "number" && code !== 0 && Date.now() - t0 < 3000) {
    // Murió sola antes de 3 s (cuelgue en arranque, hash corrupto, etc.).
    console.error(`> La pantalla Go terminó muy pronto (código ${code}); se usa el respaldo Ink/Node.`);
    if (goErr) console.error(goErr.split("\n").slice(-5).join("\n"));
    process.env.NOIRA_NOTICE = `Pantalla Go no disponible: terminó sola (código ${code}). Sigues en el motor Node.`;
    startNode();
    return;
  }
  process.exit(code ?? 0);
}

// 2026-09-26: Go TUI es el default en terminales interactivas.
// --go sigue aceptado (backward compat); --no-tui fuerza Ink.
if (!isNc && !forceNode && interactiveTTY) {
  void startGo();
} else {
  if (!interactiveTTY && !forceNode) {
    console.error("> Sin terminal interactivo: se usa el motor Node.");
    process.env.NOIRA_NOTICE = "Pantalla Go no disponible: sin terminal interactivo. Sigues en el motor Node.";
  }
  if (isNc) {
    console.error("> `nc` es siempre el respaldo Ink/Node.");
  }
  startNode();
}
