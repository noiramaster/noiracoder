/**
 * Generic credential detection and request system.
 *
 * When an action (git push, npm publish, deploy, API call) fails because
 * a credential is missing, this system:
 *   1. Detects the service and required credential from the error
 *   2. Shows the H10 options form asking for the credential
 *   3. Stores it encrypted in keys.json for future use
 *
 * Services are detected by domain/name patterns. Unknown services get
 * a generic prompt.
 */

import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { join } from "node:path";
import os from "node:os";
import { encryptSecrets, decryptSecrets, looksPlainJson } from "./crypto.js";

// ── Service detection patterns ──

export interface ServiceInfo {
  id: string;
  name: string;
  description: string;
  keyUrl: string;
  /** Pattern to match in error output or command */
  patterns: RegExp[];
  /** The key name to store in keys.json */
  storageKey: string;
  /** Environment variable to try first */
  envVar?: string;
}

export const SERVICE_REGISTRY: ServiceInfo[] = [
  {
    id: "github",
    name: "GitHub",
    description: "Personal Access Token for git push/pull to private repos",
    keyUrl: "https://github.com/settings/tokens",
    patterns: [/github\.com/i, /remote:.*authentication/i, /fatal:.*auth/i, /Permission denied.*github/i],
    storageKey: "github_token",
    envVar: "GITHUB_TOKEN",
  },
  {
    id: "gitlab",
    name: "GitLab",
    description: "Personal Access Token for git push/pull",
    keyUrl: "https://gitlab.com/-/profile/personal_access_tokens",
    patterns: [/gitlab\.com/i, /remote:.*gitlab/i],
    storageKey: "gitlab_token",
    envVar: "GITLAB_TOKEN",
  },
  {
    id: "bitbucket",
    name: "Bitbucket",
    description: "App Password for git operations",
    keyUrl: "https://bitbucket.org/account/settings/app-passwords/",
    patterns: [/bitbucket\.org/i],
    storageKey: "bitbucket_password",
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    description: "API Token for Pages/Workers deploy",
    keyUrl: "https://dash.cloudflare.com/profile/api-tokens",
    patterns: [/cloudflare/i, /CLOUDFLARE/i, /wrangler/i],
    storageKey: "cloudflare_api_token",
    envVar: "CLOUDFLARE_API_TOKEN",
  },
  {
    id: "npm",
    name: "npm",
    description: "Access Token for npm publish",
    keyUrl: "https://www.npmjs.com/settings/tokens",
    patterns: [/npmjs\.com/i, /npm publish/i, /401.*npm/i, /ENEEDAUTH.*npm/i],
    storageKey: "npm_token",
    envVar: "NPM_TOKEN",
  },
  {
    id: "vercel",
    name: "Vercel",
    description: "Token for Vercel deploy",
    keyUrl: "https://vercel.com/account/tokens",
    patterns: [/vercel/i, /VERCEL/i],
    storageKey: "vercel_token",
    envVar: "VERCEL_TOKEN",
  },
  {
    id: "netlify",
    name: "Netlify",
    description: "Personal Access Token for deploy",
    keyUrl: "https://app.netlify.com/user/applications#personal-access-tokens",
    patterns: [/netlify/i],
    storageKey: "netlify_token",
    envVar: "NETLIFY_AUTH_TOKEN",
  },
  {
    id: "docker",
    name: "Docker Hub",
    description: "Access Token for docker push",
    keyUrl: "https://hub.docker.com/settings/security",
    patterns: [/docker\.io/i, /denied.*docker/i, /unauthorized.*docker/i],
    storageKey: "docker_token",
    envVar: "DOCKER_TOKEN",
  },
  {
    id: "pypi",
    name: "PyPI",
    description: "API Token for twine upload",
    keyUrl: "https://pypi.org/manage/account/token/",
    patterns: [/pypi\.org/i, /twine upload/i, /403.*pypi/i],
    storageKey: "pypi_token",
    envVar: "PYPI_TOKEN",
  },
  {
    id: "rubygems",
    name: "RubyGems",
    description: "API Key for gem push",
    keyUrl: "https://rubygems.org/profile/edit",
    patterns: [/rubygems\.org/i, /gem push/i],
    storageKey: "rubygems_key",
    envVar: "GEM_HOST_API_KEY",
  },
  {
    id: "custom",
    name: "Custom Service",
    description: "API Key or Token",
    keyUrl: "",
    patterns: [],
    storageKey: "custom",
  },
];

// ── Credential storage (extends keys.json) ──

const CREDS_FILE = "credentials.json";

async function readCredsMap(): Promise<Record<string, string>> {
  const dir = join(process.env.NOIRARC_HOME ?? os.homedir(), ".noirarc");
  const file = join(dir, CREDS_FILE);
  try {
    const raw = await readFile(file);
    if (looksPlainJson(raw)) {
      return JSON.parse(raw.toString("utf8")) as Record<string, string>;
    }
    const dec = await decryptSecrets(raw);
    return JSON.parse(dec) as Record<string, string>;
  } catch { return {}; }
}

