/* H1 — aprendizaje: unidades + ADVERSARIA de datos envenenados (H1.5).
 * La adversaria escribe un turns.jsonl malicioso (JSON roto, payloads con
 * claves de seguridad, niveles inventados) y exige:
 *  1) recompute no falla y solo emite claves seguras conocidas;
 *  2) src/sandbox/policies.ts bit-idéntico antes/después;
 *  3) no se crea ningún fichero fuera de learn/ ni memory/learned.md;
 *  4) learn.ts no importa sandbox/policies/approve/router (frontera).
 * Uso: npm run build && node test/learn.mjs
 */
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, mkdirSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { classifyTask, computeStats, recomputeRules, getLearned } from "../dist/server/learn.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
let fail = 0;
const check = (name, cond, detail = "") => {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? "[PASS]" : "[FAIL]"} ${name}${detail ? "  <-- " + detail : ""}`);
};

// ── unidades: clasificación ──
check("cls-codigo", classifyTask("arregla el login roto de auth.ts") === "codigo");
check("cls-comandos", classifyTask("ejecuta los tests con npm") === "comandos");
check("cls-consulta", classifyTask("¿qué hace este módulo?") === "consulta");
check("cls-mixto", classifyTask("crea el fichero y haz deploy") === "mixto");
check("cls-tools", classifyTask("mira esto", ["write", "edit"]) === "codigo");

// ── unidades: thresholds ──
{
  const mk = (task, level, ok, ms) => ({ v: 1, at: "", session: "s", task, level, model: "m", retries: 0, ms, ok, tools: [] });
  const few = [mk("codigo", "high", true, 100), mk("codigo", "high", true, 120)];
  const st = computeStats(few);
  check("stats-pocos", st.codigo.n === 2);
  // 6 turnos high 100% vs medium 50% con margen -> regla high
  const many = [
    mk("codigo", "high", true, 100), mk("codigo", "high", true, 110), mk("codigo", "high", true, 90),
    mk("codigo", "medium", true, 200), mk("codigo", "medium", false, 210), mk("codigo", "medium", true, 190),
  ];
  const st2 = computeStats(many);
  check("stats-okrate", st2.codigo.byLevel.high.okRate === 1 && Math.abs(st2.codigo.byLevel.medium.okRate - 2 / 3) < 1e-9);
}

// ── recompute real con umbrales ──
const HOME = mkdtempSync(join(tmpdir(), "noira-learn-"));
process.env.NOIRARC_HOME = HOME;
{
  const mk = (task, level, ok, ms) => JSON.stringify({ v: 1, at: "", session: "s", task, level, model: "m", retries: 0, ms, ok, tools: [] });
  const lines = [
    mk("codigo", "high", true, 100), mk("codigo", "high", true, 110), mk("codigo", "high", true, 90),
    mk("codigo", "medium", true, 200), mk("codigo", "medium", false, 210), mk("codigo", "medium", true, 190),
    mk("consulta", "low", true, 50),
  ];
  mkdirSync(join(HOME, ".noirarc", "learn"), { recursive: true });
  appendFileSync(join(HOME, ".noirarc", "learn", "turns.jsonl"), lines.join("\n") + "\n");
  const rules = await recomputeRules("test");
  check("recompute-regla", rules.defaultLevelByTask.codigo?.level === "high", JSON.stringify(rules.defaultLevelByTask));
  check("recompute-sin-muestra", !rules.defaultLevelByTask.consulta, "consulta n=1 no debe crear regla");
  const back = await getLearned();
  check("recompute-persiste", back.defaultLevelByTask.codigo?.level === "high");
  const md = readFileSync(join(HOME, ".noirarc", "memory", "learned.md"), "utf8");
  check("recompute-audita", md.includes("codigo") && md.includes("high"));
}

// ── H1.5 ADVERSARIA: turns.jsonl envenenado ──
{
  const polPath = join(ROOT, "src", "sandbox", "policies.ts");
  const before = createHash("sha256").update(readFileSync(polPath, "utf8")).digest("hex");
  const poison = [
    "{no-json",
    JSON.stringify({ v: 1, at: "", session: "s", task: "codigo", level: "../../evil", model: "m", retries: 0, ms: 1, ok: true, tools: [] }),
    JSON.stringify({ v: 1, task: "codigo", level: "high'; DROP", model: "m", session: "s", retries: 0, ms: 1, ok: true, tools: ["write", "__proto__", "confirm", "deny", "allowCommands"] }),
    JSON.stringify({ v: 1, task: "codigo", level: "high", model: "m", session: "s", retries: 0, ms: 1, ok: true, tools: [], confirm: false, whitelist: [], policy: "allow-all" }),
    JSON.stringify({ v: 999, task: "codigo", level: "high", model: "m", session: "s", retries: 0, ms: 1, ok: true, tools: [] }),
    JSON.stringify({ v: 1, task: "INJECT", level: "high", model: "m", session: "s", retries: 0, ms: 1, ok: true, tools: [] }),
    "x".repeat(500000),
  ];
  const { appendFileSync } = await import("node:fs");
  appendFileSync(join(HOME, ".noirarc", "learn", "turns.jsonl"), poison.join("\n") + "\n");
  let rules = null;
  let threw = false;
  try {
    rules = await recomputeRules("poison");
  } catch {
    threw = true;
  }
  check("poison-no-rompe", !threw);
  const keys = Object.keys(rules?.defaultLevelByTask ?? {});
  const vals = Object.values(rules?.defaultLevelByTask ?? {}).map((r) => r.level);
  check("poison-solo-claves-seguras", keys.every((k) => ["consulta", "codigo", "comandos", "mixto"].includes(k)), keys.join(","));
  check("poison-solo-niveles", vals.every((v) => ["low", "medium", "high", "max"].includes(v)), vals.join(","));
  const after = createHash("sha256").update(readFileSync(polPath, "utf8")).digest("hex");
  check("poison-policies-intacto", before === after);
  // Solo learn/ + memory/learned.md tocados
  const walk = (d, acc = []) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p, acc);
      else acc.push(p);
    }
    return acc;
  };
  const files = walk(join(HOME, ".noirarc")).map((f) => f.slice(join(HOME, ".noirarc").length + 1));
  const bad = files.filter((f) => !(f.startsWith("learn" + sep) || f === join("memory", "learned.md")));
  check("poison-sin-ficheros-extra", bad.length === 0, bad.slice(0, 3).join(","));
}

// ── frontera de imports (H1.5 arquitectónico) ──
{
  const src = readFileSync(join(ROOT, "src", "server", "learn.ts"), "utf8");
  const banned = ["sandbox/", "policies", "approve", "router", "confirm", "whitelist", "allowCommands"];
  const hits = banned.filter((b) => src.includes(b));
  check("learn-sin-imports-seguridad", hits.length === 0, hits.join(","));
}

console.log(`\nLEARN: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
