/**
 * TAREA M + N — capturas pty REALES con ANSI intacto, antes y después.
 *
 * Compara el binario de pantallaviejo (NOIRA_THIN_BIN = BEFORE) con el nuevo
 * (AFTER) sobre la MISMA sesión y demuestra tres cosas:
 *
 *   M1  /connect: el texto promete "flechas+Enter" pero el historial se las
 *       comía. Se comprueba que la fila activa cambia al pulsar ↓.
 *   M2  "/" abre el listado de comandos navegable con el mismo componente
 *       (flechas / número / clic), y escribir filtra.
 *   N   el acento #FBBF24 (--accent de la landing) se ve en selección, foco y
 *       cabeceras; los paneles respiran más.
 *
 * Ejecutar: node test/capture-mn-pty.cjs
 */
const path = require("path");
const fs = require("fs");

const TMP = process.env.TEMP || process.env.TEMPDIR;
const pty = require(path.join(TMP, "opencode/termrender/node_modules/node-pty"));
const { Terminal } = require(path.join(TMP, "opencode/termrender/node_modules/@xterm/headless"));
const { SerializeAddon } = require(path.join(TMP, "opencode/termrender/node_modules/@xterm/addon-serialize"));

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "docs", "evidence", "screens", "mn");
const WRAP = path.join(ROOT, "bin/noiracoder.mjs");
const COLS = 100;
const ROWS = 34;

const BEFORE = path.join(TMP, "opencode/mn/noira-thin-BEFORE.exe");
const AFTER = path.join(ROOT, "bin/noira-thin.exe");

fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (s) => s.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "").replace(/\x1b[()][AB012]/g, "");

function mkTerm() {
  const t = new Terminal({ cols: COLS, rows: ROWS, allowProposedApi: true });
  const sa = new SerializeAddon();
  t.loadAddon(sa);
  return { t, sa };
}

/** Espera a que la PANTALLA renderizada (no el flujo ANSI) contenga re. */
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

function snap(label, data) {
  fs.writeFileSync(path.join(OUT, label), data, "utf8");
}

/**
 * Extrae la lista "cursor + número + etiqueta" de la pantalla renderizada.
 * ANTES: "> 1. OpenRouter"   DESPUÉS: "▸ 1. /help" (con SGR de acento).
 */
function selectedLine(screen) {
  const out = [];
  for (const raw of strip(screen).split(/\r?\n/)) {
    const m = raw.match(/[▸>]\s+(\d+)\.\s+(\S+)/);
    if (m) out.push(m[1] + "." + m[2]);
  }
  return out;
}

/** ¿La fila activa lleva acento #FBBF24 en ▸ e inversa en el texto? */
function activeRowHasAccent(screen) {
  for (const raw of screen.split(/\r?\n/)) {
    const plain = raw.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "");
    if (!/[▸>]\s+\d+\.\s+\S/.test(plain)) continue;
    // El "7" de inversa puede venir combinado ("39;7;1m"): basta [;[]7[;m].
    if (/38;2;251;191;36/.test(raw) && /[;[]7[;m]/.test(raw)) return true;
  }
  return false;
}

/** Lista de comandos visible en el menú "/" (con o sin cursor). */
function menuLabels(screen) {
  const out = [];
  for (const raw of strip(screen).split(/\r?\n/)) {
    const m = raw.match(/(?:[▸>]\s+)?(\d+)\.\s+(\/\S+)/);
    if (m) out.push(m[2]);
  }
  return out;
}

const { spawn } = require("child_process");

