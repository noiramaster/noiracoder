#!/usr/bin/env node
/**
 * prepublishOnly — candado técnico del runbook 0.2.0: npm publish se ABORTA
 * si el release del tag de ESTA versión no existe o no trae los 5 binarios
 * con su SHA256SUMS. Así el paquete nunca sale antes que los binarios.
 * (NOIRA_GO_BIN_URL no aplica aquí: en publish se exige el release real.)
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { get } from "node:https";

const root = dirname(fileURLToPath(import.meta.url));
const pkgDir = join(root, "..");
const { version } = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
const TAG = `noira-go-v${version}`;
const REPO = "noiramaster/noiracoder";
const WANT = [
  "noira-thin-Windows-x86_64.exe",
  "noira-thin-Linux-x86_64",
  "noira-thin-Linux-arm64",
  "noira-thin-Darwin-x86_64",
  "noira-thin-Darwin-arm64",
];

function fetchText(url) {
  return new Promise((resolve, reject) => {
    get(url, { headers: { "User-Agent": "noiracoder-prepublish" } }, (res) => {
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