async function writeCredsMap(data: Record<string, string>): Promise<void> {
  const dir = join(process.env.NOIRARC_HOME ?? os.homedir(), ".noirarc");
  await mkdir(dir, { recursive: true });
  const file = join(dir, CREDS_FILE);
  const enc = await encryptSecrets(JSON.stringify(data, null, 2));
  await writeFile(file, enc, { encoding: "utf8" });
  if (process.platform !== "win32") await chmod(file, 0o600).catch(() => {});
}

/** Get a stored credential by service ID. */
export async function getCredential(serviceId: string): Promise<string | null> {
  const creds = await readCredsMap();
  return creds[serviceId] ?? null;
}

/** Store a credential for a service. */
export async function storeCredential(serviceId: string, value: string): Promise<void> {
  const creds = await readCredsMap();
  creds[serviceId] = value;
  await writeCredsMap(creds);
}

/** Validate a credential against the real service API. Returns { ok, error? }. */
export async function validateCredential(serviceId: string, value: string): Promise<{ ok: boolean; error?: string }> {
  try {
    // WW: validador genérico para proveedores de modelos OpenAI-compatibles
    // (lista de modelos con la clave; gratis, sin gastar cuota).
    const validateModelList = async (url: string): Promise<{ ok: boolean; error?: string }> => {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${value}` } });
      if (r.status === 401 || r.status === 403) return { ok: false, error: "Clave inválida (HTTP " + r.status + ")" };
      if (!r.ok) return { ok: false, error: `Error HTTP ${r.status}` };
      try {
        const j = await r.json() as any;
        const data = Array.isArray(j) ? j : j?.data;
        if (Array.isArray(data) && data.length === 0) return { ok: false, error: "Sin modelos" };
        return { ok: true };
      } catch {
        return { ok: false, error: "Respuesta no válida" };
      }
    };
    switch (serviceId) {
      case "openrouter": {
        // Endpoint oficial de info de clave (gratis, no gasta).
        const r = await fetch("https://openrouter.ai/api/v1/auth/key", {
          headers: { Authorization: `Bearer ${value}` },
        });
        if (r.ok) return { ok: true };
        if (r.status === 401 || r.status === 403) return { ok: false, error: "Clave inválida (HTTP " + r.status + ")" };
        return { ok: false, error: `Error HTTP ${r.status}` };
      }
      case "groq":
        return validateModelList("https://api.groq.com/openai/v1/models");
      case "zen": {
        const { loadAllKeys } = await import("./keys.js");
        const keys = await loadAllKeys();
        const base = (keys.zenBaseUrl || "https://api.zen.ai/v1").replace(/\/+$/, "");
        return validateModelList(`${base}/models`);
      }
      case "nvidia": {
        // /v1/models es PÚBLICO (200 sin clave): no valida nada. Se usa un
        // chat mínimo (max_tokens:1) contra un modelo vivo de la lista
        // pública — 401/403 = clave mala; 429 = clave OK pero con límite.
        try {
          const lm = await fetch("https://integrate.api.nvidia.com/v1/models");
          const lj = await lm.json() as any;
          const ids = Array.isArray(lj?.data) ? lj.data.map((m: any) => String(m?.id || "")) : [];
          const model = ids.find((id: string) => id && !/embed|guard|safety|rerank|translate|code\b/i.test(id)) || ids[0];
          if (!model) return { ok: false, error: "Sin modelos" };
          const r = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${value}` },
            body: JSON.stringify({ model, messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
          });
          if (r.status === 401 || r.status === 403) return { ok: false, error: "Clave inválida (HTTP " + r.status + ")" };
          if (r.status === 429) return { ok: true };
          if (r.ok) return { ok: true };
          return { ok: false, error: `Error HTTP ${r.status}` };
        } catch {
          return { ok: false, error: "Sin respuesta de NVIDIA" };
        }
      }
      case "iflow": {
        // iFlow NO tiene /v1/models (404 siempre): se valida con un chat
        // mínimo. OJO: iFlow responde 200 con {"status":"434"} ante clave
        // mala, así que hay que mirar el cuerpo, no solo el HTTP.
        try {
          const r = await fetch("https://apis.iflow.cn/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${value}` },
            body: JSON.stringify({ model: "Qwen3-Coder", messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
          });
          const text = await r.text();
          if (r.status === 401 || r.status === 403 || /"status"\s*:\s*"?434"?|invalid\s*apikey|incorrect|expired/i.test(text)) {
            return { ok: false, error: "Clave inválida (revísala en https://iflow.cn/)" };
          }
          if (r.status === 429) return { ok: true };
          if (r.ok) return { ok: true };
          return { ok: false, error: `Error HTTP ${r.status}` };
        } catch {
          return { ok: false, error: "Sin respuesta de iFlow" };
        }
      }
      case "zai":
        return validateModelList("https://api.z.ai/api/paas/v4/models");
      case "github_token": {
        const r = await fetch("https://api.github.com/user", {
          headers: { Authorization: `Bearer ${value}`, "User-Agent": "NoiraCoder/0.1" },
        });
        if (r.ok) return { ok: true };
        if (r.status === 401) return { ok: false, error: "Token inválido (HTTP 401)" };
        return { ok: false, error: `Error HTTP ${r.status}` };
      }
      case "gitlab_token": {
        const r = await fetch("https://gitlab.com/api/v4/user", {
          headers: { Authorization: `Bearer ${value}` },
        });
        if (r.ok) return { ok: true };
        if (r.status === 401) return { ok: false, error: "Token inválido (HTTP 401)" };
        return { ok: false, error: `Error HTTP ${r.status}` };
      }
      case "cloudflare_api_token": {
        const r = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
          headers: { Authorization: `Bearer ${value}` },
        });
        const j = await r.json() as any;
        if (j?.success) return { ok: true };
        return { ok: false, error: j?.errors?.[0]?.message ?? "Token inválido" };
      }
      case "npm_token": {
        const r = await fetch("https://registry.npmjs.org/-/whoami", {
          headers: { Authorization: `Bearer ${value}` },
        });
        if (r.ok) return { ok: true };
        return { ok: false, error: "Token inválido" };
      }
      case "vercel_token": {
        const r = await fetch("https://api.vercel.com/v2/user", {
          headers: { Authorization: `Bearer ${value}` },
        });
        if (r.ok) return { ok: true };
        if (r.status === 401) return { ok: false, error: "Token inválido (HTTP 401)" };
        return { ok: false, error: `Error HTTP ${r.status}` };
      }
      case "docker_token": {
        const r = await fetch("https://hub.docker.com/v2/user", {
          headers: { Authorization: `Bearer ${value}` },
        });
        if (r.ok) return { ok: true };
        return { ok: false, error: "Token inválido" };
      }
      case "netlify_token": {
        const r = await fetch("https://api.netlify.com/api/v1/accounts", {
          headers: { Authorization: `Bearer ${value}` },
        });
        if (r.ok) return { ok: true };
        return { ok: false, error: "Token inválido" };
      }
      case "pypi_token": {
        // PyPI tokens start with "pypi-" and can be validated by attempting a dry-run
        if (!value.startsWith("pypi-")) return { ok: false, error: "Token PyPI debe empezar con 'pypi-'" };
        return { ok: true }; // Can't fully validate without upload
      }
      default:
        return { ok: true }; // Unknown service — accept
    }
  } catch (e) {
    return { ok: false, error: `Error de red: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Get all stored credentials (for /connections display). */
export async function getAllCredentials(): Promise<Record<string, string>> {
  return readCredsMap();
}

// ── Service detection from error output ──

/** Detect which service needs a credential from error text. */
export function detectService(errorOutput: string): ServiceInfo | null {
  for (const svc of SERVICE_REGISTRY) {
    if (svc.id === "custom") continue;
    for (const pat of svc.patterns) {
      if (pat.test(errorOutput)) return svc;
    }
  }
  return null;
}

/** Detect service from a command string (before execution). */
export function detectServiceFromCommand(command: string): ServiceInfo | null {
  // git push → detect remote URL
  const gitRemote = command.match(/git\s+(push|pull|clone|fetch)\s+.*?(https?:\/\/[^\s]+)/i);
  if (gitRemote) {
    const url = gitRemote[2];
    for (const svc of SERVICE_REGISTRY) {
      if (svc.id === "custom") continue;
      for (const pat of svc.patterns) {
        if (pat.test(url)) return svc;
      }
    }
  }
  // npm publish
  if (/npm\s+publish/i.test(command)) {
    return SERVICE_REGISTRY.find(s => s.id === "npm") ?? null;
  }
  // wrangler/cloudflare deploy
  if (/wrangler|cloudflare/i.test(command)) {
    return SERVICE_REGISTRY.find(s => s.id === "cloudflare") ?? null;
  }
  // docker push
  if (/docker\s+push/i.test(command)) {
    return SERVICE_REGISTRY.find(s => s.id === "docker") ?? null;
  }
  return null;
}

/** Check if a credential is available for a service. */
export async function hasCredential(serviceId: string): Promise<boolean> {
  const svc = SERVICE_REGISTRY.find(s => s.id === serviceId);
  if (!svc) return false;
  // Check env var first
  if (svc.envVar && process.env[svc.envVar]) return true;
  // Check stored credentials
  const cred = await getCredential(serviceId);
  return !!cred && cred.length > 0;
}

/** Get credential, checking env var first, then stored. */
export async function resolveCredential(serviceId: string): Promise<string | null> {
  const svc = SERVICE_REGISTRY.find(s => s.id === serviceId);
  if (!svc) return null;
  if (svc.envVar && process.env[svc.envVar]) return process.env[svc.envVar] ?? null;
  return getCredential(serviceId);
}

/** Format a service list for the H10 options component. */
export function formatServiceOptions(services: ServiceInfo[]): Array<{ key: string; label: string; recommended?: boolean }> {
  return services.map(s => ({
    key: s.id,
    label: `${s.name} — ${s.description}`,
    recommended: false,
  }));
}
