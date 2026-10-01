#!/usr/bin/env node
/**
 * prepublishOnly — candado técnico del runbook 0.2.0: npm publish se ABORTA
 * si el release del tag de ESTA versión no existe o no trae los 5 binarios
 * con su SHA256SUMS. Así el paquete nunca sale antes que los binarios.
 * (NOIRA_GO_BIN_URL no aplica aquí: en publish se exige el release real.)
 *
 * prepack / check:artifacts — modo `--artifacts-only`: valida SÓLO los
 * artefactos locales (sin red) para que `npm i -g .` falle ruidosamente si el
 * paquete se empaqueta sin motor thin o sin binario verificado.
 */
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { get } from "node:https";

const root = dirname(fileURLToPath(import.meta.url));
const pkgDir = join(root, "..");
const { version } = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
const TAG = `noira-go-v${version}`;
const REPO = "noiramaster/noiracoder";
const ARTIFACTS_ONLY = process.argv.includes("--artifacts-only");
const WANT = [
  "noira-thin-Windows-x86_64.exe",
  "noira-thin-Linux-x86_64",
  "noira-thin-Linux-arm64",
  "noira-thin-Darwin-x86_64",
  "noira-thin-Darwin-arm64",
];

/**
 * GATE A/B/C — invariantes que el 2026-09-26 se incumplieron a la vez y el
 * publicable salió igual: dist sin servidor thin, CLI sin `serve --thin` y
 * binario de pantalla sin verificar. Cada uno corresponde a un fallo real.
 * GATE D (NN, 2026-09-27) — cada optionalDependencies debe existir YA en el
 * registro público con la versión exacta pedida. Si falta, npm la salta EN
 * SILENCIO (es opcional) y el usuario cae al respaldo Ink sin ningún error.
 */
function checkLocalArtifacts() {
  const problems = [];

  // A) El motor thin debe estar compilado: sin dist/server/thin.js el
  //    `serve --thin` del wrapper no arranca y startGo() cae a Ink.
  const thinServer = join(pkgDir, "dist", "server", "thin.js");
  if (!existsSync(thinServer)) {
    problems.push("dist/server/thin.js no existe (motor thin sin compilar: `npm run build`)");
  }

  // B) La CLI debe reconocer `serve --thin`; si no, el flag se ignora en
  //    silencio, /health nunca responde y el respaldo Ink tapa el error.
  const cliJs = join(pkgDir, "dist", "cli", "cli.js");
  if (!existsSync(cliJs)) {
    problems.push("dist/cli/cli.js no existe (CLI sin compilar: `npm run build`)");
  } else if (!readFileSync(cliJs, "utf8").includes("--thin")) {
    problems.push("dist/cli/cli.js no contiene `--thin` (CLI vieja: no arranca el servidor thin)");
  }

  // C) El binario de pantalla debe existir y cuadrar con su SHA256 publicado
  //    en bin/noira-thin.<exe>.sha256 (H6). Si no cuadra, no se distribuye.
  const binName = process.platform === "win32" ? "noira-thin.exe" : "noira-thin";
  const binPath = join(pkgDir, "bin", binName);
  const sumPath = `${binPath}.sha256`;
  if (!existsSync(binPath)) {
    problems.push(`bin/${binName} no existe (pantalla Go sin compilar: \`npm run build:thin\`)`);
  } else if (!existsSync(sumPath)) {
    problems.push(`bin/${binName}.sha256 no existe (hash H6 ausente: \`npm run build:thin\`)`);
  } else {
    const real = createHash("sha256").update(readFileSync(binPath)).digest("hex");
    const recorded = readFileSync(sumPath, "utf8").trim().split(/\s+/)[0];
    if (real !== recorded) {
      problems.push(`bin/${binName} no cuadra con su .sha256 (real ${real}, registrado ${recorded})`);
    } else {
      console.error(`[check] ok: bin/${binName} SHA256 ${real} verificado.`);
    }
  }

  if (problems.length > 0) {
    console.error(`[check] BLOQUEADO: artefactos locales incompletos (${problems.length}):`);
    for (const p of problems) console.error(`[check]   - ${p}`);
    console.error("[check] Orden correcto: npm run build && npm run build:thin.");
    process.exit(1);
  }
  console.error(`[check] ok: dist/server/thin.js + dist/cli/cli.js(--thin) + bin/${binName} verificados.`);
}

checkLocalArtifacts();
if (ARTIFACTS_ONLY) process.exit(0);

