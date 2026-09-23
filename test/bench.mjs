/* H1.6 — banco de calidad: 20 tareas de programación realistas en proyectos
 * de ejemplo pequeños, con criterio de éxito AUTOMÁTICO (ficheros y códigos
 * de salida, nunca juicio del modelo). Corre por el motor real (thin server).
 * Uso: npm run bench  (NOIRA_BENCH_MODEL para fijar modelo; por defecto router)
 * Salida: docs/evidence/bench.md (el propio script la escribe al final).
 */
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const benchRequire = createRequire(import.meta.url);

const MODEL = process.env.NOIRA_BENCH_MODEL || "";
const PER_TASK_MS = 150000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const T = (id, kind, files, prompt, check) => ({ id, kind, files, prompt, check });
const F = (name, content) => ({ name, content });

const TASKS = [
  T("fix-suma", "fix", [F("s.js", "function suma(a,b){return a-b;}\nmodule.exports={suma};\n")],
    "En s.js la función suma resta en vez de sumar. Arréglala sin tocar nada más.",
    (d) => readFileSync(join(d, "s.js"), "utf8").includes("a+b")),
  T("fix-nulo", "fix", [F("u.js", "function nombre(o){return o.nombre.toUpperCase();}\nmodule.exports={nombre};\n")],
    "En u.js la función nombre rompe si o es nulo. Protégela devolviendo cadena vacía.",
    (d) => { const m = benchRequire(join(d, "u.js")); return m.nombre(null) === "" && m.nombre({ nombre: "a" }) === "A"; }),
  T("fix-typo", "fix", [F("c.json", '{"puetro": 3000}')],
    "En c.json la clave del puerto está mal escrita (puetro). Corrígela a puerto.",
    (d) => JSON.parse(readFileSync(join(d, "c.json"), "utf8")).puerto === 3000),
  T("fix-operador", "fix", [F("m.js", "function mayor(a,b){return a<b?a:b;}\nmodule.exports={mayor};\n")],
    "En m.js la función mayor devuelve el menor. Arréglala.",
    (d) => { const m = benchRequire(join(d, "m.js")); return m.mayor(2, 5) === 5; }),
  T("fix-offbyone", "fix", [F("r.js", "function ultimo(xs){return xs[xs.length];}\nmodule.exports={ultimo};\n")],
    "En r.js ultimo devuelve undefined por off-by-one. Arréglala.",
    (d) => { const m = benchRequire(join(d, "r.js")); return m.ultimo([1, 2, 3]) === 3; }),
  T("feat-invierte", "feature", [F("s.js", "module.exports={};\n")],
    "En s.js añade y exporta invierte(s) que invierte una cadena.",
    (d) => { const m = benchRequire(join(d, "s.js")); return m.invierte("hola") === "aloh"; }),
  T("feat-clamp", "feature", [F("s.js", "module.exports={};\n")],
    "En s.js añade y exporta tope(n,min,max) que limita n al rango.",
    (d) => { const m = benchRequire(join(d, "s.js")); return m.tope(9, 0, 5) === 5 && m.tope(-1, 0, 5) === 0; }),
  T("feat-csv", "feature", [F("s.js", "module.exports={};\n")],
    "En s.js añade y exporta lineaCsv(s) que parte por comas recortando espacios.",
    (d) => { const m = benchRequire(join(d, "s.js")); return JSON.stringify(m.lineaCsv("a, b ,c")) === '["a","b","c"]'; }),
  T("feat-unico", "feature", [F("s.js", "module.exports={};\n")],
    "En s.js añade y exporta unicos(xs) que quita duplicados manteniendo orden.",
    (d) => { const m = benchRequire(join(d, "s.js")); return JSON.stringify(m.unicos([1, 2, 1, 3])) === "[1,2,3]"; }),
  T("feat-media", "feature", [F("s.js", "module.exports={};\n")],
    "En s.js añade y exporta media(xs) con la media aritmética (0 si vacío).",
    (d) => { const m = benchRequire(join(d, "s.js")); return m.media([2, 4]) === 3 && m.media([]) === 0; }),
  T("ref-extract", "refactor", [F("s.js", "function total(xs){let t=0;for(const x of xs){t+=x*2;}return t;}\nmodule.exports={total};\n")],
    "En s.js extrae el doble a una función doble(x) exportada, sin cambiar total.",
    (d) => { const m = benchRequire(join(d, "s.js")); return m.doble(4) === 8 && m.total([1, 2]) === 6; }),
  T("ref-nombre", "refactor", [F("s.js", "function x(a){return a+1;}\nmodule.exports={x};\n")],
    "En s.js renombra x a siguiente en definición, exportación y usos (no queda rastro de la función x).",
    (d) => { const c = readFileSync(join(d, "s.js"), "utf8"); return c.includes("siguiente") && !/function x\(/.test(c); }),
  T("ref-dup", "refactor", [F("s.js", "function a(){return 1+2;}\nfunction b(){return 1+2;}\nmodule.exports={a,b};\n")],
    "En s.js elimina la duplicación entre a y b compartiendo el cálculo, sin cambiar resultados.",
    (d) => { const m = benchRequire(join(d, "s.js")); return m.a() === 3 && m.b() === 3; }),
  T("ref-split", "refactor", [F("todo.js", "function uno(){return 1;}\nfunction dos(){return 2;}\nmodule.exports={uno,dos};\n")],
    "Divide todo.js en uno.js y dos.js (cada función en su fichero con su exportación) y deja todo.js reexportando.",
    (d) => existsSync(join(d, "uno.js")) && existsSync(join(d, "dos.js")) &&(join(d, "todo.js")).uno() === 1),
  T("test-suma", "tests", [F("s.js", "function suma(a,b){return a+b;}\nmodule.exports={suma};\n")],
    "Crea test-suma.js que comprueba suma(2,3)===5 con assert de node y sale 0.",
    (d) => existsSync(join(d, "test-suma.js"))),
  T("test-nulo", "tests", [F("u.js", "function nombre(o){return o?o.nombre.toUpperCase():'';}\nmodule.exports={nombre};\n")],
    "Crea test-nulo.js que comprueba nombre(null)==='' y nombre({nombre:'a'})==='A'.",
    (d) => existsSync(join(d, "test-nulo.js"))),
  T("test-csv", "tests", [F("s.js", "function lineaCsv(s){return s.split(',').map((x)=>x.trim());}\nmodule.exports={lineaCsv};\n")],
    "Crea test-csv.js que comprueba lineaCsv('a, b') con assert.",
    (d) => existsSync(join(d, "test-csv.js"))),
  T("doc-readme", "docs", [],
    "Crea README.md con secciones Instalación y Uso (encabezados markdown).",
    (d) => { const c = existsSync(join(d, "README.md")) ? readFileSync(join(d, "README.md"), "utf8") : ""; return /#+\s*instalaci.n/i.test(c) && /#+\s*uso/i.test(c); }),
  T("doc-agents", "docs", [],
    "Crea NOTAS.md con dos secciones: Decisiones y Pendientes.",
    (d) => { const c = existsSync(join(d, "NOTAS.md")) ? readFileSync(join(d, "NOTAS.md"), "utf8") : ""; return /decisiones/i.test(c) && /pendientes/i.test(c); }),
  T("doc-pkg", "docs", [],
    'Crea package.json válido con name "banco" y script test que ejecute node test.js.',
    (d) => { try { const j = JSON.parse(readFileSync(join(d, "package.json"), "utf8")); return j.name === "banco" && /node test\.js/.test(j.scripts?.test || ""); } catch { return false; } }),
];

async function run() {
  const t0 = Date.now();
  const PORT = 3797;
  const TOKEN = "tok-bench-" + Date.now();
  const HOME = mkdtempSync(join(tmpdir(), "noira-bench-"));
  const srv = spawn(process.execPath, ["dist/cli/cli.js", "serve", "--thin", "--port", String(PORT), "--level", "low"],
    { env: { ...process.env, NOIRA_SERVE_TOKEN: TOKEN, NOIRARC_HOME: HOME, NOIRA_NO_PARENT_WATCH: "1" }, stdio: "ignore" });
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (r.ok) break;
    } catch {}
    await sleep(250);
  }
  const H = { Authorization: `Bearer ${TOKEN}`, "X-Noira-Protocol": "2", "Content-Type": "application/json" };
  if (MODEL) await fetch(`http://127.0.0.1:${PORT}/v1/model`, { method: "POST", headers: H, body: JSON.stringify({ id: MODEL }) });
  const results = [];
  for (const task of TASKS) {
    const dir = mkdtempSync(join(tmpdir(), "bench-" + task.id + "-"));
    for (const f of task.files) {
      const p = join(dir, f.name);
      mkdirSync(join(p, ".."), { recursive: true });
      writeFileSync(p, f.content, "utf8");
    }
    const sse = await fetch(`http://127.0.0.1:${PORT}/v1/events?protocol=2`, { headers: H });
    if (sse.status !== 200) {
      results.push({ id: task.id, kind: task.kind, ok: false, ms: 0, error: "sse " + sse.status, out: "" });
      continue;
    }
    const reader = sse.body.getReader();
    const dec = new TextDecoder();
    let buf = "", done = false, text = "";
    const tStart = Date.now();
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
          if (ev === "turn.text") text += data.delta || "";
          else if (ev === "turn.end" || ev === "turn.error") { done = true; try { await reader.cancel(); } catch {} return; }
        }
      }
    })();
    // El turno trabaja DENTRO del proyecto (cwd del motor = dir).
    const tr = await (await fetch(`http://127.0.0.1:${PORT}/v1/turn`, {
      method: "POST", headers: H,
      body: JSON.stringify({ message: `Trabaja SOLO dentro del directorio ${dir}. ${task.prompt}`, mode: "build" }),
    })).json();
    await Promise.race([pump, sleep(PER_TASK_MS)]);
    try { await reader.cancel(); } catch {}
    let ok = false, checkErr = "";
    try {
      ok = task.check(dir);
    } catch (e) {
      checkErr = e instanceof Error ? e.message.slice(0, 120) : String(e);
    }
    // Cancela si sigue en curso para no contaminar la siguiente.
    try {
      await fetch(`http://127.0.0.1:${PORT}/v1/cancel`, { method: "POST", headers: H, body: JSON.stringify({ turnId: tr.turnId }) });
    } catch {}
    results.push({ id: task.id, kind: task.kind, ok, ms: Date.now() - tStart, error: checkErr, out: text.slice(-200) });
    console.log(`${ok ? "[PASS]" : "[FAIL]"} ${task.id} (${task.kind}) ${Date.now() - tStart}ms ${checkErr}`);
  }
  srv.kill();
  const okN = results.filter((r) => r.ok).length;
  const byKind = {};
  for (const r of results) {
    byKind[r.kind] ??= { n: 0, ok: 0 };
    byKind[r.kind].n++;
    if (r.ok) byKind[r.kind].ok++;
  }
  const md = `# Banco de calidad — ronda ${new Date().toISOString()} (modelo: ${MODEL || "router"})\n\n` +
    `Resultado: **${okN}/${results.length}** en ${Math.round((Date.now() - t0) / 1000)}s.\n\n` +
    Object.entries(byKind).map(([k, v]) => `- ${k}: ${v.ok}/${v.n}`).join("\n") + "\n\n" +
    results.map((r) => `- [${r.ok ? "x" : " "}] ${r.id} (${r.kind}) ${r.ms}ms${r.error ? " — " + r.error : ""}`).join("\n") + "\n";
  writeFileSync(join("docs", "evidence", "bench.md"), md, "utf8");
  console.log(`\nBENCH: ${okN}/${results.length}`);
  process.exit(okN === results.length ? 0 : 1);
}

run().catch((e) => { console.error("HARNESS-ERROR", e); process.exit(3); });
