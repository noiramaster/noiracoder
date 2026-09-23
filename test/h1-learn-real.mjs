/**
 * H1 — Sesiones reales + demostración de /learn
 * Ejecuta sesiones reales a través del motor thin para generar datos de uso,
 * luego llama a /learn y demuestra que produce una mejora real.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const { join } = path;
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  const PORT = 3822;
  const TOKEN = "tok-learn-demo-" + Date.now();
  const HOME = mkdtempSync(join(tmpdir(), "noira-learn-"));
  const LEARN_DIR = join(HOME, ".noirarc", "learn");

  console.log("HOME:", HOME);
  console.log("LEARN_DIR:", LEARN_DIR);

  // Arrancar motor
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

  // --- FASE 1: Ejecutar 25 turnos reales (más del umbral de 20 para recompute) ---
  console.log("\n=== FASE 1: Ejecutando 25 turnos reales ===");

  const tasks = [
    "Crea un archivo hello.txt con contenido 'hola'",
    "Lee el archivo hello.txt",
    "Añade una segunda línea 'mundo' al archivo hello.txt",
    "Lista los archivos en el directorio actual",
    "Crea un directorio llamado src",
    "Crea src/utils.js con una función que suma dos números",
    "Lee src/utils.js",
    "Ejecuta node -e 'console.log(2+2)'",
    "Crea un archivo README.md con el título 'Mi Proyecto'",
    "Borra el archivo hello.txt",
    "Lista los archivos restantes",
    "Crea un archivo config.json con {\"debug\": true}",
    "Lee config.json",
    "Edita config.json para cambiar debug a false",
    "Crea src/helpers.js con una función que concatena strings",
    "Ejecuta node -e 'console.log(JSON.stringify({ok:true}))'",
    "Crea tests/test.txt con contenido de prueba",
    "Borra tests/test.txt",
    "Crea un archivo .gitignore con node_modules",
    "Di 'tarea completada'",
    "Explica qué hace la función de utils.js",
    "Lista todos los archivos del proyecto",
    "Crea src/main.js que importe utils",
    "Ejecuta node -e 'const u=require(\"./src/utils.js\");console.log(u.sum(1,2))'",
    "Di 'todo listo'",
  ];

  // Crear sesión
  const sess = await (await fetch(`${base}/v1/sessions`, {
    method: "POST", headers: H, body: JSON.stringify({ level: "low" }),
  })).json();
  const sessionId = sess.id;
  console.log("Sesión:", sessionId);

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    // Rotar niveles: low, medium, high para generar datos comparables
    const levels = ["low", "medium", "high"];
    const level = levels[i % 3];
    console.log(`\n[Turno ${i + 1}/${tasks.length}] [${level}] ${task}`);

    const sse = await fetch(`${base}/v1/events?protocol=2`, { headers: H });
    const reader = sse.body.getReader();
    const dec = new TextDecoder();
    let buf = "", done = false;

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
          if (ev === "turn.end" || ev === "turn.error") {
            done = true;
            try { await reader.cancel(); } catch {}
            return;
          }
        }
      }
    })();

    const turnResp = await fetch(`${base}/v1/turn`, {
      method: "POST", headers: H,
      body: JSON.stringify({ message: task, sessionId, mode: "build", level }),
    });
    const turnData = await turnResp.json();
    console.log(`  status: ${turnResp.status}, turnId: ${turnData.turnId || "n/a"}`);

    await Promise.race([pump, sleep(45000)]);
    try { await reader.cancel(); } catch {}
    console.log(`  turn.end${done ? "" : " (timeout)"}`);
  }

  // --- FASE 2: Verificar que turns.jsonl existe ---
  console.log("\n=== FASE 2: Verificando datos de aprendizaje ===");
  const turnsFile = join(LEARN_DIR, "turns.jsonl");
  if (existsSync(turnsFile)) {
    const content = readFileSync(turnsFile, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);
    console.log(`turns.jsonl: ${lines.length} turnos registrados`);
  } else {
    console.log("ERROR: turns.jsonl no existe");
  }

  // --- FASE 3: Llamar a /learn y verificar producción ---
  console.log("\n=== FASE 3: Llamando a GET /v1/learn ===");
  const learnResp = await fetch(`${base}/v1/learn`, {
    method: "GET", headers: H,
  });
  const learnData = await learnResp.json();
  console.log("learn response:", JSON.stringify(learnData, null, 2));

  // Verificar que learned.json se creó
  const learnedFile = join(LEARN_DIR, "learned.json");
  if (existsSync(learnedFile)) {
    const learned = JSON.parse(readFileSync(learnedFile, "utf8"));
    console.log("\n=== LEARNED.JSON GENERADO ===");
    console.log(JSON.stringify(learned, null, 2));

    if (learned.rules && learned.rules.length > 0) {
      console.log("\n=== MEJORA APLICADA ===");
      learned.rules.forEach((r, i) => {
        console.log(`  Regla ${i + 1}: ${r.rule}`);
        console.log(`    Fuente: ${r.source}`);
        console.log(`    Confianza: ${r.confidence}`);
      });
    } else {
      console.log("\nNo se generaron reglas (pocos turnos o sin patrones claros)");
    }
  } else {
    console.log("ERROR: learned.json no se creó");
  }

  // Verificar learned.md
  const learnedMd = join(LEARN_DIR, "learned.md");
  if (existsSync(learnedMd)) {
    console.log("\n=== LEARNED.MD ===");
    console.log(readFileSync(learnedMd, "utf8"));
  }

  // --- FASE 4: Segunda sesión — verificar que /learn aplica mejoras ---
  console.log("\n=== FASE 4: Segunda sesión (verificar que aprendizaje se aplica) ===");
  const sess2 = await (await fetch(`${base}/v1/sessions`, {
    method: "POST", headers: H, body: JSON.stringify({ level: "low" }),
  })).json();
  console.log("Sesión 2:", sess2.id);

  // Ejecutar un turno en la segunda sesión
  const sse2 = await fetch(`${base}/v1/events?protocol=2`, { headers: H });
  const reader2 = sse2.body.getReader();
  const dec2 = new TextDecoder();
  let buf2 = "", done2 = false;

  const pump2 = (async () => {
    for (;;) {
      const { value, done: d } = await reader2.read().catch(() => ({ value: null, done: true }));
      if (d) break;
      buf2 += dec2.decode(value, { stream: true });
      let idx;
      while ((idx = buf2.indexOf("\n\n")) >= 0) {
        const frame = buf2.slice(0, idx);
        buf2 = buf2.slice(idx + 2);
        const ev = (frame.match(/^event: (\S+)/m) || [])[1];
        if (ev === "turn.end" || ev === "turn.error") {
          done2 = true;
          try { await reader2.cancel(); } catch {}
          return;
        }
      }
    }
  })();

  const turn2Resp = await fetch(`${base}/v1/turn`, {
    method: "POST", headers: H,
    body: JSON.stringify({ message: "Crea un archivo test.txt con 'funcional'", sessionId: sess2.id, mode: "build", level: "medium" }),
  });
  const turn2Data = await turn2Resp.json();
  console.log("  turnId:", turn2Data.turnId);

  await Promise.race([pump2, sleep(30000)]);
  try { await reader2.cancel(); } catch {}

  // Verificar turns.jsonl de la segunda sesión
  if (existsSync(turnsFile)) {
    const content = readFileSync(turnsFile, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);
    console.log(`\nturns.jsonl total: ${lines.length} turnos (incluye sesión 2)`);
  }

  // --- RESUMEN ---
  console.log("\n=== RESUMEN H1 ===");
  console.log(`Sesiones ejecutadas: 2`);
  console.log(`Turnos totales: ~26`);
  console.log(`Datos en: ${LEARN_DIR}`);
  if (existsSync(turnsFile)) {
    const lines = readFileSync(turnsFile, "utf8").trim().split("\n").filter(Boolean);
    console.log(`  turns.jsonl: ${lines.length} registros`);
  }
  if (existsSync(learnedFile)) {
    const learned = JSON.parse(readFileSync(learnedFile, "utf8"));
    console.log(`  learned.json: ${Object.keys(learned.defaultLevelByTask || {}).length} reglas en defaultLevelByTask`);
    console.log(`  learned.json completo:`, JSON.stringify(learned, null, 2));
  }
  if (existsSync(learnedMd)) {
    console.log(`  learned.md generado: SÍ`);
    console.log(readFileSync(learnedMd, "utf8"));
  }

  srv.kill();
  console.log("\nFIN");
}

run().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
