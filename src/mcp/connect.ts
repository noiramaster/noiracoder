/**
 * MCP wiring: loads server config from project/user config and builds a
 * connected McpRegistry ready to pass into orchestrate().
 *
 * Config sources (first found wins for a given server name, merged):
 *   - <cwd>/.mcp.json          { mcpServers: { name: { command, args?, cwd? } } }
 *   - <cwd>/.noira/mcp.json    same shape
 *   - ~/.noirarc/mcp.json      same shape (global)
 *
 * A server is optionally disabled via  { "enabled": false }.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import os from "node:os";
import type { McpRegistry, McpServerConfig } from "./registry.js";

export interface McpConfigFile {
  mcpServers?: Record<string, McpServerConfig & { enabled?: boolean }>;
}

async function tryRead(path: string): Promise<McpConfigFile | null> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as McpConfigFile;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function mcpConfigPaths(cwd: string): string[] {
  const home = process.env.NOIRARC_HOME ?? os.homedir();
  return [
    join(cwd, ".mcp.json"),
    join(cwd, ".noira", "mcp.json"),
    join(home, ".noirarc", "mcp.json"),
  ];
}

export async function loadMcpConfig(cwd: string): Promise<Record<string, McpServerConfig>> {
  const merged: Record<string, McpServerConfig> = {};
  for (const path of mcpConfigPaths(cwd)) {
    const file = await tryRead(path);
    if (!file?.mcpServers) continue;
    for (const [name, cfg] of Object.entries(file.mcpServers)) {
      if (cfg.enabled === false) {
        delete merged[name];
        continue;
      }
      merged[name] = { command: cfg.command, args: cfg.args, cwd: cfg.cwd ?? cwd };
    }
  }
  return merged;
}

/** Builds and connects a registry from config. Returns null if none configured. */
export async function connectMcp(cwd: string): Promise<McpRegistry | null> {
  const { McpRegistry } = await import("./registry.js");
  const servers = await loadMcpConfig(cwd);
  const names = Object.keys(servers);
  if (names.length === 0) return null;
  const registry = new McpRegistry();
  let failed = 0;
  for (const name of names) {
    try {
      registry.add(name, servers[name]);
    } catch {
      failed++;
    }
  }
  if (names.length === 0 || names.length === failed) return null;
  try {
    await registry.connectAll();
  } catch {
    // individual server failures are surfaced on tool call; keep registry open
  }
  return registry;
}
