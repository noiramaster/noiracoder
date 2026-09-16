/**
 * Web fetch tool — para research real, no simulado.
 */
import type { ToolDefinition, ToolCallContext } from "./index.js";
import { params } from "./index.js";

export function webFetchTool(): ToolDefinition<{ url: string; maxChars?: number }> {
  return {
    name: "web_fetch",
    description: "Trae contenido de una URL (docs, web). Devuelve texto truncado.",
    parameters: params({
      url: { type: "string", description: "URL a traer" },
      maxChars: { type: "number", description: "Máx chars (default 8000)" },
    }),
    async handler(args) {
      const max = args.maxChars ?? 8000;
      try {
        const res = await fetch(args.url, { headers: { "User-Agent": "NoiraCoder/0.1" }, signal: AbortSignal.timeout(8000) });
        if (!res.ok) return `[error] HTTP ${res.status} para ${args.url}`;
        const text = await res.text();
        // strip html tags crudamente si parece html
        const stripped = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        return stripped.slice(0, max) + (stripped.length > max ? "\n(... truncado)" : "");
      } catch (e) {
        return `[error] fetch ${args.url}: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  };
}