async function run(label, bin, home) {
  const results = [];
  const ok = (n, c, extra = "") => {
    results.push([c ? "PASS" : "FAIL", n]);
    console.log(`  [${label}] ${c ? "PASS" : "FAIL"} ${n}${extra ? "  <-- " + extra : ""}`);
  };
  fs.mkdirSync(home, { recursive: true });

  // El wrapper sólo da ~6 s al motor para /health y en esta máquina el
  // arranque tarda 9-20 s (frío→tibio), así que caería al respaldo Ink. Para
  // probar la PANTALLA GO de verdad se arranca el motor a mano y se engancha
  // el binario directo (mismo protocolo NOIRA_PORT/NOIRA_TOKEN que el wrapper).
  // El timeout de 6 s del wrapper queda como hallazgo aparte en el informe.
  const evt = require("events");
  console.log(`\n=== ${label} (${path.basename(bin)}) ===`);
  console.log(`  [${label}] arrancando motor...`);
  const port = label === "ANTES" ? 4131 : 4132;
  const motor = spawn(process.execPath, [WRAP, "serve", "--thin", "--port", String(port)], {
    cwd: ROOT,
    env: { ...process.env, NOIRARC_HOME: home, NOIRA_NO_PARENT_WATCH: "1", NOIRA_SERVE_TOKEN: "probe-token-123" },
    stdio: "ignore",
  });
  const motorDead = new Promise((r) => motor.once("exit", r));
  let healthy = false;
  for (let i = 0; i < 120 && !healthy; i++) {
    await sleep(500);
    if (motor.exitCode !== null) break;
    try {
      const r = await fetch(`http://127.0.0.1:${port}/health`);
      if (r.ok) healthy = true;
    } catch { /* aún arrancando */ }
  }
  ok("motor-arranca", healthy, healthy ? "" : `exit=${motor.exitCode}`);
  if (!healthy) {
    try { motor.kill(); } catch { /* noop */ }
    return results;
  }

  const env = { ...process.env, NOIRARC_HOME: home, NOIRA_PORT: String(port), NOIRA_TOKEN: "probe-token-123" };
  const p = pty.spawn(bin, [], { cols: COLS, rows: ROWS, cwd: ROOT, env });
  const finish = async () => {
    try { motor.kill(); } catch { /* noop */ }
    await Promise.race([motorDead, sleep(3000)]);
  };
  const { t, sa } = mkTerm();
  let raw = "";
  p.onData((d) => { raw += d; t.write(d); });

  // 1) boot: la pantalla Go pinta "> NOIRACODER" o muere con código ≠ 0.
  const s = await waitScreen(sa, /NOIRACODER/, 30000);
  const boot = /NOIRACODER/.test(strip(s)) ? s : "";
  ok("boot", !!boot);
  if (!boot) {
    snap(`${label}-00-boot.txt`, sa.serialize({ excludeModes: false }));
    snap(`${label}-00-boot.ansi`, raw);
    try { p.kill(); } catch { /* noop */ }
    try { t.dispose(); } catch { /* noop */ }
    await finish();
    return results;
  }
  await sleep(2500);
  snap(`${label}-00-boot.txt`, sa.serialize({ excludeModes: false }));
  snap(`${label}-00-boot.ansi`, raw);

  // 2) historial no vacío: /sessions no lanza turno pero sí deja historial.
  p.write("/sessions\r");
  await sleep(3000);

  // 3) M1 — /connect y flechas
  p.write("/connect\r");
  const c1 = await waitScreen(sa, /\d\.\s+\S/, 20000);
  snap(`${label}-01-connect-initial.txt`, sa.serialize({ excludeModes: false }));
  const sel0 = selectedLine(c1);
  ok("connect-dialog-visible", sel0.length > 0, `sel=${JSON.stringify(sel0.slice(0, 3))}`);

  p.write("\x1b[B"); p.write("\x1b[B"); p.write("\x1b[B");
  await sleep(2500);
  const c2 = sa.serialize({ excludeModes: false });
  snap(`${label}-02-connect-after-DOWNx3.txt`, c2);
  const sel1 = selectedLine(c2);
  ok("M1 flechas-mueven-cursor-en-connect", sel0.join("|") !== sel1.join("|"),
    `antes=${JSON.stringify(sel0.slice(0, 3))} despues=${JSON.stringify(sel1.slice(0, 3))}`);

  // 4) M2 — menú "/" con el mismo componente
  p.write("\x1b");
  await sleep(1500);
  p.write("/");
  await sleep(2500);
  const s1 = sa.serialize({ excludeModes: false });
  snap(`${label}-03-slash-menu.txt`, s1);
  const sl0 = menuLabels(s1);
  ok("M2 menu-slash-abre", sl0.length >= 5, `items=${sl0.length} ${JSON.stringify(sl0.slice(0, 3))}`);
  ok("M2 fila-activa-con-acento", sl0.length > 0 && activeRowHasAccent(s1),
    "SGR 38;2;251;191;36 en la fila cursor");

  p.write("\x1b[B"); p.write("\x1b[B");
  await sleep(2000);
  const s2 = sa.serialize({ excludeModes: false });
  snap(`${label}-04-slash-menu-DOWNx2.txt`, s2);
  ok("M2 menu-slash-flechas", selectedLine(s1).join("|") !== selectedLine(s2).join("|"),
    `antes=${JSON.stringify(selectedLine(s1))} despues=${JSON.stringify(selectedLine(s2))}`);

  // 5) M2 — escribir filtra (el menú NO se traga las teclas).
  // El menú sigue abierto con "/" y "c" lo deja en "/c".
  p.write("c");
  await sleep(2000);
  const s3 = sa.serialize({ excludeModes: false });
  snap(`${label}-05-slash-filtra-c.txt`, s3);
  const sl3 = menuLabels(s3);
  ok("M2 menu-slash-filtra", sl3.length > 0 && sl3.length < sl0.length,
    `items=${sl3.length} (antes ${sl0.length}) ${JSON.stringify(sl3.slice(0, 4))}`);

  // 6) M2 — número elige y rellena la entrada (no ejecuta).
  p.write("1");
  await sleep(2000);
  const s4 = sa.serialize({ excludeModes: false });
  snap(`${label}-06-slash-numero-1.txt`, s4);
  ok("M2 menu-slash-numero-rellena", menuLabels(s4).length === 0,
    `menu=${menuLabels(s4).length}`);

  // 7) N — acento y aire en la pantalla
  p.write("\x1b");
  await sleep(1500);
  const fin = sa.serialize({ excludeModes: false });
  snap(`${label}-07-final.txt`, fin);
  const plain = strip(fin);
  // La cabecera es la línea "> NOIRACODER" que NO es el texto de bienvenida
  // (ese dice "> NOIRACODER escribe…"). Debe llevar el acento #FBBF24.
  const headLines = fin.split(/\r?\n/).filter((l) => {
    const p = l.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "");
    return /> NOIRACODER/.test(p) && !/escribe \/help/.test(p);
  });
  ok("N acento-en-cabecera", headLines.length > 0 && /38;2;251;191;36/.test(headLines.join("\n")),
    `lineas-cabecera=${headLines.length}`);
  ok("N acento-en-modo", /38;2;251;191;36/.test(fin) && /build/.test(strip(fin)), "modo en acento");
  ok("N panels-respiran", /│ {2,}\S/.test(plain), "padding lateral >= 2 dentro del panel");
  ok("N bordes-casi-cuadrados", /╭─{3,}/.test(plain) && !/[╔┏+]{1}═|┌─{4}/.test(plain), "RoundedBorder, sin caja pesada");
  ok("N filete-cabecera", /─{20,}/.test(plain), "separador bajo la cabecera");
  snap(`${label}-99-stream.ansi`, raw);

  p.write("/quit\r");
  await sleep(2500);
  try { p.kill(); } catch { /* ya salió */ }
  try { t.dispose(); } catch { /* noop */ }
  await finish;
  await sleep(500);
  return results;
}

(async () => {
  // node-pty en Windows no abre ConPTY de forma fiable dos veces seguidas en
  // el mismo proceso; cada binario corre en su propio proceso y el resumen
  // se junta después. Reintentos de arranque: hasta 3 por binario.
  const which = (process.argv[2] || "DESPUES").toUpperCase();
  const bin = which === "ANTES" ? BEFORE : AFTER;
  if (!fs.existsSync(bin)) {
    console.error("Falta el binario " + bin);
    process.exit(2);
  }
  const r = await run(which, bin, path.join(TMP, "opencode/mn/home-" + which.toLowerCase()));
  const pass = r.filter((x) => x[0] === "PASS").length;
  console.log(`\n=== ${which}: ${pass}/${r.length} PASS ===`);
  fs.writeFileSync(path.join(OUT, which + "-resumen.txt"),
    r.map(([s, n]) => `${s} ${n}`).join("\n") + "\n", "utf8");
  process.exit(pass === r.length ? 0 : 1);
})().catch((e) => { console.error("HARNESS-ERROR", e); process.exit(3); });
