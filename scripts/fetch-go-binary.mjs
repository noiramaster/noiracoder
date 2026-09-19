#!/usr/bin/env node
/**
 * HITO 6.2 — postinstall: deja un `noira` que abre la pantalla Go sin pasos.
 * Descarga el binario noira-thin correcto desde el Release de GitHub,
 * verifica su sha256 contra SHA256SUMS y lo deja en bin/.
 * Si algo falla (sin release, sin red, hash distinto, plataforma rara):
 * avisa y cae al motor Ink/Node. NUNCA rompe la instalación.
 * Override para pruebas: NOIRA_GO_BIN_URL (URL directa al binario).
 */
import { createWriteStream, existsSync, chmodSync, readFileSync, unlinkSync } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { get as httpsGet } from "node:https";
import { get as httpGet } from "node:http";

const here = dirname(fileURLToPath(import.meta.url)); // scripts/
const binDir = join(here, "..", "bin");

function target() {
  const p = process.platform, a = process.arch;
  if (p === "win32" && a === "x64") return "noira-thin-Windows-x86_64.exe";
  if (p === "linux" && a === "x64") return "noira-thin-Linux-x86_64";
  if (p === "linux" && a === "arm64") return "noira-thin-Linux-arm64";
  if (p === "darwin" && a === "x64") return "noira-thin-Darwin-x86_64";
  if (p === "darwin" && a === "arm64") return "noira-thin-Darwin-arm64";
  return null;
}

function fetchBuf(url, redirects = 3) {
  return new Promise((resolve, reject) => {
    const get = url.startsWith("http://") ? httpGet : httpsGet;
    get(url, { headers: { "User-Agent": "noiracoder-installer" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume();
        resolve(fetchBuf(res.headers.location, redirects - 1));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

const TAG = "noira-go-v0.1.0";
const REPO = "noiramaster/noiracoder";

async function main() {
  const name = target();
  const destName = name && name.endsWith(".exe") ? "noira-thin.exe" : "noira-thin";
  const dest = join(binDir, destName);
  if (!name) {
    console.error(`[noira] plataforma sin binario Go (${process.platform}/${process.arch}): se usa el motor Node.`);
    return;
  }
  if (existsSync(dest)) return; // ya instalado (p. ej. desarrollo local)
  const override = process.env.NOIRA_GO_BIN_URL;
  try {
    await mkdir(binDir, { recursive: true });
    const tmp = dest + ".tmp";
    if (override) {
      console.error(`[noira] NOIRA_GO_BIN_URL: descargando binario de pruebas…`);
      const buf = await fetchBuf(override);
      const { writeFile } = await import("node:fs/promises");
      await writeFile(tmp, buf);
    } else {
      const [bin, sums] = await Promise.all([
        fetchBuf(`https://github.com/${REPO}/releases/download/${TAG}/${name}`),
        fetchBuf(`https://github.com/${REPO}/releases/download/${TAG}/SHA256SUMS`),
      ]);
      const line = sums.toString("utf8").split("\n").find((l) => l.trim().endsWith(" " + name) || l.trim().endsWith("  " + name));
      if (!line) throw new Error("SHA256SUMS no trae este binario");
      const want = line.trim().split(/\s+/)[0];
      const got = createHash("sha256").update(bin).digest("hex");
      if (got !== want) throw new Error(`hash distinto (quiero ${want.slice(0, 12)}…, tengo ${got.slice(0, 12)}…)`);
      const { writeFile } = await import("node:fs/promises");
      await writeFile(tmp, bin);
    }
    if (process.platform !== "win32") chmodSync(tmp, 0o755);
    await rename(tmp, dest);
    console.error(`[noira] pantalla Go instalada (${name}).`);
  } catch (e) {
    try { await rm(dest + ".tmp", { force: true }); } catch {}
    console.error(`[noira] sin pantalla Go (${e instanceof Error ? e.message : e}): se usa el motor Node.`);
  }
}

// Silencio total si se importa como librería; solo corre en postinstall.
await main().catch(() => {});
