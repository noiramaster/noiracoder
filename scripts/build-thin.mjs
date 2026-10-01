#!/usr/bin/env node
/**
 * npm run build:thin — compila la pantalla Go al bin/ del paquete
 * (flujo de desarrollo local; el CI compila los 5 targets del release).
 * H6: genera hash SHA256 del binario para verificación.
 */
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = process.platform === "win32" ? "bin/noira-thin.exe" : "bin/noira-thin";
// GATE E v2: embeber git sha (procedencia) + hash de CONTENIDO Go
// (scripts/go-content-hash.mjs). El gate comprueba el contenido: un rebase
// que no toque Go no invalida el binario.
let gitSha = "dev";
try {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
  if (r.status === 0 && /^[0-9a-f]{40}$/.test(r.stdout.trim())) gitSha = r.stdout.trim();
  else console.error(`[build:thin] aviso: sin git sha (uso "dev"): ${(r.stderr || "").toString().slice(0, 120)}`);
} catch (e) {
  console.error(`[build:thin] aviso: git no disponible (uso "dev").`);
}
let contentHash = "dev";
try {
  const r = spawnSync(process.execPath, [join(root, "scripts", "go-content-hash.mjs")], { cwd: root, encoding: "utf8" });
  if (r.status === 0 && /^[0-9a-f]{64}$/.test(r.stdout.trim())) contentHash = r.stdout.trim();
  else console.error(`[build:thin] aviso: sin hash de contenido (uso "dev").`);
} catch (e) {
  console.error(`[build:thin] aviso: hash de contenido no disponible (uso "dev").`);
}
const r = spawnSync("go", ["build", "-trimpath", "-ldflags", `-s -w -X github.com/opencode-ai/opencode/internal/version.GitSha=${gitSha} -X github.com/opencode-ai/opencode/internal/version.GoContentHash=${contentHash}`, "-o", out, "./cmd/noira-thin"],
  { cwd: root, stdio: "inherit", env: { ...process.env, CGO_ENABLED: "0" } });
if (r.status !== 0) {
  console.error("[build:thin] falló la compilación (¿Go instalado? https://go.dev).");
  process.exit(r.status ?? 1);
}
// H6: generar SHA256 del binario.
try {
  const { readFileSync } = await import("node:fs");
  const bin = readFileSync(join(root, out));
  const sha = createHash("sha256").update(bin).digest("hex");
  const hashFile = process.platform === "win32" ? "bin/noira-thin.exe.sha256" : "bin/noira-thin.sha256";
  writeFileSync(join(root, hashFile), `${sha}  ${out.split("/").pop()}\n`, "utf8");
  console.error(`[build:thin] hash: ${sha} → ${hashFile}`);
} catch (e) {
  console.error(`[build:thin] hash no generado: ${e.message}`);
}
console.error(`[build:thin] ok: ${out}`);
