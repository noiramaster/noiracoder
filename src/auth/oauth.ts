/**
 * "Sign in with OpenRouter" — OAuth PKCE flow, implemented against the live
 * OpenRouter API. No client registration, no secrets required.
 *
 * Flow (per OpenRouter docs, version 2.x):
 *   1. Redirect the user to https://openrouter.ai/auth with:
 *        callback_url, code_challenge (S256), code_challenge_method, state
 *   2. User authorizes; OpenRouter redirects back to callback_url?code=...&state=...
 *   3. POST /api/v1/auth/keys with { code, code_verifier, code_challenge_method }
 *      -> { key, user_id }.
 *
 * Note: OpenRouter removed the old `POST /auth/keys/code` endpoint (it 404s).
 * The authorization code is minted by OpenRouter during the redirect itself,
 * so we build the auth URL directly instead of pre-creating a code.
 */

import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { exec, spawn } from "node:child_process";
import type { AddressInfo } from "node:net";
import { appInfo } from "../core/appInfo.js";

export interface KeyExchangeResponse {
  key: string;
  user_id: string | null;
}

const AUTH_URL = "https://openrouter.ai/auth";
const API = "https://openrouter.ai/api/v1";

export function base64url(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateCodeVerifier(): string {
  return base64url(randomBytes(32));
}

export function sha256Base64url(input: string): string {
  return base64url(createHash("sha256").update(input).digest());
}

export function computeS256Challenge(verifier: string): string {
  return sha256Base64url(verifier);
}

/**
 * Builds the authorize URL the user's browser is sent to.
 *
 * OpenRouter does NOT reflect a top-level `state` param in the callback. It
 * DOES preserve any query params embedded in `callback_url`, so the `state`
 * is encoded into the callback URL itself to survive the round trip.
 */
export function authorizeUrl(opts: {
  callbackUrl: string;
  challenge: string;
  state: string;
}): string {
  const cb = new URL(opts.callbackUrl);
  cb.searchParams.set("state", opts.state);
  const u = new URL(AUTH_URL);
  u.searchParams.set("callback_url", cb.toString());
  u.searchParams.set("code_challenge", opts.challenge);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("x-title", appInfo.title);
  return u.toString();
}

/** Exchanges an authorization code (returned by the callback) for an API key. */
export async function exchangeCode(opts: {
  code: string;
  verifier: string;
  challengeMethod?: "S256" | "plain";
}): Promise<KeyExchangeResponse> {
  const res = await fetch(`${API}/auth/keys`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "HTTP-Referer": appInfo.referer, "X-Title": appInfo.title },
    body: JSON.stringify({
      code: opts.code,
      code_verifier: opts.verifier,
      code_challenge_method: opts.challengeMethod ?? "S256",
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenRouter /auth/keys failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return (await res.json()) as KeyExchangeResponse;
}

/**
 * Full no-UI interactive flow for a terminal:
 *  - Start a localhost HTTP server as the OAuth callback.
 *  - Open the user's browser to OpenRouter's authorize URL.
 *  - Wait for the callback to return ?code= (matching our state).
 *  - Exchange it for an API key.
 *
 * Falls back to "display the URL path" (paste-mode) if a browser open fails.
 */
export async function interactiveSignIn(opts?: { label?: string; port?: number; timeoutMs?: number }): Promise<KeyExchangeResponse> {
  const port = opts?.port ?? 0;
  const timeoutMs = opts?.timeoutMs ?? 10 * 60 * 1000; // 10 min

  const verifier = generateCodeVerifier();
  const challenge = computeS256Challenge(verifier);
  const state = generateCodeVerifier();

  return new Promise<KeyExchangeResponse>((resolve, reject) => {
    let resolved = false;
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const params = new URLSearchParams(url.search);
      const hashParams = new URLSearchParams((url.hash ?? "").replace(/^#/, ""));
      const code = params.get("code") ?? hashParams.get("code");
      const returnedState = params.get("state") ?? hashParams.get("state");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (code && !resolved) {
        // CSRF protection: the state echoed back must match the one we issued.
        // OpenRouter reflects `state` via the callback_url query param. If it
        // does not match (or is missing), we refuse to exchange the code — the
        // flow could have been initiated by a third party.
        if (!returnedState || returnedState !== state) {
          res.end(`<h3>[error] El estado de autenticacion no coincide (posible CSRF). Cierra esta pestana e intenta /login otra vez.</h3>`);
          server.close();
          reject(new Error("CSRF: el parametro 'state' del callback no coincide con el emitido. Autenticacion abortada."));
          return;
        }
        resolved = true;
        res.end(`<h3>[ok] Autenticado. Cierra esta pestana.</h3>`);
        server.close();
        void exchangeCode({ code, verifier })
          .then((result) => resolve(result))
          .catch((err) => reject(err));
      } else if (!resolved) {
        res.end(`<h3>Esperando autorizacion...</h3>`);
      } else {
        res.end(`<h3>Ya autenticado.</h3>`);
      }
    });

    server.on("error", (err) => reject(err));

    server.listen(port, "127.0.0.1", async () => {
      const addr = server.address() as AddressInfo;
      const callbackUrl = `http://127.0.0.1:${addr.port}/callback`;
      const url = authorizeUrl({ callbackUrl, challenge, state });
      console.log(`[auth] Abriendo navegador...`);
      console.log(`[auth] Si no se abre, copia esta URL:`);
      console.log(`[auth] ${url}`);
      const opened = tryOpen(url);
      if (!opened) {
        server.close();
        reject(
          new Error(
            `No pude abrir el navegador. Abre esta URL en tu navegador:\n\n${url}`
          )
        );
        return;
      }
      setTimeout(() => {
        server.close();
        reject(new Error("Tiempo de espera agotado (10 min)."));
      }, timeoutMs).unref?.();
    });
  });
}

function tryOpen(url: string): boolean {
  try {
    if (process.platform === "darwin") {
      exec(`open "${url}"`, { windowsHide: true }).unref();
      return true;
    }
    if (process.platform === "win32") {
      spawn("cmd.exe", ["/c", "start", "", url.replace(/&/g, "^&")], { windowsHide: true, stdio: "ignore" }).unref();
      return true;
    }
    if (process.platform === "linux") {
      exec(`xdg-open "${url}"`, { windowsHide: true }).unref();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