// GATE E v2 (TAREA HHH) — los binarios de plataforma deben contener el hash
// del CONTENIDO Go actual (scripts/go-content-hash.mjs, embebido vía ldflags
// -X .../internal/version.GoContentHash; ver scripts/build-thin*.mjs).
// El gate v1 comparaba el sha de commit: un `git pull --rebase` (p. ej. el
// post diario del blog, que solo toca landing/) cambiaba el HEAD sin cambiar
// ni una línea Go y bloqueaba binarios funcionalmente idénticos — 3 veces el
// mismo patrón. Con hash de contenido, solo un cambio real en cmd/,
// internal/, go.mod o go.sum invalida el binario.
// Solo en prepublish completo. Fail-closed: sin hash o sin binarios, bloquea.
{
  let contentHash;
  try {
    contentHash = execFileSync(process.execPath, [join(pkgDir, "scripts", "go-content-hash.mjs")], { cwd: pkgDir, encoding: "utf8" }).trim();
    if (!/^[0-9a-f]{64}$/.test(contentHash)) throw new Error(`hash raro: ${contentHash}`);
  } catch (e) {
    console.error(`[prepublish] BLOQUEADO (GATE E): no se pudo calcular el hash de contenido Go (${e instanceof Error ? e.message : e}).`);
    process.exit(1);
  }
  const BINS = [
    { rel: "npm/noiracoder-win32-x64/bin/noira-thin.exe", exec: true },
    { rel: "npm/noiracoder-darwin-x64/bin/noira-thin", exec: false },
    { rel: "npm/noiracoder-darwin-arm64/bin/noira-thin", exec: false },
    { rel: "npm/noiracoder-linux-x64/bin/noira-thin", exec: false },
  ];
  const stale = [];
  for (const b of BINS) {
    const p = join(pkgDir, b.rel);
    if (!existsSync(p)) {
      stale.push(`${b.rel} (falta: corre scripts/build-thin-all.mjs tras el commit)`);
      continue;
    }
    if (!readFileSync(p).includes(contentHash)) {
      stale.push(`${b.rel} (no contiene el hash de contenido ${contentHash.slice(0, 12)}: Go cambió, reconstruye)`);
      continue;
    }
    if (b.exec) {
      let out = "";
      try {
        out = execFileSync(p, ["--version"], { encoding: "utf8", timeout: 15000 }).trim();
      } catch (e) {
        stale.push(`${b.rel} (--version falló: ${e instanceof Error ? e.message : e})`);
        continue;
      }
      if (!out.includes(contentHash)) {
        stale.push(`${b.rel} (--version no trae el hash: "${out.slice(0, 100)}")`);
        continue;
      }
    }
    console.error(`[prepublish] ok (GATE E): ${b.rel} contenido ${contentHash.slice(0, 12)} verificado.`);
  }
  if (stale.length > 0) {
    console.error(`[prepublish] BLOQUEADO (GATE E): binarios con contenido Go distinto al actual (${contentHash.slice(0, 12)}):`);
    for (const s of stale) console.error(`[prepublish]   - ${s}`);
    process.exit(1);
  }
}

function fetchText(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    get(url, { headers: { "User-Agent": "noiracoder-prepublish" } }, (res) => {
      // DD: github.com/releases/download SIEMPRE responde 302 hacia una URL
      // firmada; sin seguirlo el gate no podía pasar nunca aunque el release
      // exista y esté completo.
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume();
        fetchText(res.headers.location, redirects - 1).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} en ${url}`));
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      res.on("error", reject);
    }).on("error", reject);
  });
}

try {
  const sums = await fetchText(`https://github.com/${REPO}/releases/download/${TAG}/SHA256SUMS`);
  const lines = sums.split("\n").map((l) => l.trim()).filter(Boolean);
  const missing = [];
  const malformed = [];
  for (const n of WANT) {
    // Formato sha256sum: "<64 hex>  <fichero>" (también vale "*" binario).
    const line = lines.find((l) => l.endsWith(" " + n));
    if (!line) missing.push(n);
    else if (!/^[0-9a-fA-F]{64}\s+[ *]?\S+/.test(line)) malformed.push(n);
  }
  if (missing.length > 0) {
    console.error(`[prepublish] el release ${TAG} no trae: ${missing.join(", ")}. Publica primero los binarios (git tag ${TAG}).`);
    process.exit(1);
  }
  if (malformed.length > 0) {
    console.error(`[prepublish] SHA256SUMS de ${TAG} con hash malformado en: ${malformed.join(", ")}. Regenera el release.`);
    process.exit(1);
  }
  console.error(`[prepublish] ok: ${TAG} trae los 5 binarios + SHA256SUMS con hashes válidos.`);
  console.error(`[prepublish] nota: la igualdad byte-a-byte binario<->hash se verifica en la instalación (fetch-go-binary) y en el pty post-tag (B2).`);
} catch (e) {
  console.error(`[prepublish] BLOQUEADO: no hay release ${TAG} con binarios (${e instanceof Error ? e.message : e}).`);
  console.error(`[prepublish] Orden correcto: bump versión → tag ${TAG} → CI publica → npm publish.`);
  process.exit(1);
}

// GATE D (NN) — los opcionales de plataforma deben existir en el registro
// con la versión EXACTA pedida (pin, sin rangos: "0.2.0", no "^0.2.0").
// Si alguno falta, npm lo omite en silencio y el instalado cae a Ink.
function regJson(path) {
  return new Promise((resolve, reject) => {
    get(`https://registry.npmjs.org/${path}`, { headers: { "User-Agent": "noiracoder-prepublish", Accept: "application/json" } }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} en registry.npmjs.org/${path}`));
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
        catch (e) { reject(e); }
      });
      res.on("error", reject);
    }).on("error", reject);
  });
}

try {
  const { optionalDependencies = {} } = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
  const names = Object.keys(optionalDependencies);
  if (names.length === 0) {
    console.error("[prepublish] BLOQUEADO: sin optionalDependencies de plataforma (el thin no llegaría a nadie).");
    process.exit(1);
  }
  for (const name of names) {
    const want = String(optionalDependencies[name]);
    if (!/^\d+\.\d+\.\d+$/.test(want)) {
      console.error(`[prepublish] BLOQUEADO: ${name} pide "${want}" (debe ser versión exacta, p. ej. "0.2.0").`);
      process.exit(1);
    }
    const meta = await regJson(`${name.replace("/", "%2f")}/${want}`);
    if (!meta || meta.version !== want) {
      console.error(`[prepublish] BLOQUEADO: ${name}@${want} no existe en el registro público.`);
      process.exit(1);
    }
    console.error(`[prepublish] ok: opcional ${name}@${want} existe en el registro.`);
  }
} catch (e) {
  console.error(`[prepublish] BLOQUEADO: no se pudo verificar optionalDependencies (${e instanceof Error ? e.message : e}).`);
  process.exit(1);
}
