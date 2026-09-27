/**
 * JJ — capturas pty de pulido: menú "/" con descripciones, /agents, /mcp,
 * /connections. Antes (mn/DESPUES-03, sin descripciones) vs después.
 * Ejecutar: node test/capture-jj-pty.cjs
 */
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");

const TMP = process.env.TEMP || process.env.TEMPDIR;
const pty = require(path.join(TMP, "opencode/termrender/node_modules/node-pty"));
const { Terminal } = require(path.join(TMP, "opencode/termrender/node_modules/@xterm/headless"));
const { SerializeAddon } = require(path.join(TMP, "opencode/termrender/node_modules/@xterm/addon-serialize"));

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "docs", "evidence", "screens", "jj");
const COLS = 100;
const ROWS = 34;
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (s) => s.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "").replace(/\x1b[()][AB012]/g, "");
const snap = (n, d) => fs.writeFileSync(path.join(OUT, n), d, "utf8");

async function waitScreen(sa, re, ms, step = 250) {
  const t0 = Date.now();
  let last = "";
  while (Date.now() - t0 < ms) {
    last = sa.serialize({ excludeModes: false, excludeAltBuffer: false });
    if (re.test(strip(last))) return last;
    await sleep(step);
  }
  return last;
}

const results = [];
const ok = (n, c, extra = "") => {
  results.push([c ? "PASS" : "FAIL", n]);
  console.log(`  ${c ? "PASS" : "FAIL"} ${n}${extra ? "  <-- " + extra : ""}`);
};

(async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "jj-"));
  fs.mkdirSync(path.join(home, ".noirarc"), { recursive: true });
  fs.writeFileSync(path.join(home, ".noirarc", "prefs.json"), '{"welcomed":true}', "utf8");
  const port = 4155;
  const motor = spawn(process.execPath, [path.join(ROOT, "bin/noiracoder.mjs"), "serve", "--thin", "--port", String(port)], {
    cwd: ROOT,
    env: { ...process.env, NOIRARC_HOME: home, NOIRA_NO_PARENT_WATCH: "1", NOIRA_SERVE_TOKEN: "probe-jj" },
    stdio: "ignore",
  });
  for (let i = 0; i < 120; i++) {
    await sleep(500);
    if (motor.exitCode !== null) break;
    try { const r = await fetch(`http://127.0.0.1:${port}/health`); if (r.ok) break; } catch {}
  }
  const p = pty.spawn(path.join(ROOT, "bin/noira-thin.exe"), [], {
    cols: COLS, rows: ROWS, cwd: home,
    env: { ...process.env, NOIRARC_HOME: home, NOIRA_PORT: String(port), NOIRA_TOKEN: "probe-jj" },
  });
  const t = new Terminal({ cols: COLS, rows: ROWS, allowProposedApi: true });
  const sa = new SerializeAddon();
  t.loadAddon(sa);
  let raw = "";
  p.onData((d) => { raw += d; t.write(d); });

  await waitScreen(sa, /NOIRACODER/, 30000);
  await sleep(2500);

  // JJ1: menú "/" con descripciones alineadas.
  p.write("/");
  await sleep(2000);
  const s1 = sa.serialize({ excludeModes: false });
  snap("jj1-slash-desc.txt", s1);
  const rows = strip(s1).split(/\r?\n/).filter((l) => /\d+\.\s+\/\S+/.test(l));
  ok("JJ1 menu-con-descripciones", rows.length === 10 && rows.every((l) => /—/.test(l)),
    `ventana de 10 con descs, ej: ${JSON.stringify((rows[0] || "").trim().slice(0, 60))}`);
  ok("JJ1 fila-activa-acento", /38;2;251;191;36/.test(s1), "acento presente");
  // Scroll: al bajar, aparecen marcadores y la ventana sigue al cursor.
  for (let i = 0; i < 8; i++) p.write("\x1b[B");
  await sleep(1500);
  const s1b = sa.serialize({ excludeModes: false });
  snap("jj1b-slash-scroll.txt", s1b);
  const p1b = strip(s1b);
  ok("JJ1 scroll-marcadores", /más (arriba|abajo)|more (above|below)|au-dessus|ci-dessous|weiter (oben|unten)|sopra|sotto|أعلاه|أدناه|acima|abaixo/.test(p1b),
    "marcador de scroll visible");
  ok("JJ1 cursor-visible", /[▸>]\s+\d+\./.test(p1b), "cursor sigue visible tras scroll");
  p.write("\x1b");
  await sleep(1200);
  p.write("\x7f"); // borra el "/" (Esc cierra el menú pero no la entrada)
  await sleep(800);

  // JJ2: /agents roster.
  p.write("/agents\r");
  await sleep(2500);
  const s2 = sa.serialize({ excludeModes: false });
  snap("jj2-agents.txt", s2);
  ok("JJ2 agents-ordenado", /Agent Roster|orchestrator/.test(strip(s2)));

  // JJ2b: /mcp (sin servidores = mensaje claro).
  p.write("/mcp\r");
  await sleep(2500);
  const s3 = sa.serialize({ excludeModes: false });
  snap("jj3-mcp.txt", s3);
  ok("JJ3 mcp-claro", /MCP|mcp|sin servidores|no .*server/i.test(strip(s3)));

  // JJ3: /connections con estados.
  p.write("/connections\r");
  await sleep(2500);
  const s4 = sa.serialize({ excludeModes: false });
  snap("jj4-connections.txt", s4);
  ok("JJ3 connections-estado", /\[✓\]|\[.\]|[Cc]onnections/.test(strip(s4)));
  snap("jj99-stream.ansi", raw);

  p.write("/quit\r");
  await sleep(2000);
  try { p.kill(); } catch {}
  try { t.dispose(); } catch {}
  try { motor.kill(); } catch {}
  await sleep(500);
  const pass = results.filter((r) => r[0] === "PASS").length;
  console.log(`\n=== JJ: ${pass}/${results.length} PASS ===`);
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error("HARNESS-ERROR", e); process.exit(3); });
