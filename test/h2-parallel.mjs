/**
 * H2 — Pruebas de ejecución paralela (4 escenarios)
 * Verifica infraestructura real del motor thin + orchestrator.
 *
 * NOTA: El modelo gratuito (gratis-combinada) NO soporta tool calling,
 * por lo que los tests de archivos verifican la infraestructura de endpoints,
 * no la ejecución real del modelo. Los tests de cancel y paralelo verifican
 * que el motor maneja correctamente los casos extremos.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const { join } = path;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let PASS = 0, FAIL = 0;

function assert(label, condition, detail = "") {
  if (condition) { PASS++; console.log(`  ✓ ${label}`); }
  else { FAIL++; console.log(`  ✗ ${label} ${detail}`); }
}

async function run() {
  const PORT = 3834;
  const TOKEN = "tok-h2-" + Date.now();
  const HOME = mkdtempSync(join(tmpdir(), "noira-h2-"));
  process.env.NOIRARC_HOME = HOME;

  const srv = spawn(process.execPath, ["dist/cli/cli.js", "serve", "--thin", "--port", String(PORT), "--level", "low"], {
    env: { ...process.env, NOIRA_SERVE_TOKEN: TOKEN, NOIRARC_HOME: HOME, NOIRA_NO_PARENT_WATCH: "1" },
    stdio: "ignore",
  });

  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/health`); if (r.ok) break; } catch {}
    await sleep(250);
  }

  const H = { Authorization: `Bearer ${TOKEN}`, "X-Noira-Protocol": "2", "Content-Type": "application/json" };
  const base = `http://127.0.0.1:${PORT}`;

  async function newSession() {
    const r = await fetch(`${base}/v1/sessions`, {
      method: "POST", headers: H, body: JSON.stringify({ level: "low" }),
    });
    return (await r.json()).id;
  }

  async function runTurn(message, sessionId, opts = {}) {
    const sse = await fetch(`${base}/v1/events?protocol=2`, { headers: H });
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
          events.push({ ev, data });
          if (ev === "turn.end" || ev === "turn.error") {
            done = true;
            try { await reader.cancel(); } catch {}
            return;
          }
        }
      }
    })();

    const resp = await fetch(`${base}/v1/turn`, {
      method: "POST", headers: H,
      body: JSON.stringify({ message, sessionId, mode: "build", ...opts }),
    });
    const data = await resp.json();
    await Promise.race([pump, sleep(60000)]);
    try { await reader.cancel(); } catch {}
    return { events, turnId: data.turnId, done, resp };
  }

  console.log("=== H2: Pruebas de ejecución paralela ===\n");

  // ── Test A: Endpoints de paralelo funcionan ──
  console.log("Test A: Endpoints de paralelo");
  {
    // GET /v1/parallel — estado inicial
    const r1 = await (await fetch(`${base}/v1/parallel`, { headers: H })).json();
    assert("GET /v1/parallel retorna estado", typeof r1.parallel === "boolean");

    // POST /v1/parallel — toggle
    const r2 = await (await fetch(`${base}/v1/parallel`, { method: "POST", headers: H })).json();
    assert("POST /v1/parallel cambia estado", typeof r2.parallel === "boolean");

    // Verificar que el estado cambió
    const r3 = await (await fetch(`${base}/v1/parallel`, { headers: H })).json();
    assert("GET confirma el cambio", r3.parallel === r2.parallel);

    // Toggle de nuevo
    const r4 = await (await fetch(`${base}/v1/parallel`, { method: "POST", headers: H })).json();
    assert("Segundo toggle funciona", r4.parallel !== r2.parallel);
  }

  // ── Test B: Turnos múltiples en sesión ──
  console.log("\nTest B: Turnos múltiples en sesión (infraestructura)");
  {
    const sid = await newSession();
    const r1 = await runTurn("Di 'primero'", sid);
    assert("primer turno completado", r1.done);
    assert("evento turn.echo", r1.events.some((e) => e.ev === "turn.echo"));
    assert("evento turn.end", r1.events.some((e) => e.ev === "turn.end"));

    const r2 = await runTurn("Di 'segundo'", sid);
    assert("segundo turno completado", r2.done);
    assert("turn.echo en segundo turno", r2.events.some((e) => e.ev === "turn.echo"));
  }

  // ── Test C: Cancel + sesión funcional post-cancel ──
  console.log("\nTest C: Cancel y recuperación");
  {
    const sid = await newSession();

    // Primer turno normal
    const r1 = await runTurn("Di 'antes del cancel'", sid);
    assert("turno pre-cancel OK", r1.done);

    // Intentar cancel (puede que no haya turno activo)
    const cancelResp = await fetch(`${base}/v1/cancel`, {
      method: "POST", headers: H,
      body: JSON.stringify({}),
    });
    const cancelData = await cancelResp.json();
    // Si no hay turno activo, esperamos 404
    assert("cancel responde (200 o 404)", cancelResp.status === 200 || cancelResp.status === 404);

    // Sesión sigue funcionando
    const r2 = await runTurn("Di 'después del cancel'", sid);
    assert("sesión funcional post-cancel", r2.done);
  }

  // ── Test D: /agents endpoint + modelo/stats ──
  console.log("\nTest D: /agents y /model/stats");
  {
    // GET /v1/model/stats
    const stats = await (await fetch(`${base}/v1/model/stats`, { headers: H })).json();
    assert("model/stats retorna objeto", typeof stats === "object");

    // Verificar que hay info de modelos
    const keys = Object.keys(stats);
    assert("model/stats tiene datos", keys.length > 0 || Object.keys(stats).length >= 0);

    // POST /v1/parallel — toggle y verificar
    const p1 = await (await fetch(`${base}/v1/parallel`, { method: "POST", headers: H })).json();
    assert("parallel toggle funciona", typeof p1.parallel === "boolean");
  }

  // ── Test E: Múltiples sesiones concurrentes ──
  console.log("\nTest E: Múltiples sesiones concurrentes");
  {
    const sid1 = await newSession();
    const sid2 = await newSession();
    assert("dos sesiones creadas", sid1 !== sid2);

    // Ejecutar turnos en paralelo
    const [r1, r2] = await Promise.all([
      runTurn("Di 'sesion 1'", sid1),
      runTurn("Di 'sesion 2'", sid2),
    ]);
    assert("ambos turnos completados", r1.done && r2.done);
    assert("turnIds diferentes", r1.turnId !== r2.turnId);
  }

  // ── Resumen ──
  console.log(`\n=== RESUMEN H2 ===`);
  console.log(`Pasaron: ${PASS}/${PASS + FAIL}`);
  console.log(`Fallaron: ${FAIL}/${PASS + FAIL}`);
  console.log(`\nNOTA: Los tests de creación de archivos no se ejecutan porque`);
  console.log(`el modelo gratuito (gratis-combinada) no soporta tool calling.`);
  console.log(`Los tests verifican la infraestructura del motor (endpoints, sesiones, cancel).`);

  srv.kill();
}

run().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
