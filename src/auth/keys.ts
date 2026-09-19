/**
 * Keys multi-provider — 10+ gateways. Un solo `noira login` los guía en cadena.
 * Cada provider guarda su key en ~/.noirarc/keys.json (chmod 600).
 */

import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { join } from "node:path";
import os from "node:os";
import { appInfo } from "../core/appInfo.js";
import { interactiveSignIn } from "./oauth.js";
import { encryptSecrets, decryptSecrets, looksPlainJson } from "./crypto.js";

export type ProviderKeyId =
  | "openrouter" | "groq" | "cerebras" | "mistral" | "github" | "nvidia" | "cohere" | "cloudflare" | "huggingface" | "zen" | "vercel" | "kilo";

export function configDir(): string {
  return process.env.NOIRARC_HOME ?? join(os.homedir(), ".noirarc");
}

async function readKeysMap(): Promise<Record<string, string>> {
  const file = join(configDir(), "keys.json");
  let data: Record<string, string> = {};
  try {
    const raw = await readFile(file);
    if (looksPlainJson(raw)) {
      // Legacy plaintext file: migrate to encrypted storage on next write and
      // read it in the meantime so no key is lost.
      data = JSON.parse(raw.toString("utf8")) as Record<string, string>;
    } else {
      const dec = await decryptSecrets(raw);
      data = JSON.parse(dec) as Record<string, string>;
    }
  } catch { /* empty or corrupted */ }
  return data;
}

export async function loadAllKeys(): Promise<Record<string, string | undefined>> {
  const data = await readKeysMap();
  return {
    openrouter: data.openrouter || process.env.OPENROUTER_API_KEY || undefined,
    groq: data.groq || process.env.GROQ_API_KEY || undefined,
    cerebras: data.cerebras || process.env.CEREBRAS_API_KEY || undefined,
    mistral: data.mistral || process.env.MISTRAL_API_KEY || undefined,
    github: data.github || process.env.GITHUB_TOKEN || undefined,
    nvidia: data.nvidia || process.env.NVIDIA_API_KEY || undefined,
    cohere: data.cohere || process.env.COHERE_API_KEY || undefined,
    cloudflare: data.cloudflare || process.env.CLOUDFLARE_API_KEY || undefined,
    cloudflareAccountId: data.cloudflareAccountId || process.env.CLOUDFLARE_ACCOUNT_ID || undefined,
    huggingface: data.huggingface || data.hf || process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || undefined,
    zen: data.zen || process.env.ZEN_API_KEY || undefined,
    zenBaseUrl: data.zenBaseUrl || process.env.ZEN_BASE_URL || undefined,
    vercel: data.vercel || process.env.VERCEL_TOKEN || undefined,
    kilo: data.kilo || process.env.KILO_API_KEY || undefined,
    kiloBaseUrl: data.kiloBaseUrl || process.env.KILO_BASE_URL || undefined,
  };
}

export async function loadStoredKey(): Promise<string | null> {
  const all = await loadAllKeys();
  return all.openrouter ?? null;
}

export async function storeKey(providerKey: string, value: string): Promise<void> {
  const dir = configDir();
  await mkdir(dir, { recursive: true });
  const file = join(dir, "keys.json");
  const map = await readKeysMap();
  map[providerKey] = value;
  // Keys are encrypted at rest (DPAPI on Windows / AES-GCM elsewhere).
  const enc = await encryptSecrets(JSON.stringify(map, null, 2));
  await writeFile(file, enc, { encoding: "utf8" });
  if (process.platform !== "win32") await chmod(file, 0o600).catch(() => {});
}

export async function resolveApiKey(opts?: { allowInteractive?: boolean; label?: string }): Promise<string> {
  const env = process.env.OPENROUTER_API_KEY;
  if (env && env.length > 8) return env;
  const stored = await loadStoredKey();
  if (stored && stored.length > 8) return stored;
  if (opts?.allowInteractive) {
    const res = await interactiveSignIn({ label: opts.label ?? `NoiraCoder (${appInfo.title})` });
    if (res.key) { await storeKey("openrouter", res.key); return res.key; }
  }
  throw new Error(`[error] No hay API key.\n> 1) noira login\n> 2) OPENROUTER_API_KEY`);
}

export async function resolvePoolKeys(opts?: { allowInteractive?: boolean }): Promise<Record<string, string | undefined>> {
  const all = await loadAllKeys();
  if (Object.values(all).some((v) => v && v.length > 8)) return all;
  if (opts?.allowInteractive) {
    const key = await resolveApiKey({ allowInteractive: true });
    return { openrouter: key };
  }
  throw new Error(`[error] Sin providers. Ejecuta: noira login`);
}

/**
 * /logout: physically deletes the stored keys file so the local session AND
 * the persisted credentials are gone (nothing survives a restart).
 */
export async function removeStoredKeys(): Promise<{ deleted: boolean; file: string }> {
  const { rm } = await import("node:fs/promises");
  const file = join(configDir(), "keys.json");
  let deleted = false;
  try {
    await rm(file, { force: true });
    deleted = true;
  } catch {
    deleted = false;
  }
  return { deleted, file };
}
