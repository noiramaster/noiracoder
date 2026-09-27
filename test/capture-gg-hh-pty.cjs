/**
 * GG + HH — capturas pty REALES con ANSI intacto.
 * GG1 /logout: confirma con y/N y borra claves (sembrada una falsa antes).
 * GG2 /deploy static: confirmación del SERVIDOR por SSE + genera dist/.
 * HH  bienvenida: primer arranque muestra bloque + opciones; "2" la cierra;
 *     "1" dispara login_wait (el OAuth real necesita navegador humano).
 * Ejecutar: node test/capture-gg-hh-pty.cjs
 */
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn, spawnSync } = require("child_process");

const TMP = process.env.TEMP || process.env.TEMPDIR;
const pty = require(path.join(TMP, "opencode/termrender/node_modules/node-pty"));
const { Terminal } = require(path.join(TMP, "opencode/termrender/node_modules/@xterm/headless"));
const { SerializeAddon } = require(path.join(TMP, "opencode/termrender/node_modules/@xterm/addon-serialize"));

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "docs", "evidence", "screens", "gg-hh");
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

async function startMotor(home, port, cwd) {
  const motor = spawn(process.execPath, [path.join(ROOT, "bin/noiracoder.mjs"), "serve", "--thin", "--port", String(port)], {
    cwd: cwd || ROOT,
    env: { ...process.env, NOIRARC_HOME: home, NOIRA_NO_PARENT_WATCH: "1", NOIRA_SERVE_TOKEN: "probe-gghh" },
    stdio: "ignore",
  });
  for (let i = 0; i < 120; i++) {
    await sleep(500);
    if (motor.exitCode !== null) return null;
    try { const r = await fetch(`http://127.0.0.1:${port}/health`); if (r.ok) return motor; } catch {}
  }
  try { motor.kill(); } catch {}
  return null;
}

function spawnScreen(home, port, cwd) {
  const p = pty.spawn(path.join(ROOT, "bin/noira-thin.exe"), [], {
    cols: COLS, rows: ROWS, cwd: cwd || home,
    env: { ...process.env, NOIRARC_HOME: home, NOIRA_PORT: String(port), NOIRA_TOKEN: "probe-gghh" },
  });
  const t = new Terminal({ cols: COLS, rows: ROWS, allowProposedApi: true });
  const sa = new SerializeAddon();
  t.loadAddon(sa);
  let raw = "";
  p.onData((d) => { raw += d; t.write(d); });
  return { p, sa, raw: () => raw, close: () => { try { p.kill(); } catch {} try { t.dispose(); } catch {} } };
}

const results = [];
const ok = (n, c, extra = "") => {
  results.push([c ? "PASS" : "FAIL", n]);
  console.log(`  ${c ? "PASS" : "FAIL"} ${n}${extra ? "  <-- " + extra : ""}`);
};

