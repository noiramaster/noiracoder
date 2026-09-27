/**
 * TAREA L — comparativa objetiva NoiraCoder vs OpenCode vs Claude Code.
 * Mismo set de tareas para los 3, criterio AUTOMÁTICO (ficheros, nunca
 * juicio), mide % resuelto + tiempo medio. Tabla literal al final.
 * Sin opiniones, sin publicar sin aprobación.
 *
 * Uso: node test/compare-l.mjs [N]  (N = nº de tareas, por defecto todas)
 *
 * Cada agente corre en su cwd temporal con el prompt idéntico:
 *   noira:   node <root>/dist/cli/cli.js -l low "<prompt>"   (cwd=tarea)
 *   opencode: opencode run "<prompt>"                        (cwd=tarea)
 *   claude:   claude -p "<prompt>" --permission-mode acceptEdits (cwd=tarea)
 */
import { spawnSync, spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require2 = createRequire(import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const N = Number(process.argv[2] || "10");
const PER_TASK_MS = 240000;

const T = (id, kind, files, prompt, check) => ({ id, kind, files, prompt, check });
const F = (name, content) => ({ name, content });

// Subset del banco H1.6/M6 (mismo criterio automático).
const ALL = [
  T("fix-suma", "fix", [F("s.js", "function suma(a,b){return a-b;}\nmodule.exports={suma};\n")],
    "En s.js la función suma resta en vez de sumar. Arréglala sin tocar nada más.",
    (d) => readFileSync(join(d, "s.js"), "utf8").includes("a+b")),
  T("fix-nulo", "fix", [F("u.js", "function nombre(o){return o.nombre.toUpperCase();}\nmodule.exports={nombre};\n")],
    "En u.js la función nombre rompe si o es nulo. Protégela devolviendo cadena vacía.",
    (d) => { const m = require2(join(d, "u.js")); return m.nombre(null) === "" && m.nombre({ nombre: "a" }) === "A"; }),
  T("fix-typo", "fix", [F("c.json", '{"puetro": 3000}')],
    "En c.json la clave del puerto está mal escrita (puetro). Corrígela a puerto.",
    (d) => JSON.parse(readFileSync(join(d, "c.json"), "utf8")).puerto === 3000),
  T("fix-operador", "fix", [F("m.js", "function mayor(a,b){return a<b?a:b;}\nmodule.exports={mayor};\n")],
    "En m.js la función mayor devuelve el menor. Arréglala.",
    (d) => { const m = require2(join(d, "m.js")); return m.mayor(2, 5) === 5; }),
  T("fix-offbyone", "fix", [F("r.js", "function ultimo(xs){return xs[xs.length];}\nmodule.exports={ultimo};\n")],
    "En r.js ultimo devuelve undefined por off-by-one. Arréglala.",
    (d) => { const m = require2(join(d, "r.js")); return m.ultimo([1, 2, 3]) === 3; }),
  T("feat-unico", "feature", [F("s.js", "module.exports={};\n")],
    "En s.js añade y exporta unicos(xs) que quita duplicados manteniendo orden.",
    (d) => { const m = require2(join(d, "s.js")); return JSON.stringify(m.unicos([1, 2, 1, 3])) === "[1,2,3]"; }),
  T("feat-media", "feature", [F("s.js", "module.exports={};\n")],
    "En s.js añade y exporta media(xs) con la media aritmética (0 si vacío).",
    (d) => { const m = require2(join(d, "s.js")); return m.media([2, 4]) === 3 && m.media([]) === 0; }),
  T("ref-nombre", "refactor", [F("s.js", "function x(a){return a+1;}\nmodule.exports={x};\n")],
    "En s.js renombra x a siguiente en definición, exportación y usos (no queda rastro de la función x).",
    (d) => { const c = readFileSync(join(d, "s.js"), "utf8"); return c.includes("siguiente") && !/function x\(/.test(c); }),
  T("fix-par", "fix", [F("s.js", "function esPar(n){return n%2===1;}\nmodule.exports={esPar};\n")],
    "En s.js esPar devuelve true para impares. Arréglala.",
    (d) => { try { const m = require2(join(d, "s.js")); return m.esPar(4) === true && m.esPar(3) === false; } catch { const c = readFileSync(join(d, "s.js"), "utf8"); return c.includes("===0") || c.includes("% 2 === 0"); } }),
  T("fix-upper", "fix", [F("s.js", "function mayus(s){return s.toLowerCase();}\nmodule.exports={mayus};\n")],
    "En s.js mayus convierte a minúsculas en vez de mayúsculas. Arréglala.",
    (d) => { try { return require2(join(d, "s.js")).mayus("hola") === "HOLA"; } catch { return readFileSync(join(d, "s.js"), "utf8").includes("toUpperCase"); } }),
];
const TASKS = ALL.slice(0, N);

function runAgent(agent, dir, prompt) {
  const t0 = Date.now();
  let cmd, args;
  if (agent === "noira") {
    cmd = process.execPath; args = [join(root, "dist/cli/cli.js"), "-l", "low", prompt];
  } else if (agent === "opencode") {
    // Sin --model el modelo por defecto da "Unexpected server error";
    // con modelo explícito funciona (evidencia en el informe).
    cmd = "opencode"; args = ["run", "--model", process.env.OPENCODE_MODEL || "opencode/big-pickle", prompt];
  } else {
    cmd = "claude"; args = ["-p", prompt, "--permission-mode", "acceptEdits"];
  }
  const env = { ...process.env };
  if (agent === "noira") { env.NOIRA_NO_PARENT_WATCH = "1"; }
  const p = spawn(cmd, args, { cwd: dir, env, stdio: "ignore", shell: agent !== "noira" });
  return new Promise((resolve) => {
    const timer = setTimeout(() => { try { p.kill("SIGKILL"); } catch {} resolve({ ms: Date.now() - t0, timeout: true }); }, PER_TASK_MS);
    p.on("exit", (code) => { clearTimeout(timer); resolve({ ms: Date.now() - t0, timeout: false, code }); });
    p.on("error", (e) => { clearTimeout(timer); resolve({ ms: Date.now() - t0, timeout: false, error: String(e) }); });
  });
}

const AGENTS = (process.env.COMPARE_AGENTS || "noira,opencode,claude").split(",").map((s) => s.trim()).filter(Boolean);
const rows = [];
for (const task of TASKS) {
  for (const agent of AGENTS) {
    const dir = mkdtempSync(join(tmpdir(), `cmp-${agent}-${task.id}-`));
    for (const f of task.files) writeFileSync(join(dir, f.name), f.content, "utf8");
    console.log(`[${agent}] ${task.id} ...`);
    const r = await runAgent(agent, dir, task.prompt);
    let ok = false;
    try { ok = task.check(dir); } catch (e) { ok = false; }
    rows.push({ agent, id: task.id, kind: task.kind, ok, ms: Math.round(r.ms / 1000), timeout: !!r.timeout, err: r.error || "" });
    console.log(`  -> ${ok ? "OK" : "FAIL"} en ${Math.round(r.ms / 1000)}s${r.timeout ? " (timeout)" : ""}${r.error ? " err=" + r.error : ""}`);
  }
}

console.log("\n=== TABLA LITERAL ===");
console.log("| agente | tarea | tipo | resultado | segundos |");
console.log("|---|---|---|---|---|");
for (const r of rows) console.log(`| ${r.agent} | ${r.id} | ${r.kind} | ${r.ok ? "OK" : "FAIL"}${r.timeout ? " (timeout)" : ""} | ${r.ms} |`);
for (const agent of AGENTS) {
  const rs = rows.filter((r) => r.agent === agent);
  const oks = rs.filter((r) => r.ok).length;
  const avg = Math.round(rs.reduce((a, r) => a + r.ms, 0) / rs.length);
  console.log(`| ${agent} TOTAL | ${oks}/${rs.length} (${Math.round((oks / rs.length) * 100)}%) | — | tiempo medio ${avg}s | |`);
}
writeFileSync(join(root, "docs", "evidence", `comparativa-l-${Date.now()}.json`), JSON.stringify({ rows }, null, 2), "utf8");
const fails = rows.filter((r) => !r.ok).length;
process.exit(0);
