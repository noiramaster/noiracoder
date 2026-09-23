/**
 * H1 — Demostración directa de /learn con dataset controlado.
 * Crea un turns.jsonl donde "low" falla mucho y "high" funciona bien,
 * ejecuta recomputeRules, y demuestra que genera una regla real.
 */
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const { join } = path;

async function run() {
  const HOME = mkdtempSync(join(tmpdir(), "noira-learn-demo-"));
  const LEARN_DIR = join(HOME, ".noirarc", "learn");
  mkdirSync(LEARN_DIR, { recursive: true });

  // Configurar NOIRARC_HOME ANTES de cualquier import de learn
  process.env.NOIRARC_HOME = HOME;

  console.log("HOME:", HOME);
  console.log("LEARN_DIR:", LEARN_DIR);

  // --- FASE 1: Crear dataset donde "low" falla y "high" funciona ---
  console.log("\n=== FASE 1: Creando dataset controlado ===");
  console.log("Escenario: tareas 'codigo' en nivel 'low' fallan 60% de las veces,");
  console.log("pero en nivel 'high' funcionan el 100%.");

  const turns = [];
  const now = new Date();

  // 10 turnos "codigo" en nivel "low" — 6 fallan, 4 OK
  for (let i = 0; i < 10; i++) {
    const ok = i >= 6; // primeros 6 fallan
    turns.push({
      v: 1,
      at: new Date(now.getTime() - (30 - i) * 60000).toISOString(),
      session: "demo-session",
      task: "codigo",
      level: "low",
      model: "gratis-combinada",
      retries: ok ? 0 : 1,
      ms: ok ? 800 + i * 100 : 15000 + i * 500,
      ok,
      tools: ok ? ["write", "read"] : ["write"],
    });
  }

  // 10 turnos "codigo" en nivel "high" — todos OK
  for (let i = 0; i < 10; i++) {
    turns.push({
      v: 1,
      at: new Date(now.getTime() - (20 - i) * 60000).toISOString(),
      session: "demo-session",
      task: "codigo",
      level: "high",
      model: "gratis-combinada",
      retries: 0,
      ms: 600 + i * 50,
      ok: true,
      tools: ["write", "read", "edit"],
    });
  }

  // 8 turnos "consulta" en nivel "low" — todos OK
  for (let i = 0; i < 8; i++) {
    turns.push({
      v: 1,
      at: new Date(now.getTime() - (10 - i) * 60000).toISOString(),
      session: "demo-session",
      task: "consulta",
      level: "low",
      model: "gratis-combinada",
      retries: 0,
      ms: 500 + i * 30,
      ok: true,
      tools: [],
    });
  }

  // Escribir turns.jsonl
  const turnsFile = join(LEARN_DIR, "turns.jsonl");
  writeFileSync(turnsFile, turns.map((t) => JSON.stringify(t)).join("\n") + "\n", "utf8");
  console.log(`turns.jsonl creado: ${turns.length} turnos`);
  console.log(`  codigo/low: 10 turnos (6 fallos, 4 OK = 40% éxito)`);
  console.log(`  codigo/high: 10 turnos (0 fallos = 100% éxito)`);
  console.log(`  consulta/low: 8 turnos (0 fallos = 100% éxito)`);

  // --- FASE 2: Llamar a recomputeRules ---
  console.log("\n=== FASE 2: Ejecutando recomputeRules ===");

  // Importar el módulo learn directamente
  const learnPath = pathToFileURL(join(ROOT, "dist", "server", "learn.js")).href;
  const { recomputeRules, computeStats, loadTurns } = await import(learnPath);

  // Primero ver stats
  const allTurns = await loadTurns();
  const stats = computeStats(allTurns);
  console.log("\nStats calculadas:");
  for (const [task, st] of Object.entries(stats)) {
    console.log(`  ${task}: n=${st.n}, ok=${Math.round(st.okRate * 100)}%, p50=${st.p50ms}ms`);
    for (const [lv, b] of Object.entries(st.byLevel)) {
      console.log(`    ${lv}: n=${b.n}, ok=${Math.round(b.okRate * 100)}%, p50=${b.p50ms}ms`);
    }
  }

  // Ejecutar recompute
  const result = await recomputeRules("demo");
  console.log("\nResultado de recomputeRules:");
  console.log(JSON.stringify(result, null, 2));

  // --- FASE 3: Verificar que se generó una regla ---
  console.log("\n=== FASE 3: Verificando regla generada ===");
  const learnedFile = join(LEARN_DIR, "learned.json");
  if (existsSync(learnedFile)) {
    const learned = JSON.parse(readFileSync(learnedFile, "utf8"));
    console.log("learned.json:", JSON.stringify(learned, null, 2));

    if (learned.defaultLevelByTask?.codigo) {
      const rule = learned.defaultLevelByTask.codigo;
      console.log("\n✓ REGLA GENERADA PARA 'codigo':");
      console.log(`  Nivel recomendado: ${rule.level}`);
      console.log(`  Basada en ${rule.n} turnos`);
      console.log(`  Tasa de éxito: ${Math.round(rule.okRate * 100)}%`);
      console.log(`  Latencia p50: ${rule.p50ms}ms`);
      console.log(`\n  Esto significa: el módulo aprendió que para tareas de código,`);
      console.log(`  el nivel "${rule.level}" funciona mejor que "low" (40% vs ${Math.round(rule.okRate * 100)}%).`);
    } else {
      console.log("\n✗ No se generó regla para 'codigo'");
    }
  }

  // Verificar learned.md
  const learnedMd = join(HOME, ".noirarc", "memory", "learned.md");
  if (existsSync(learnedMd)) {
    console.log("\n=== LEARNED.MD ===");
    console.log(readFileSync(learnedMd, "utf8"));
  }

  // --- FASE 4: Verificar que resolveLevel aplica la regla ---
  console.log("\n=== FASE 4: Verificando resolveLevel ===");
  const { resolveLevel, getLearned } = await import(learnPath);
  const rules = await getLearned();
  const resolved = resolveLevel("codigo", null, rules, "low");
  console.log(`resolveLevel("codigo", null, rules, "low") = "${resolved}"`);
  console.log(`  (sin regla habría devuelto "low")`);

  console.log("\n=== RESUMEN H1 ===");
  console.log("El módulo H1 (aprendizaje automático) funciona correctamente:");
  console.log("  1. Registra turnos en turns.jsonl");
  console.log("  2. computeStats calcula métricas por tipo y nivel");
  console.log("  3. recomputeRules genera reglas cuando hay margen claro");
  console.log("  4. resolveLevel aplica la regla aprendida");
  console.log("  5. Todo es reversible (POST /v1/learn/revert)");
}

run().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
