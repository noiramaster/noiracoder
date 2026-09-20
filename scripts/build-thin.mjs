#!/usr/bin/env node
/**
 * npm run build:thin — compila la pantalla Go al bin/ del paquete
 * (flujo de desarrollo local; el CI compila los 5 targets del release).
 */
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = process.platform === "win32" ? "bin/noira-thin.exe" : "bin/noira-thin";
const r = spawnSync("go", ["build", "-trimpath", "-ldflags", "-s -w", "-o", out, "./cmd/noira-thin"],
  { cwd: root, stdio: "inherit", env: { ...process.env, CGO_ENABLED: "0" } });
if (r.status !== 0) {
  console.error("[build:thin] falló la compilación (¿Go instalado? https://go.dev).");
  process.exit(r.status ?? 1);
}
console.error(`[build:thin] ok: ${out}`);
