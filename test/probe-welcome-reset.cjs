/**
 * Reset bienvenida HH: con welcomed=false y sin sesiones, la TUI debe
 * mostrar el bloque + opciones de bienvenida al arrancar.
 * Ejecutar: node test/probe-welcome-reset.cjs
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
const OUT = path.join(ROOT, "docs", "evidence", "screens", "welcome-reset");
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

(async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "welreset-"));
  fs.mkdirSync(path.join(home, ".noirarc"), { recursive: true });
  // Estado "reseteado": welcomed=false + cero sesiones (sin tocar nada real).
  fs.writeFileSync(path.join(home, ".noirarc", "prefs.json"), '{"language":"es","welcomed":false}', "utf8");
  const port = 4165;
  const motor = spawn(process.execPath, [path.join(ROOT, "bin/noiracoder.mjs"), "serve", "--thin", "--port", String(port)], {
    cwd: ROOT,
    env: { ...process.env, NOIRARC_HOME: home, NOIRA_NO_PARENT_WATCH: "1", NOIRA_SERVE_TOKEN: "probe-wel" },
    stdio: "ignore",
  });
  for (let i = 0; i < 120; i++) {
    await sleep(500);
    if (motor.exitCode !== null) break;
    try { const r = await fetch(`http://127.0.0.1:${port}/health`); if (r.ok) break; } catch {}
  }
  const p = pty.spawn(path.join(ROOT, "bin/noira-thin.exe"), [], {
    cols: COLS, rows: ROWS, cwd: home,
    env: { ...process.env, NOIRARC_HOME: home, NOIRA_PORT: String(port), NOIRA_TOKEN: "probe-wel" },
  });
  const t = new Terminal({ cols: COLS, rows: ROWS, allowProposedApi: true });
  const sa = new SerializeAddon();
  t.loadAddon(sa);
  let raw = "";
  p.onData((d) => { raw += d; t.write(d); });

  const s = await waitScreen(sa, /senior 24\/7|Kilo/i, 30000);
  await sleep(1500);
  const s2 = sa.serialize({ excludeModes: false });
  snap("welcome-reset-boot.txt", s2);
  const clean = strip(s2);
  const hasTitle = /senior 24\/7/i.test(clean);
  const hasKilo = /Kilo/i.test(clean);
  const hasOpts = /onectar|mitir|skip|connect/i.test(clean);
  console.log(`WELCOME-TITLE: ${hasTitle ? "PASS" : "FAIL"}`);
  console.log(`WELCOME-KILO: ${hasKilo ? "PASS" : "FAIL"}`);
  console.log(`WELCOME-OPCIONES: ${hasOpts ? "PASS" : "FAIL"}`);
  // Al elegir, welcomed debe quedar en true (merge).
  p.write("2");
  await sleep(1500);
  const prefs = JSON.parse(fs.readFileSync(path.join(home, ".noirarc", "prefs.json"), "utf8"));
  console.log(`WELCOMED-TRAS-ELEGIR: ${prefs.welcomed === true ? "PASS" : "FAIL"} (${JSON.stringify(prefs)})`);
  snap("welcome-reset-stream.ansi", raw);

  try { p.kill(); } catch {}
  try { t.dispose(); } catch {}
  try { motor.kill(); } catch {}
  await sleep(500);
  const ok = hasTitle && hasKilo && hasOpts && prefs.welcomed === true;
  console.log(ok ? "=== WELCOME-RESET: PASS ===" : "=== WELCOME-RESET: FAIL ===");
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error("HARNESS-ERROR", e); process.exit(3); });
