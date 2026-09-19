/* HITO 5.3 — test:i18n: falla ante (a) claves que falten en algún idioma,
 * (b) cadenas no-inglesas idénticas al inglés, (c) frases duplicadas dentro
 * de una cadena, (d) texto visible sin data-i18n en las páginas shell,
 * (e) data-i18n que no resuelven, (f) <pre> sin data-i18n.
 * Alcance: landing shell (index, docs, blog/index, contacto, legal, sobre,
 * terminos, privacidad). Los posts del blog son ES+EN por diseño (5.6).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "landing");
let fails = [];
const fail = (m) => { fails.push(m); console.log("[FAIL] " + m); };
const pass = (m) => console.log("[PASS] " + m);

// ── Carga i18n.js con DOM mínimo ──
const sandbox = {
  console,
  localStorage: { getItem: () => null, setItem: () => {} },
  navigator: { language: "en" },
  document: {
    documentElement: {},
    querySelectorAll: () => [],
    addEventListener: () => {},
    createElement: () => ({}),
    dispatchEvent: () => {},
    body: { appendChild: () => {} },
  },
  CustomEvent: function () {},
};
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(root, "i18n.js"), "utf8"), sandbox);
const STR = sandbox.NOIRA_STRINGS;
const LOCALES = ["en", "es", "pt", "fr", "de", "it", "ar"];

function flat(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object") flat(v, prefix + k + ".", out);
    else if (typeof v === "string") out[prefix + k] = v;
  }
  return out;
}
const F = {};
for (const l of LOCALES) F[l] = flat(STR[l]);

// (a) paridad de claves con EN
{
  const enKeys = Object.keys(F.en);
  let missing = 0;
  for (const l of LOCALES) {
    if (l === "en") continue;
    for (const k of enKeys) if (!(k in F[l])) { fail(`falta clave ${k} en ${l}`); missing++; }
  }
  if (!missing) pass(`paridad de claves (${enKeys.length} en EN, 0 ausentes)`);
}

// (b) idénticas al inglés (allowlist documentada + tokens técnicos)
{
  // "Streaming/confirmations" son vocabulario técnico estándar también en FR.
  const ALLOW_EXACT = new Set(["fr:tuto.c1t"]);
  let bad = 0;
  for (const l of LOCALES) {
    if (l === "en") continue;
    for (const [k, v] of Object.entries(F[l])) {
      if (!(k in F.en)) continue;
      if (ALLOW_EXACT.has(l + ":" + k)) continue;
      if (v === F.en[k] && v.length > 0 && !isTechnical(v)) { fail(`idéntica al inglés: ${l}:${k} = ${JSON.stringify(v.slice(0, 60))}`); bad++; }
    }
  }
  if (!bad) pass("sin cadenas sin traducir (salvo técnicas)");
}
function isTechnical(s) {
  const t = s.trim();
  if (t.length === 0) return true;
  if (/^(NOIRACODER|FAQ|Blog|Docs|Skills|npm .*|node .*|noira .*|127\.0\.0\.1|Ctrl\+C|Enter|OK|✓.*)$/.test(t)) return true;
  if (/^https?:\/\//.test(t)) return true;
  if (/^[\d\s·>→.,;:!?()\[\]…-]+$/.test(t)) return true;
  if (/^[a-z0-9_./-]+$/i.test(t) && t.length < 24 && !/\s/.test(t)) return true; // comandos/ids
  // Nombres propios universales: sistemas, proveedores, comandos con args.
  if (/Windows|macOS|Linux|PowerShell|OpenRouter|Groq|Zen|Kilo|OAuth|npm install|noira (login|connect)/.test(t)) return true;
  return false;
}

// (c) frase duplicada dentro de una cadena. Se permite el patrón
// etiqueta+enlace ("Sub: <a>Sub</a>"): solo falla si la frase se repite
// en medio del texto (duplicación real tipo "X: X →").
{
  const STOP = ["NoiraCoder", "Noiramaster", "127.0.0.1", "npm install -g noiracoder", "noiramaster@gmail.com", ".noirarc/", "AGENTS.md", "Kilo", "OpenRouter", "Groq", "Zen"];
  let bad = 0;
  for (const l of LOCALES) {
    const keys = Object.keys(F[l]);
    for (const a of keys) {
      for (const b of keys) {
        if (a === b) continue;
        const va = F[l][a], vb = F[l][b];
        if (vb.length <= 12 || STOP.some((s) => vb.includes(s))) continue;
        if (!va.includes(vb)) continue;
        // Quita cola de etiqueta (":", "→", "»") y mira si SIGUE contenida:
        // si solo estaba al final como enlace, es el patrón legítimo.
        const stripped = va.replace(/[:：→»-]+$/, "").trim();
        if (stripped.endsWith(vb)) continue;
        if (/title|nav\.|cta/i.test(a) && vb.length < 20) continue;
        fail(`duplicada en ${l}: "${b}" contenida en "${a}"`);
        bad++;
      }
    }
  }
  if (!bad) pass("sin frases duplicadas");
}

// (d+e+f) páginas shell
const SHELLS = ["index.html", "contacto.html", "legal.html", "sobre.html", "terminos.html", "privacidad.html",
  "docs/skills.html", "docs/tutoriales.html", "blog/index.html"];
{
  let unkeyed = 0, unresolved = 0, preNoKey = 0;
  for (const f of SHELLS) {
    const html = readFileSync(join(root, f), "utf8");
    let body = (html.split("<body>")[1] || "").split("</body>")[0];
    // Los <pre> con clave cubren todo su interior (comentarios traducidos).
    body = body.replace(/<pre[^>]*data-i18n[^>]*>[\s\S]*?<\/pre>/g, "<pre data-i18n></pre>");
    // El JS inline (blog/index genera tarjetas) no es texto visible.
    body = body.replace(/<script[\s\S]*?<\/script>/g, "");
    // (f) pres sin data-i18n
    for (const m of body.matchAll(/<pre(?![^>]*data-i18n)[^>]*>/g)) {
      fail(`${f}: <pre> sin data-i18n`);
      preNoKey++;
    }
    // (e) data-i18n que resuelven en los 7
    for (const m of body.matchAll(/data-i18n(?:-ph)?="([^"]+)"/g)) {
      const key = m[1];
      for (const l of LOCALES) {
        const v = sandbox.noiraT(key, l);
        if (v === key) { fail(`${f}: sin resolver ${key} en ${l}`); unresolved++; }
      }
    }
    // (d) texto visible sin clave: segmentos de texto cuyo tag no lleva data-i18n
    const re = /<([a-z][a-z0-9]*)\b([^>]*)>([^<>]*)/gi;
    let mm;
    while ((mm = re.exec(body)) !== null) {
      const [, tag, attrs, text] = mm;
      if (["script", "style", "pre", "code", "svg", "path", "input", "textarea", "button", "a"].includes(tag)) continue;
      if (/data-i18n/.test(attrs)) continue;
      const t = text.replace(/&[a-z]+;/gi, "").trim();
      if (t.length < 2) continue;
      if (/^[>→·•\-—_.,;:!?()\[\]0-9\s]+$/.test(t)) continue;
      if (/^(NOIRACODER|EN|ES|PT|FR|DE|IT|AR|\[X\]|\[=\])$/.test(t)) continue;
      if (/^https?:|@|\.html|©|202\d/.test(t)) continue;
      // Nombres de skills (› code-review) y comandos literales: universales.
      if (/^› [a-z][a-z-]*$/.test(t)) continue;
      if (/^(noira|npm|node|cd|\/)[\w" ./-]*$/.test(t)) continue;
      // Rutas de fichero literales.
      if (/^\.?[\w/-]+\/[\w./-]+$/.test(t)) continue;
      fail(`${f}: texto sin clave <${tag}>: ${JSON.stringify(t.slice(0, 70))}`);
      unkeyed++;
    }
  }
  if (!unkeyed) pass("todo el texto visible tiene clave");
  if (!unresolved) pass("todas las claves resuelven en los 7");
  if (!preNoKey) pass("todos los <pre> tienen clave");
}

console.log(`\nI18N: ${fails.length} FALLOS`);
process.exit(fails.length ? 1 : 0);
