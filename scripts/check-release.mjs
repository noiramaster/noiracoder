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
