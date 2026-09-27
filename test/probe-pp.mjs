/* PP probe: cleanPre REAL de landing/copy.js contra TODOS los strings de
 * landing/i18n.js en los 7 idiomas que contengan '#'. Reporta líneas copiadas
 * que aún traen '#' sin ser líneas de solo-comentario (fuga al portapapeles).
 * Uso: node test/probe-pp.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "landing");
const sandbox = {
  console,
  localStorage: { getItem: () => null, setItem: () => {} },
  navigator: { language: "en" },
  document: { documentElement: {}, querySelectorAll: () => [], addEventListener: () => {}, createElement: () => ({}), dispatchEvent: () => {}, body: { appendChild: () => {} } },
  CustomEvent: function () {},
};
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(root, "i18n.js"), "utf8"), sandbox);
const STR = sandbox.NOIRA_STRINGS;

// Extrae cleanPre literal de copy.js (la función que usa el botón real).
const copySrc = readFileSync(join(root, "copy.js"), "utf8");
const m = copySrc.match(/function cleanPre\(t\) \{[\s\S]*?\n  \}/);
if (!m) { console.log("NO SE ENCONTRÓ cleanPre EN copy.js"); process.exit(2); }
const cleanPre = new Function(`${m[0]}; return cleanPre;`)();

function flat(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object") flat(v, prefix + k + ".", out);
    else if (typeof v === "string") out[prefix + k] = v;
  }
  return out;
}

let leaks = 0, checked = 0;
for (const lang of Object.keys(STR)) {
  const F = flat(STR[lang]);
  for (const [k, v] of Object.entries(F)) {
    if (!v.includes("#")) continue;
    checked++;
    const out = cleanPre(v);
    for (const ln of out.split("\n")) {
      if (ln.includes("#") && !ln.trimStart().startsWith("#")) {
        leaks++;
        console.log(`[FUGA] ${lang}:${k} -> ${JSON.stringify(ln)}`);
      }
    }
  }
}
console.log(`\nPP: ${checked} bloques con '#' revisados, ${leaks} fugas`);
process.exit(0);
