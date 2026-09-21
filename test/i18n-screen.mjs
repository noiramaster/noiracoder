/* M1.1/M1.10 — i18n de pantalla: catálogo único + cero literales en Go.
 * A) screen.ts: paridad 60×7, placeholders {x} iguales, sin idénticas al EN
 *    salvo técnicas, sin mojibake, sin frases duplicadas.
 * B) Go: ningún literal visible fuera del catálogo (allowlist explícita).
 * C) TS legacy con trinquete (no puede crecer) + thin.ts sin {error:"…"}.
 * Uso: npm run build && node test/i18n-screen.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { screenStrings } from "../dist/i18n/screen.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let fails = [];
const fail = (m) => { fails.push(m); console.log("[FAIL] " + m); };
const pass = (m) => console.log("[PASS] " + m);

const LANGS = ["en", "es", "pt", "fr", "de", "it", "ar"];
const T = {};
for (const l of LANGS) T[l] = screenStrings(l).strings;
const KEYS = Object.keys(T.en);

// ── A1 paridad ──
{
  let bad = 0;
  for (const l of LANGS) {
    for (const k of KEYS) {
      if (typeof T[l][k] !== "string" || T[l][k].length === 0) { fail(`falta clave ${k} en ${l}`); bad++; }
    }
    for (const k of Object.keys(T[l])) {
      if (!KEYS.includes(k)) { fail(`clave extra ${k} en ${l}`); bad++; }
    }
  }
  if (!bad) pass(`paridad ${KEYS.length} claves × ${LANGS.length} idiomas`);
}
// ── A2 placeholders {x} iguales ──
{
  const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  let bad = 0;
  for (const k of KEYS) {
    const want = vars(T.en[k]);
    for (const l of LANGS) {
      if (l === "en") continue;
      if (vars(T[l][k]) !== want) { fail(`placeholders ${k} en ${l}: [${vars(T[l][k])}] vs EN [${want}]`); bad++; }
    }
    const open = (T.en[k].match(/\{/g) || []).length;
    const close = (T.en[k].match(/\}/g) || []).length;
    if (open !== close) { fail(`llaves sin balancear en EN:${k}`); bad++; }
  }
  if (!bad) pass("placeholders {x} intactos y balanceados");
}
// ── A3 idénticas al inglés: solo técnicas ──
{
  const ALLOW = new Set([
    "es:err_line", "es:confirm_result", "es:err_events_status",
    "pt:confirm_result", "pt:err_events_status",
    "fr:st_mode", "fr:st_session", "fr:quota_warn", "fr:confirm_result",
    "fr:err_sessions_status", "fr:err_session_status",
    "de:confirm_result",
    "it:st_quota", "it:quota_warn", "it:confirm_result", "it:err_events_status",
    "ar:err_events_status",
    "pt:truncated_suffix",
  ]);
  let bad = 0;
  for (const l of LANGS) {
    if (l === "en") continue;
    for (const k of KEYS) {
      if (T[l][k] === T.en[k] && !ALLOW.has(`${l}:${k}`)) { fail(`sin traducir ${l}:${k} = ${JSON.stringify(T.en[k]).slice(0, 60)}`); bad++; }
    }
  }
  if (!bad) pass("sin cadenas sin traducir (salvo técnicas)");
}
// ── A4 mojibake + duplicados ──
{
  let bad = 0;
  for (const l of LANGS) {
    for (const k of KEYS) {
      const s = T[l][k];
      if (s.includes("�")) { fail(`mojibake ${l}:${k}`); bad++; }
      const parts = s.split(/[·:;|/]/).map((x) => x.trim()).filter((x) => x.length > 3);
      if (new Set(parts).size !== parts.length) { fail(`frase duplicada ${l}:${k}`); bad++; }
    }
  }
  if (!bad) pass("sin mojibake ni duplicados");
}

// ── B) Go: cero literales visibles (allowlist explícita con motivo) ──
const GO_ALLOW = new Set([
  // Rutas/cabeceras/eventos de protocolo (nunca se pintan tal cual)
  "/health", "/v1/i18n?lang=", "/v1/turn", "/v1/confirm", "/v1/cancel",
  "/v1/sessions", "/v1/sessions/", "/v1/model", "/v1/events?protocol=",
  "Authorization", "Bearer ", "X-Noira-Protocol", "Content-Type",
  "application/json", "http://127.0.0.1:", "event:", "data:",
  // Env/rutas/prefs (config, no UI)
  "NOIRARC_HOME", "NOIRA_PORT", "NOIRA_TOKEN", ".noirarc", "prefs.json", "language",
  // Marca/puntuación/teclas/comandos (M1.3: no se traducen)
  "NOIRACODER", "NOIRACODER: ", "> ", "  ", " · ", "—", "\n", "", " ",
  "{", "}", "y", "Y", "s", "S", "n", "N", "enter", "esc",
  "/", "/help", "/sessions", "/resume", "/new", "/plan", "/build", "/model", "/quit",
  // Diagnóstico de arranque por stderr (lo ve el wrapper, nunca la pantalla)
  "[noira-thin] faltan NOIRA_PORT/NOIRA_TOKEN en el entorno (los pone el wrapper).",
  "[noira-thin] motor no disponible:", "[noira-thin] sin catálogo de pantalla:",
  "[noira-thin] error:", "i18n: catálogo vacío",
  // Códigos que viajan con texto del catálogo
  "409",
  // Colores de marca y nombre interno por defecto (M3.2 lo sustituye por real)
  "#FBBF24", "#22c55e", "#ef4444", "#eab308", "#666666", "#222222", "(router)",
  // Cabecera de marca (M1.3: la marca no se traduce)
  "> NOIRACODER",
  // Fragmentos printf sin texto (el texto viaja en la clave)
  "i18n %d: %s", "%s: %w",
  // Valor por defecto pre-catálogo (inglés; el catálogo lo sustituye)
  "…[truncated]",
]);
const GO_KEY_NAMES = new Set(KEYS);
{
  const dir = join(root, "internal", "thinclient");
  const cmdDir = join(root, "cmd", "noira-thin");
  const files = readdirSync(dir).filter((f) => f.endsWith(".go") && !f.endsWith("_test.go"))
    .map((f) => join(dir, f)).concat([join(cmdDir, "main.go")]);
  let bad = 0;
  const checked = [];
  for (const f of files) {
    const lines = readFileSync(f, "utf8").split("\n");
    lines.forEach((line, i) => {
      const noStr = line.replace(/`[^`]*`/g, '""'); // tags JSON y literales raw: protocolo
      if (/^\s*import\s*\(?/.test(noStr) || /^\s*"[a-z0-9_./-]+"$/.test(noStr.trim())) return; // imports
      const code = noStr.split("//")[0];
      const lits = [...code.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
      for (const lit of lits) {
        if (GO_ALLOW.has(lit) || GO_KEY_NAMES.has(lit)) continue;
        // Token ASCII sin espacios ni acentos = código/protocolo (json keys,
        // métodos HTTP, %s/%d, rutas). El texto visible siempre tiene
        // espacios, puntuación o no-ASCII.
        if (/^[A-Za-z0-9_./:?=%\\-]+$/.test(lit)) continue;
        if (!/[a-zA-Záéíóúñüàèùâêîôûäöüßçα-ωΑ-Ω\u4e00-\u9fff]/.test(lit)) continue; // sin letras: formato
        fail(`literal Go ${f.split("noiracoder")[1]}:${i + 1} = ${JSON.stringify(lit).slice(0, 80)}`);
        bad++;
      }
    });
  }
  if (!bad) pass(`Go sin literales visibles (${files.length} ficheros)`);
}

// ── C) thin.ts sin errores literales + trinquete TS ──
{
  const thin = readFileSync(join(root, "src", "server", "thin.ts"), "utf8");
  const lits = [...thin.matchAll(/\{ error: "/g)].length;
  if (lits === 0) pass("thin.ts: 0 errores literales (todo por catálogo)");
  else fail(`thin.ts: ${lits} errores literales`);
}
// Trinquete: nº de puntos log./console. por fichero legacy (M1.2+ los migra;
// el número NO puede subir; bajarlo es bienvenido).
const RATCHET = {
  "src/cli/repl.ts": 58, "src/cli/cli.ts": 31, "src/tui/tui.ts": 8,
  "src/core/welcome.ts": 0, "src/server/thin.ts": 6, "src/sandbox/approve.ts": 0,
};
{
  let bad = 0;
  for (const [f, max] of Object.entries(RATCHET)) {
    let n = 0;
    try {
      const src = readFileSync(join(root, f), "utf8");
      n = [...src.matchAll(/(log\.(info|ok|warn|error|raw)|console\.(log|error|warn))\s*\(/g)].length;
    } catch { fail(`falta fichero ${f}`); bad++; continue; }
    if (n > max) { fail(`trinquete ${f}: ${n} > ${max} (migra al catálogo, no añadas)`); bad++; }
  }
  if (!bad) pass("trinquete TS: ningún fichero crece en literales");
}

console.log(`\nI18N-SCREEN: ${fails.length} FALLOS`);
process.exit(fails.length ? 1 : 0);
