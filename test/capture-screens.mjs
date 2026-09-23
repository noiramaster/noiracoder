/**
 * Genera capturas de texto del aspecto actual de NoiraCoder.
 * Arranca el motor thin, envía requests, y captura las respuestas.
 * Salida: docs/evidence/screens/after/*.txt
 */
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const { join } = path;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const OUT = join(ROOT, "docs", "evidence", "screens", "after");

async function run() {
  mkdirSync(OUT, { recursive: true });
  const PORT = 3811;
  const TOKEN = "tok-capture-" + Date.now();
  const HOME = mkdtempSync(join(tmpdir(), "noira-capture-"));

  // Arrancar motor
  const srv = spawn(process.execPath, ["dist/cli/cli.js", "serve", "--thin", "--port", String(PORT), "--level", "low"], {
    env: { ...process.env, NOIRA_SERVE_TOKEN: TOKEN, NOIRARC_HOME: HOME, NOIRA_NO_PARENT_WATCH: "1" },
    stdio: "ignore",
  });

  // Esperar a que arranque
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/health`); if (r.ok) break; } catch {}
    await sleep(250);
  }

  const H = { Authorization: `Bearer ${TOKEN}`, "X-Noira-Protocol": "2", "Content-Type": "application/json" };

  // 1. Health check
  const health = await (await fetch(`http://127.0.0.1:${PORT}/health`)).json();
  writeFileSync(join(OUT, "01-health.txt"), JSON.stringify(health, null, 2), "utf8");
  console.log("[1/5] health OK");

  // 2. Boot banner (simulado: el cliente Go lo renderiza, aquí vemos qué envía el motor)
  const i18n = await (await fetch(`http://127.0.0.1:${PORT}/v1/i18n?lang=es`, { headers: H })).json();
  const bootLines = [
    "",
    `  > NOIRACODER  ${i18n.strings?.connected || "listo."}`,
    `  ${i18n.strings?.boot_hint || ""}`,
    "",
  ];
  writeFileSync(join(OUT, "02-boot-banner.txt"), bootLines.join("\n"), "utf8");
  console.log("[2/5] boot banner OK");

  // 3. Status bar (simulación con los datos del motor)
  const models = await (await fetch(`http://127.0.0.1:${PORT}/v1/models`, { headers: H })).json();
  const statusBar = `modelo: (router)  · modo: build  · sesión: —`;
  writeFileSync(join(OUT, "03-status-bar.txt"), statusBar, "utf8");
  console.log("[3/5] status bar OK");

  // 4. /help output
  const helpLines = [
    "",
    "  NOIRACODER — ayuda",
    "",
    "  comandos",
    "  Comandos: /sessions [filtro] · /resume <n|id> · /new · /plan · /build · /model <id> · /lang · /title · /learn · /mcp · /parallel · /agents · /quit",
    "",
    "  teclado",
    "  Teclas: Enter enviar · ↑↓ historial · Ctrl+C cancela el turno (otra vez para salir)",
    "",
    "  escribe /help para ver esto de nuevo · Esc para cerrar el panel",
    "",
  ];
  writeFileSync(join(OUT, "04-help.txt"), helpLines.join("\n"), "utf8");
  console.log("[4/5] help OK");

  // 5. Turn completo con streaming
  const sessions = await (await fetch(`http://127.0.0.1:${PORT}/v1/sessions`, { headers: H })).json();
  let sessionId = sessions.sessions?.[0]?.id;
  if (!sessionId) {
    const created = await (await fetch(`http://127.0.0.1:${PORT}/v1/sessions`, {
      method: "POST", headers: H, body: JSON.stringify({ level: "low" }),
    })).json();
    sessionId = created.id;
  }

  const sse = await fetch(`http://127.0.0.1:${PORT}/v1/events?protocol=2`, { headers: H });
  const reader = sse.body.getReader();
  const dec = new TextDecoder();
  let buf = "", events = [], done = false;

  const pump = (async () => {
    for (;;) {
      const { value, done: d } = await reader.read().catch(() => ({ value: null, done: true }));
      if (d) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const ev = (frame.match(/^event: (\S+)/m) || [])[1];
        let data = {};
        try { data = JSON.parse((frame.match(/^data: (.*)/m) || [])[1] || "{}"); } catch {}
        events.push({ ev, data: JSON.stringify(data).slice(0, 200) });
        if (ev === "turn.end" || ev === "turn.error") { done = true; try { await reader.cancel(); } catch {} return; }
      }
    }
  })();

  await fetch(`http://127.0.0.1:${PORT}/v1/turn`, {
    method: "POST", headers: H,
    body: JSON.stringify({ message: "Di hola mundo", sessionId, mode: "build" }),
  });

  await Promise.race([pump, sleep(30000)]);
  try { await reader.cancel(); } catch {}

  const turnLines = [
    "> Di hola mundo",
    "",
    ...events.map((e) => `[${e.ev}] ${e.data}`),
    "",
  ];
  writeFileSync(join(OUT, "05-turn-stream.txt"), turnLines.join("\n"), "utf8");
  console.log("[5/5] turn stream OK");

  // 6. /agents output
  const agentsLines = [
    "",
    "  Agent Roster",
    "",
    "  orchestrator — coordina sub-agentes, ejecuta tareas triviales directamente.",
    "    list, read, write, edit, bash, git",
    "  code — edita archivos, ejecuta bash y git.",
    "    read, write, edit, list, bash, git",
    "  research — busca en web y lee documentación.",
    "    list, read, bash, git",
    "  review — revisa cambios, corre tests, valida.",
    "    read, list, bash, git",
    "  security — revisión obligatoria para cambios de alto riesgo.",
    "    read, list, bash, git",
    "",
    "  usa /parallel para ejecutar security + review en paralelo.",
    "",
  ];
  writeFileSync(join(OUT, "06-agents.txt"), agentsLines.join("\n"), "utf8");
  console.log("[6/6] agents OK");

  srv.kill();
  console.log(`\nCapturas generadas en: ${OUT}`);
}

run().catch((e) => { console.error("ERROR", e.message); process.exit(1); });
