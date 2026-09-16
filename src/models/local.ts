/**
 * Local model provider: talks to Ollama (localhost:11434) for offline fallback.
 * Auto-installs Ollama + best model if not present.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";

const execAsync = promisify(exec);

export interface LocalModelInfo {
  id: string;
  name: string;
  size: string;
}

export async function isOnline(): Promise<boolean> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function isOllamaRunning(): Promise<boolean> {
  try {
    const res = await fetch("http://localhost:11434/api/tags", {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function isOllamaInstalled(): Promise<boolean> {
  try {
    await execAsync("ollama --version", { windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

export async function installOllama(): Promise<boolean> {
  try {
    if (process.platform === "win32") {
      await execAsync("winget install Ollama.Ollama --accept-package-agreements --accept-source-agreements", {
        windowsHide: true,
        timeout: 120000,
      });
    } else if (process.platform === "darwin") {
      await execAsync("brew install ollama", { windowsHide: true, timeout: 120000 });
    } else {
      await execAsync("curl -fsSL https://ollama.com/install.sh | sh", {
        windowsHide: true,
        timeout: 120000,
      });
    }
    return true;
  } catch {
    return false;
  }
}

export async function startOllama(): Promise<boolean> {
  try {
    if (process.platform === "win32") {
      exec("start /B ollama serve", { windowsHide: true });
    } else {
      exec("ollama serve &", { windowsHide: true });
    }
    await new Promise((r) => setTimeout(r, 3000));
    return await isOllamaRunning();
  } catch {
    return false;
  }
}

export function getSystemSpecs(): { ramGB: number; cpuCores: number; platform: string } {
  const totalMem = os.totalmem();
  const ramGB = Math.floor(totalMem / (1024 * 1024 * 1024));
  const cpuCores = os.cpus().length;
  return { ramGB, cpuCores, platform: process.platform };
}

export function pickBestModel(specs: { ramGB: number; cpuCores: number }): string {
  if (specs.ramGB >= 16) return "llama3:8b";
  if (specs.ramGB >= 8) return "phi3";
  if (specs.ramGB >= 4) return "gemma2:2b";
  return "tinyllama";
}

export async function listLocalModels(): Promise<LocalModelInfo[]> {
  try {
    const res = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: Array<{ name: string; size: number }> };
    return (data.models ?? []).map((m) => ({
      id: m.name,
      name: m.name,
      size: formatSize(m.size),
    }));
  } catch {
    return [];
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(0)}MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`;
}

export async function pullModel(
  model: string,
  onProgress?: (progress: string) => void,
): Promise<boolean> {
  try {
    const res = await fetch("http://localhost:11434/api/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: model, stream: false }),
      // Descargas de GB: generoso pero acotado (nunca espera infinita).
      signal: AbortSignal.timeout(600_000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { status?: string };
    onProgress?.(data.status ?? "done");
    return true;
  } catch {
    return false;
  }
}

export async function localGenerate(
  model: string,
  prompt: string,
): Promise<string> {
  const res = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`Ollama error (${res.status})`);
  const data = (await res.json()) as { response?: string };
  return data.response ?? "";
}
