/**
 * Tool registry: merges built-in Noira tools with MCP-provided tools, and
 * routes a tool call (name + JSON args) back to the right handler.
 */

import type { ToolDefinition } from "../tools/index.js";
import { fileTools } from "../tools/files.js";
import { bashTool } from "../tools/bash.js";
import { gitTool } from "../tools/git.js";
import { diagnosticsTool } from "../tools/lsp.js";
import { planTool } from "../tools/plan.js";
import { undoTool } from "../tools/undo.js";
import { webFetchTool } from "../tools/web.js";
import { deployTool } from "../tools/deploy.js";
import type { McpRegistry } from "../mcp/registry.js";

export interface ToolRegistry {
  /** JSON schema tool descriptors for the API. */
  descriptors(): Array<{ type: "function"; function: { name: string; description: string; parameters: unknown } }>;
  /** Execute a tool call. Returns a string result. */
  execute(name: string, argsJson: string, ctx: ToolCallCtx): Promise<string>;
}

export interface ToolCallCtx {
  cwd: string;
  confirmDestructive: boolean;
  confirm: (msg: string) => Promise<boolean>;
  isSensitive: (path: string) => boolean;
  log: import("../core/logger.js").Logger;
}

export interface ToolEvent {
  phase: "start" | "end";
  name: string;
  /** Vista previa de args (recortada, sin secretos: el llamador ya filtra). */
  preview: string;
  ms?: number;
  error?: boolean;
}

export function buildToolRegistry(opts: {
  mcp?: McpRegistry;
  stableSystem?: { confirm: (msg: string) => Promise<boolean>; isSensitive: (p: string) => boolean; cwd: string };
  /** HITO 2.1: la pantalla ve qué herramienta corre y cómo termina. */
  onTool?: (ev: ToolEvent) => void;
}): ToolRegistry {
  const builtins = [...fileTools(), bashTool(), gitTool(), diagnosticsTool(), planTool(), undoTool(), webFetchTool(), deployTool()];

  const mcpTools: Array<{ name: string; description: string; parameters: unknown }> = [];
  if (opts.mcp) {
    for (const t of opts.mcp.callAll()) {
      mcpTools.push({
        name: t.name,
        description: t.description ?? `[MCP] ${t.name}`,
        parameters: t.inputSchema ?? {},
      });
    }
  }

  const byName = new Map<string, ToolDefinition<any>>();
  for (const t of builtins) byName.set(t.name, t);

  return {
    descriptors() {
      return [...builtins, ...mcpTools].map((t) => ({
        type: "function" as const,
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
    },
    async execute(name, argsJson, ctx) {
      let args: unknown;
      try {
        args = argsJson ? JSON.parse(argsJson) : {};
      } catch {
        return `[error] JSON de argumentos invalido para ${name}: ${argsJson.slice(0, 200)}`;
      }
      const preview = (argsJson || "{}").replace(/\s+/g, " ").slice(0, 300);
      const t0 = Date.now();
      opts.onTool?.({ phase: "start", name, preview });
      const finish = (out: string) => {
        opts.onTool?.({
          phase: "end",
          name,
          preview: out.replace(/\s+/g, " ").slice(0, 500),
          ms: Date.now() - t0,
          error: out.startsWith("[error]") || out.startsWith("[denied]") || out.startsWith("[cancel]"),
        });
        return out;
      };
      if (byName.has(name)) {
        try {
          return finish(await byName.get(name)!.handler(args, ctx));
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e);
          ctx.log.error(`Herramienta ${name}: ${m}`);
          return finish(`[error] ${name}: ${m}`);
        }
      }
      if (name.startsWith("mcp__") && opts.mcp) {
        try {
          const r = await opts.mcp.invoke(name, (args ?? {}) as Record<string, unknown>);
          return finish(r.result);
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e);
          ctx.log.error(`Herramienta MCP ${name}: ${m}`);
          return finish(`[error] ${name}: ${m}`);
        }
      }
      return finish(`[error] Herramienta desconocida: ${name}`);
    },
  };
}

/** Convenience factory for a default set of confirmation callbacks. */
export function simpleToolCtx(ctx: {
  cwd: string;
  confirmDestructive?: boolean;
  confirm: (msg: string) => Promise<boolean>;
  isSensitive: (p: string) => boolean;
  log: import("../core/logger.js").Logger;
}): ToolCallCtx {
  return {
    cwd: ctx.cwd,
    confirmDestructive: ctx.confirmDestructive ?? true,
    confirm: ctx.confirm,
    isSensitive: ctx.isSensitive,
    log: ctx.log,
  };
}
