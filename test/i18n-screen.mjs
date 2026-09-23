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
import { screenStrings, screenPlural, relTime, dayBucket, groupLabel, SCREEN_LANGS, SCREEN_PROVENANCE } from "../dist/i18n/screen.js";

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
  const CATS = new Set(["zero", "one", "two", "few", "many", "other"]);
  for (const l of LANGS) {
    for (const k of KEYS) {
      if (typeof T[l][k] !== "string" || T[l][k].length === 0) { fail(`falta clave ${k} en ${l}`); bad++; }
    }
    for (const k of Object.keys(T[l])) {
      // Variantes plurales extra solo en ar (6 formas); el resto, paridad exacta.
      const m = k.match(/^(.*)__(\w+)$/);
      if (!KEYS.includes(k) && !(l === "ar" && m && KEYS.includes(m[1]) && CATS.has(m[2]))) {
        fail(`clave extra ${k} en ${l}`); bad++;
      }
    }
  }
  if (!bad) pass(`paridad ${KEYS.length} claves × ${LANGS.length} idiomas (+variantes ar)`);
}
// ── A1b procedencia marcada (punto 4): ningún idioma sin marca ──
{
  let bad = 0;
  for (const l of SCREEN_LANGS) {
    if (!SCREEN_PROVENANCE[l]) { fail(`sin procedencia: ${l}`); bad++; }
  }
  const nonAuto = Object.entries(SCREEN_PROVENANCE).filter(([, v]) => v !== "auto" && v !== "source");
  if (nonAuto.length) { fail(`procedencia inválida: ${JSON.stringify(nonAuto)}`); bad++; }
  if (!bad) pass(`procedencia marcada (${Object.values(SCREEN_PROVENANCE).filter((v) => v === "auto").length} auto, resto source)`);
}
// ── A2 placeholders {x} iguales ──
{
  const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  let bad = 0;
  for (const k of KEYS) {
    const want = vars(T.en[k]);
    const wantSet = new Set(want.split(",").filter(Boolean));
    for (const l of LANGS) {
      if (l === "en") continue;
      const got = vars(T[l][k]);
      const isVariant = /__(zero|one|two|few|many|other)$/.test(k);
      if (isVariant) {
        // Las variantes pueden OMITIR vars (formas numberless) pero no añadir.
        const extra = got.split(",").filter(Boolean).filter((v) => !wantSet.has(v));
        if (extra.length) { fail(`placeholders ${k} en ${l}: añade [${extra}]`); bad++; }
      } else if (got !== want) {
        fail(`placeholders ${k} en ${l}: [${got}] vs EN [${want}]`); bad++;
      }
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
    // learn_row/learn_stat: notación técnica idéntica (n=/ok=/p50=), sin texto
    "es:learn_row", "es:learn_stat", "pt:learn_row", "pt:learn_stat",
    "fr:learn_row", "fr:learn_stat", "de:learn_row", "de:learn_stat",
    "it:learn_row", "it:learn_stat", "ar:learn_row", "ar:learn_stat",
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
// ── A5 plurales completos por idioma (M1.2) ──
{
  const NEED = {
    en: ["one", "other"], es: ["one", "other"], pt: ["one", "other"],
    fr: ["one", "other"], de: ["one", "other"], it: ["one", "other"],
    ar: ["zero", "one", "two", "few", "many", "other"],
  };
  let bad = 0;
  for (const l of LANGS) {
    for (const base of ["resumed", "session_row"]) {
      for (const c of NEED[l]) {
        const v = T[l][`${base}__${c}`];
        // Árabe zero/one/two son numberless por gramática ("دوران", "لا أدوار").
        const numberless = l === "ar" && ["zero", "one", "two"].includes(c);
        if (typeof v !== "string" || (!numberless && !v.includes("{turns}"))) { fail(`plural ${l}:${base}__${c} ausente o sin {{turns}}`); bad++; }
      }
    }
  }
  if (!bad) pass("plurales completos (ar 6, resto one/other)");
}
// ── A6 unidades: plural, relativo, cubos (M1.2) ──
{
  let bad = 0;
  const eq = (got, want, name) => { if (got !== want) { fail(`${name}: got=${JSON.stringify(got)} want=${JSON.stringify(want)}`); bad++; } };
  eq(screenPlural("ar", "resumed", 0, { name: "X" }), "(تم استئناف الجلسة: X، لا أدوار)", "ar-zero");
  eq(screenPlural("ar", "resumed", 1, { name: "X" }), "(تم استئناف الجلسة: X، دور واحد)", "ar-one");
  eq(screenPlural("ar", "resumed", 2, { name: "X" }), "(تم استئناف الجلسة: X، دوران)", "ar-two");
  eq(screenPlural("ar", "resumed", 5, { name: "X", turns: 5 }), "(تم استئناف الجلسة: X، 5 أدوار)", "ar-few");
  eq(screenPlural("ar", "resumed", 11, { name: "X", turns: 11 }), "(تم استئناف الجلسة: X، 11 دورًا)", "ar-many");
  eq(screenPlural("en", "resumed", 1, { name: "X", turns: 1 }), "(session resumed: X, 1 turn)", "en-one");
  eq(screenPlural("fr", "resumed", 0, { name: "X", turns: 0 }), "(session reprise : X, 0 tour)", "fr-zero-es-one");
  eq(screenPlural("xx", "resumed", 3, { name: "X", turns: 3 }), "(session resumed: X, 3 turns)", "fallback-en");
  const now = Date.now();
  const r1 = relTime("es", new Date(now - 90 * 1000).toISOString(), now);
  if (!/minuto/.test(r1)) { fail(`relTime es 90s: ${r1}`); bad++; }
  const r2 = relTime("en", new Date(now - 3 * 3600000).toISOString(), now);
  if (!/hour/.test(r2)) { fail(`relTime en 3h: ${r2}`); bad++; }
  if (relTime("es", "no-fecha", now) !== "") { fail("relTime con fecha mala debe ser vacío"); bad++; }
  eq(dayBucket(new Date(now - 1000).toISOString(), now), "today", "bucket-today");
  eq(dayBucket(new Date(now - 86400000).toISOString(), now), "yesterday", "bucket-yesterday");
  eq(dayBucket(new Date(now - 3 * 86400000).toISOString(), now), "week", "bucket-week");
  eq(dayBucket(new Date(now - 30 * 86400000).toISOString(), now), "older", "bucket-older");
  eq(groupLabel("es", "today"), "Hoy", "group-es");
  eq(groupLabel("ar", "older"), "قبل", "group-ar");
  if (!bad) pass("plural/relativo/cubos OK (incl. árabe 6 formas)");
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
  "src/cli/repl.ts": 59, "src/cli/cli.ts": 33, "src/tui/tui.ts": 8,
  "src/core/welcome.ts": 0, "src/server/thin.ts": 7, "src/sandbox/approve.ts": 0,
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

// ── D) Diccionario CLI: 7 completos, resto con fallback documentado (M1.10) ──
{
  const { MESSAGES } = await import("../dist/i18n/dictionary.js");
  const flat = (o, p = "", out = {}) => {
    for (const k in o) {
      if (o[k] && typeof o[k] === "object" && !Array.isArray(o[k])) flat(o[k], p + k + ".", out);
      else out[p + k] = o[k];
    }
    return out;
  };
  const CORE7 = ["en", "es", "pt", "fr", "de", "it", "ar"];
  const FALLBACK_OK = new Set(["freeWarning", "errorExternal"]); // caen a EN vía T()
  const SAME_OK = new Set(["routerLevelPrefix", "es:confirmNo", "it:confirmNo"]); // técnico/cognado
  const en = flat(MESSAGES.en);
  let bad = 0;
  for (const l of Object.keys(MESSAGES)) {
    const f = flat(MESSAGES[l]);
    const missing = Object.keys(en).filter((k) => !(k in f));
    if (CORE7.includes(l)) {
      if (missing.length) { fail(`CLI ${l} incompleto: ${missing.join(",")}`); bad++; }
    } else if (!missing.every((k) => FALLBACK_OK.has(k))) {
      fail(`CLI ${l} pierde: ${missing.join(",")}`); bad++;
    }
    for (const k of Object.keys(f)) {
      if (l !== "en" && f[k] === en[k] && !SAME_OK.has(k) && !SAME_OK.has(`${l}:${k}`)) {
        fail(`CLI sin traducir ${l}:${k}`); bad++;
      }
    }
  }
  if (!bad) pass(`CLI: 7 completos (${Object.keys(en).length} claves), resto con fallback EN`);
}

console.log(`\nI18N-SCREEN: ${fails.length} FALLOS`);
process.exit(fails.length ? 1 : 0);