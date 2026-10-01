#!/usr/bin/env node
/**
 * GATE E v2 (TAREA HHH) — hash del CONTENIDO Go, no del commit.
 *
 * Calcula sha256 determinista sobre todos los ficheros que entran en el
 * binario noira-thin: **\/*.go bajo cmd/ e internal/, más go.mod y go.sum.
 * Formato: por cada fichero (ordenado por ruta), ruta + NUL + contenido.
 *
 * Por qué: un `git pull --rebase` (p. ej. el post diario del blog, que solo
 * toca landing/) cambia el HEAD pero no el contenido Go. El gate v1 (sha de
 * commit embebido) bloqueaba esos binarios aunque eran funcionalmente
 * idénticos — 3 publicaciones bloqueadas por el mismo patrón. Con hash de
 * contenido, un rebase que no toque Go nunca invalida un binario válido.
 *
 * Se lee de DISCO (no de git): un árbol sucio da hash distinto y bloquea
 * (fail-closed). Uso: `node scripts/go-content-hash.mjs` imprime el hash.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function walkGo(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "testdata") continue;
      walkGo(p, out);
    } else if (e.name.endsWith(".go")) {
      out.push(p);
    }
  }
}

const files = [];
walkGo(join(root, "cmd"), files);
walkGo(join(root, "internal"), files);
for (const f of ["go.mod", "go.sum"]) {
  const p = join(root, f);
  if (existsSync(p)) files.push(p);
}
files.sort();

if (files.length === 0) {
  console.error("[go-content-hash] sin ficheros Go: ¿directorio raíz correcto?");
  process.exit(1);
}

const h = createHash("sha256");
for (const p of files) {
  const rel = relative(root, p).split(sep).join("/");
  h.update(rel, "utf8");
  h.update("\0");
  h.update(readFileSync(p));
}
console.log(h.digest("hex"));
