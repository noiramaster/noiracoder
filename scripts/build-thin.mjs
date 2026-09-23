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
const r = spawnSync("go", ["build", "-trimpath", "-ldflags", "-s -w", "-o", out, "./cmd/noira-thin"],
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
