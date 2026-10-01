#!/usr/bin/env node
/**
 * TAREA C — compila la pantalla Go para todas las plataformas del release
 * (flujo local; el CI corre esto mismo con los 5 targets).
 * Salida: npm/<paquete-plataforma>/bin/<binario> + .sha256 por binario.
 * CGO_ENABLED=0 siempre (binarios estáticos, sin libc).
 */
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Plataforma npm (os/cpu) -> triple Go + nombre de binario.
const TARGETS = [
  { pkg: "noiracoder-win32-x64", os: "win32", cpu: "x64", goos: "windows", goarch: "amd64", bin: "noira-thin.exe" },
  { pkg: "noiracoder-darwin-x64", os: "darwin", cpu: "x64", goos: "darwin", goarch: "amd64", bin: "noira-thin" },
  { pkg: "noiracoder-darwin-arm64", os: "darwin", cpu: "arm64", goos: "darwin", goarch: "arm64", bin: "noira-thin" },
  { pkg: "noiracoder-linux-x64", os: "linux", cpu: "x64", goos: "linux", goarch: "amd64", bin: "noira-thin" },
];

let fail = 0;
// GATE E v2: git sha (procedencia) + hash de CONTENIDO Go (lo que el gate
// comprueba; ver scripts/go-content-hash.mjs y build-thin.mjs).
let gitSha = "dev";
try {
  const rh = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
  if (rh.status === 0 && /^[0-9a-f]{40}$/.test(rh.stdout.trim())) gitSha = rh.stdout.trim();
  else console.error(`[build:thin:all] aviso: sin git sha (uso "dev").`);
} catch {
  console.error(`[build:thin:all] aviso: git no disponible (uso "dev").`);
}
let contentHash = "dev";
try {
  const rc = spawnSync(process.execPath, [join(root, "scripts", "go-content-hash.mjs")], { cwd: root, encoding: "utf8" });
  if (rc.status === 0 && /^[0-9a-f]{64}$/.test(rc.stdout.trim())) contentHash = rc.stdout.trim();
  else console.error(`[build:thin:all] aviso: sin hash de contenido (uso "dev").`);
} catch {
  console.error(`[build:thin:all] aviso: hash de contenido no disponible (uso "dev").`);
}
for (const t of TARGETS) {
  const outDir = join(root, "npm", t.pkg, "bin");
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, t.bin);
  const r = spawnSync("go", ["build", "-trimpath", "-ldflags", `-s -w -X github.com/opencode-ai/opencode/internal/version.GitSha=${gitSha} -X github.com/opencode-ai/opencode/internal/version.GoContentHash=${contentHash}`, "-o", out, "./cmd/noira-thin"],
    { cwd: root, stdio: "pipe", env: { ...process.env, CGO_ENABLED: "0", GOOS: t.goos, GOARCH: t.goarch } });
  if (r.status !== 0) {
    console.error(`[build:thin:all] FALLO ${t.pkg}: ${(r.stderr || []).toString().slice(0, 400)}`);
    fail++;
    continue;
  }
  const bin = readFileSync(out);
  const sha = createHash("sha256").update(bin).digest("hex");
  writeFileSync(out + ".sha256", `${sha}  ${t.bin}\n`, "utf8");
  console.log(`[build:thin:all] ok ${t.pkg}: ${t.bin} (${bin.length} B) sha256=${sha.slice(0, 16)}…`);
}
if (fail) process.exit(1);
console.log("[build:thin:all] 4/4 plataformas ok.");
