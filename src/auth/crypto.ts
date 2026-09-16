/**
 * Secure key storage.
 *
 * Keys are never stored in plain text:
 *  - On Windows: encrypt with DPAPI (CurrentUser scope) via the .NET
 *    ProtectedData API, so only the logged-in Windows user can decrypt.
 *  - On macOS/Linux: encrypt with AES-256-GCM using a key kept in a
 *    0600-permission file under ~/.noirarc.
 *
 * Files carry a small header so decrypt can detect+skip plain files.
 */

import { randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, chmod } from "node:fs/promises";
import { join } from "node:path";
import os from "node:os";

const execFileP = promisify(execFile);
const HEADER = "NOIRAC::1::"; // magic + version

/** Same config dir resolution as keys.ts, but no import cycle. */
export function secretsConfigDir(): string {
  return process.env.NOIRARC_HOME ?? join(os.homedir(), ".noirarc");
}

async function dpapi(action: "encrypt" | "decrypt", data: Buffer): Promise<Buffer> {
  const b64 = data.toString("base64");
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName 'System.Security.Cryptography.ProtectedData'
$b = [Convert]::FromBase64String('${b64}')
if ('${action}' -eq 'encrypt') {
  $o = [System.Security.Cryptography.ProtectedData]::Protect($b, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
} else {
  $o = [System.Security.Cryptography.ProtectedData]::Unprotect($b, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
}
[Convert]::ToBase64String($o)
`;
  const { stdout } = await execFileP("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
    timeout: 30_000,
  });
  const line = stdout.split(/\r?\n/).map((s) => s.trim()).find((s) => s && !s.startsWith("#"));
  if (!line) throw new Error("DPAPI no devolvio salida util");
  return Buffer.from(line, "base64");
}

/** Key file for the non-Windows fallback (0600 perms). */
function localKeyPath(): string {
  return join(secretsConfigDir(), ".key");
}

async function ensureLocalKey(): Promise<Buffer> {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(secretsConfigDir(), { recursive: true });
  try {
    const key = await readFile(localKeyPath());
    if (key.length === 32) return key;
  } catch { /* fall through to create */ }
  const key = randomBytes(32);
  await writeFile(localKeyPath(), key, { encoding: "utf8" });
  await chmod(localKeyPath(), 0o600).catch(() => {});
  return key;
}

async function aesEncrypt(plain: Buffer): Promise<Buffer> {
  const key = await ensureLocalKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  // header || iv || tag || ciphertext
  return Buffer.concat([Buffer.from(HEADER, "utf8"), iv, tag, enc]);
}

async function aesDecrypt(blob: Buffer): Promise<Buffer> {
  const key = await ensureLocalKey();
  const hdr = Buffer.from(HEADER, "utf8");
  if (!blob.subarray(0, hdr.length).equals(hdr)) {
    throw new Error("cabecera de cifrado ausente (archivo en claro?)");
  }
  const iv = blob.subarray(hdr.length, hdr.length + 12);
  const tag = blob.subarray(hdr.length + 12, hdr.length + 12 + 16);
  const enc = blob.subarray(hdr.length + 12 + 16);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

/** Encrypt a UTF-8 string using the strongest available mechanism. */
export async function encryptSecrets(plain: string): Promise<Buffer> {
  if (process.platform === "win32") {
    try {
      return await dpapi("encrypt", Buffer.from(plain, "utf8"));
    } catch {
      // DPAPI unavailable -> fall back to the AES local-key method.
      return aesEncrypt(Buffer.from(plain, "utf8"));
    }
  }
  return aesEncrypt(Buffer.from(plain, "utf8"));
}

/** Decrypt bytes that were produced by encryptSecrets (throws if tampered). */
export async function decryptSecrets(blob: Buffer): Promise<string> {
  if (process.platform === "win32") {
    try {
      return (await dpapi("decrypt", blob)).toString("utf8");
    } catch {
      // Maybe it was encrypted with the AES fallback (e.g. DPAPI failed then).
      try {
        return (await aesDecrypt(blob)).toString("utf8");
      } catch {
        throw new Error("no se pudo descifrar: token invalido o clave incorrecta");
      }
    }
  }
  return (await aesDecrypt(blob)).toString("utf8");
}

/** Returns true when the given bytes look like cleartext JSON (legacy file). */
export function looksPlainJson(data: Buffer): boolean {
  const t = data.toString("utf8").trimStart();
  return t.startsWith("{") || t.startsWith("[");
}

/** Migrates an existing plaintext keys file to the encrypted format. */
export async function migratePlainToEncrypted(path: string): Promise<boolean> {
  try {
    const raw = await readFile(path);
    if (!looksPlainJson(raw)) return false;
    const enc = await encryptSecrets(raw.toString("utf8"));
    await writeFile(path, enc);
    return true;
  } catch {
    return false;
  }
}

/** Timing-safe string comparison helper for server/auth tokens. */
export function safeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
