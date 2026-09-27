/**
 * HALLAZGO menú "/": al abrirse, ¿se ve desde la opción 1?
 * Reproduce apertura fresca y vuelca las filas numeradas visibles.
 * Ejecutar: node test/probe-slash-open.cjs
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
const ROWS = parseInt(process.env.SLASH_ROWS || "34", 10);
const OUT = path.join(ROOT, "docs", "evidence", "screens", "slash-open-" + ROWS);
const COLS = 100;
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

(async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "slashopen-"));
  fs.mkdirSync(path.join(home, ".noirarc"), { recursive: true });
  fs.writeFileSync(path.join(home, ".noirarc", "prefs.json"), '{"welcomed":true,"language":"es"}', "utf8");
  const port = 4161;
  const motor = spawn(process.execPath, [path.join(ROOT, "bin/noiracoder.mjs"), "serve", "--thin", "--port", String(port)], {
    cwd: ROOT,
    env: { ...process.env, NOIRARC_HOME: home, NOIRA_NO_PARENT_WATCH: "1", NOIRA_SERVE_TOKEN: "probe-slash" },
    stdio: "ignore",
  });
  for (let i = 0; i < 120; i++) {
    await sleep(500);
    if (motor.exitCode !== null) break;
    try { const r = await fetch(`http://127.0.0.1:${port}/health`); if (r.ok) break; } catch {}
  }
  const p = pty.spawn(path.join(ROOT, "bin/noira-thin.exe"), [], {
    cols: COLS, rows: ROWS, cwd: home,
    env: { ...process.env, NOIRARC_HOME: home, NOIRA_PORT: String(port), NOIRA_TOKEN: "probe-slash" },
  });
  const t = new Terminal({ cols: COLS, rows: ROWS, allowProposedApi: true });
  const sa = new SerializeAddon();
  t.loadAddon(sa);
  let raw = "";
  p.onData((d) => { raw += d; t.write(d); });

  await waitScreen(sa, /NOIRACODER/, 30000);
  await sleep(2500);

  // Apertura FRESCA del menú: una sola pulsación "/".
  p.write("/");
  await sleep(2000);
  const s1 = sa.serialize({ excludeModes: false });
  snap("slash-fresh-open.txt", s1);
  const rows = strip(s1).split(/\r?\n/).filter((l) => /\d+\.\s+\/\S+/.test(l));
  console.log("FILAS-VISIBLES:");
  for (const r of rows) console.log("  " + JSON.stringify(r.trim().slice(0, 80)));
  // La primera fila NUMERADA debe ser la 1 (ignora prefijo del panel lateral).
  const firstNum = (rows[0] || "").match(/(\d+)\.\s+\/(\S+)/);
  const okFirst = !!firstNum && firstNum[1] === "1" && firstNum[2].startsWith("help");
  console.log(`\nPRIMERA-FILA: ${JSON.stringify((rows[0] || "").trim().slice(0, 40))} -> ${okFirst ? "PASS (empieza en 1. /help)" : "FAIL (NO empieza en 1)"}`);
  console.log(`TOTAL-FILAS-NUMERADAS: ${rows.length}`);
  snap("slash-fresh-stream.ansi", raw);

  p.write("\x1b");
  await sleep(800);
  try { p.kill(); } catch {}
  try { t.dispose(); } catch {}
  try { motor.kill(); } catch {}
  await sleep(500);
  process.exit(okFirst ? 0 : 1);
})().catch((e) => { console.error("HARNESS-ERROR", e); process.exit(3); });
