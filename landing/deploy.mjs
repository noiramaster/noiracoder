#!/usr/bin/env node
/**
 * H7 — Deploy a Cloudflare Pages con un clic.
 * Uso: node landing/deploy.mjs
 *
 * Lee credenciales del sistema H8 (credentials.json cifrado)
 * o de variables de entorno como fallback.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LANDING = __dirname;
const TOML = path.join(LANDING, "wrangler.toml");

if (!existsSync(TOML)) {
  console.error("[deploy] ERROR: wrangler.toml no encontrado en", LANDING);
  process.exit(1);
}

const toml = readFileSync(TOML, "utf8");
const nameMatch = toml.match(/^name\s*=\s*"(.+)"/m);
const projectName = nameMatch?.[1] ?? "noiracoder";

console.log(`[deploy] Proyecto: ${projectName}`);
console.log(`[deploy] Directorio: ${LANDING}`);
console.log(`[deploy] Plataforma: Cloudflare Pages`);
console.log("");

// Verificar wrangler
try {
  execSync("wrangler --version", { stdio: "ignore" });
} catch {
  console.error("[deploy] ERROR: wrangler no instalado. Ejecuta: npm install -g wrangler");
  process.exit(1);
}

// H8: Intentar leer credenciales del sistema cifrado
let cloudflareToken = process.env.CLOUDFLARE_API_TOKEN;
let accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

if (!cloudflareToken || !accountId) {
  try {
    const { getCredential } = await import("../dist/auth/credentials.js");
    if (!cloudflareToken) cloudflareToken = await getCredential("cloudflare_api_token");
    if (!accountId) accountId = await getCredential("cloudflare_account_id");
    if (cloudflareToken) {
      console.log("[deploy] Credenciales cargadas del sistema H8 (cifrado)");
    }
  } catch (e) {
    // Fallback: intentar leer de wrangler OAuth
    console.log("[deploy] Sistema H8 no disponible, usando wrangler OAuth...");
  }
}

if (!cloudflareToken && !accountId) {
  console.log("[deploy] No hay token de autenticación.");
  console.log("[deploy] Opciones:");
  console.log("  1. Usa /connect en NoiraCoder para conectar Cloudflare");
  console.log("  2. Variables de entorno:");
  console.log("     CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ACCOUNT_ID=yyy node landing/deploy.mjs");
  console.log("");
  console.log("[deploy] Intentando deploy con wrangler OAuth...");
  console.log("");
}

// Deploy
console.log("[deploy] Desplegando...");
try {
  const env = { ...process.env };
  if (cloudflareToken) env.CLOUDFLARE_API_TOKEN = cloudflareToken;
  if (accountId) env.CLOUDFLARE_ACCOUNT_ID = accountId;

  execSync(`wrangler pages deploy . --project-name="${projectName}"`, {
    cwd: LANDING,
    stdio: "inherit",
    env,
  });
  console.log("");
  console.log(`[deploy] ✓ Deploy completado!`);
  console.log(`[deploy] URL: https://${projectName}.pages.dev`);
} catch (e) {
  console.error("");
  console.error("[deploy] ERROR: deploy falló");
  console.error("[deploy] Soluciones:");
  console.error("  - Usa /connect en NoiraCoder para conectar Cloudflare");
  console.error("  - Verifica CLOUDFLARE_API_TOKEN y CLOUDFLARE_ACCOUNT_ID");
  process.exit(1);
}