(async () => {
  // ── GG1: /logout con clave sembrada ──
  console.log("\n=== GG1 /logout ===");
  {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "gg-logout-"));
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "gg-ws-"));
    // Siembra una clave FALSA con la CLI (cifrada como en real).
    spawnSync(process.execPath, [path.join(ROOT, "bin/noiracoder.mjs"), "login", "--groq", "gsk_falsa_para_prueba_1234567890"],
      { cwd: ROOT, env: { ...process.env, NOIRARC_HOME: home }, stdio: "ignore" });
    const motor = await startMotor(home, 4141);
    ok("motor", !!motor);
    const { p, sa, raw, close } = spawnScreen(home, 4141);
    await waitScreen(sa, /NOIRACODER/, 30000);
    await sleep(2500);
    // La bienvenida intercepta teclas: se descarta primero ("2" = seguir).
    p.write("2");
    await sleep(1500);
    p.write("/logout\r");
    await sleep(2000);
    const c1 = sa.serialize({ excludeModes: false });
    snap("gg1-logout-confirm.txt", c1);
    ok("logout-pide-confirmacion", /Permites|Borrar las claves|\[y\] sí/i.test(strip(c1)));
    p.write("y");
    await sleep(3000);
    const c2 = sa.serialize({ excludeModes: false });
    snap("gg1-logout-done.txt", c2);
    ok("logout-borra", /claves eliminadas|nada que borrar/i.test(strip(c2)), strip(c2).split(/\r?\n/).filter((l) => /clave/i.test(l)).slice(-2).join(" | "));
    snap("gg1-stream.ansi", raw());
    p.write("/quit\r");
    await sleep(1500);
    close();
    try { motor.kill(); } catch {}
  }

  // ── GG2: /deploy static con confirmación del servidor ──
  console.log("\n=== GG2 /deploy static ===");
  {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "gg-deploy-"));
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "gg-wsdeploy-"));
    // Marca bienvenida vista para ir directo al comando.
    fs.mkdirSync(path.join(home, ".noirarc"), { recursive: true });
    fs.writeFileSync(path.join(home, ".noirarc", "prefs.json"), '{"welcomed":true}', "utf8");
    // El motor corre con cwd=ws: /deploy static escribe ahí, nunca en el repo.
    const motor = await startMotor(home, 4142, ws);
    ok("motor", !!motor);
    const { p, sa, raw, close } = spawnScreen(home, 4142, ws);
    await waitScreen(sa, /NOIRACODER/, 30000);
    await sleep(2500);
    p.write("/deploy static\r");
    await sleep(3000);
    const c1 = sa.serialize({ excludeModes: false });
    snap("gg2-deploy-confirm.txt", c1);
    ok("deploy-confirm-servidor", /CONFIRMACIÓN|Publicar|confirm/i.test(strip(c1)));
    p.write("y");
    const c2 = await waitScreen(sa, /build estatico generado|Deploy publicado|Deploy fallido|no confirmado/i, 60000);
    snap("gg2-deploy-done.txt", sa.serialize({ excludeModes: false }));
    const doneOk = /build estatico generado|Deploy publicado/i.test(strip(c2));
    ok("deploy-static-ok", doneOk, strip(c2).split(/\r?\n/).filter((l) => /Deploy|static|dist/i.test(l)).slice(-3).join(" | "));
    ok("deploy-genera-dist", fs.existsSync(path.join(ws, "dist", "index.html")));
    snap("gg2-stream.ansi", raw());
    p.write("/quit\r");
    await sleep(1500);
    close();
    try { motor.kill(); } catch {}
  }

  // ── HH: bienvenida de primer arranque ──
  console.log("\n=== HH bienvenida ===");
  {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "hh-welcome-"));
    const motor = await startMotor(home, 4143);
    ok("motor", !!motor);
    const { p, sa, raw, close } = spawnScreen(home, 4143);
    const w = await waitScreen(sa, /Conectar OpenRouter|Seguir sin claves/, 30000);
    snap("hh-welcome.txt", sa.serialize({ excludeModes: false }));
    snap("hh-welcome-raw.ansi", raw());
    const plain = strip(w);
    ok("welcome-bloque", /24\/7/.test(plain) && /Kilo ya está activo/.test(plain) && /\/connect/.test(plain));
    ok("welcome-opciones", /Conectar OpenRouter.*gratis/.test(plain) && /Seguir sin claves/.test(plain));
    // Flechas mueven el cursor del welcome.
    const cur0 = (plain.match(/[▸>]\s+\d+\./g) || []).join("|");
    p.write("\x1b[B");
    await sleep(1500);
    const w2 = sa.serialize({ excludeModes: false });
    snap("hh-welcome-down.txt", w2);
    const cur1 = (strip(w2).match(/[▸>]\s+\d+\./g) || []).join("|");
    ok("welcome-flechas", cur0 !== "" && cur1 !== "" && cur0 !== cur1, cur0 + " -> " + cur1);
    // "2" (seguir) cierra y marca vista.
    p.write("2");
    await sleep(2000);
    const w3 = sa.serialize({ excludeModes: false });
    snap("hh-welcome-skip.txt", w3);
    ok("welcome-skip-cierra", !/Conectar OpenRouter/.test(strip(w3)));
    let seen = false;
    try { seen = JSON.parse(fs.readFileSync(path.join(home, ".noirarc", "prefs.json"), "utf8")).welcomed === true; } catch {}
    ok("welcome-marca-vista", seen);
    // "1" en una segunda tanda: dispara login_wait (OAuth real = navegador humano).
    p.write("/quit\r");
    await sleep(1500);
    close();
    try { motor.kill(); } catch {}
  }

  // ── HH2: opción conectar dispara login ──
  console.log("\n=== HH2 conectar dispara login ===");
  {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "hh-login-"));
    const motor = await startMotor(home, 4144);
    ok("motor", !!motor);
    const { p, sa, raw, close } = spawnScreen(home, 4144);
    await waitScreen(sa, /Conectar OpenRouter/, 30000);
    await sleep(1500);
    p.write("1");
    const w = await waitScreen(sa, /Abriendo el navegador|OpenRouter conectado|No se pudo|fallo/i, 30000);
    snap("hh-login-trigger.txt", sa.serialize({ excludeModes: false }));
    ok("login-disparado", /Abriendo el navegador/.test(strip(w)), "aparece espera de OAuth");
    snap("hh-login-stream.ansi", raw());
    try { p.kill(); } catch {}
    close();
    try { motor.kill(); } catch {}
  }

  const pass = results.filter((r) => r[0] === "PASS").length;
  console.log(`\n=== TOTAL GG/HH: ${pass}/${results.length} PASS ===`);
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error("HARNESS-ERROR", e); process.exit(3); });
