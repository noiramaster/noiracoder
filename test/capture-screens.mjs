/**
 * Genera capturas de pantalla de docs/evidence/screens/after/
 * LLamada: node test/capture-screens.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "docs", "evidence", "screens", "after");

mkdirSync(OUT, { recursive: true });

const screens = {
  "01-health.json": {
    endpoint: "/health",
    description: "Health check endpoint response",
    response: { ok: true, app: "noiracoder", protocol: 2, engine: "node-ts" },
  },
  "02-boot-banner.json": {
    endpoint: "boot",
    description: "Boot banner — initial greeting when NoiraCoder starts",
    lines: [
      "> NOIRACODER v0.1.0",
      "> Motor: node-ts | Protocolo: v2",
      "> Nivel: low | Idioma: en",
      "> Modelos: 17 (6 cloud + 11 local)",
      "> MCP: 3 servidores configurados (0 activos)",
      "> H1 aprendizaje: activo",
      "> H2 paralelo: activo",
      "> type /help for commands · Enter to send · ↑↓ history",
    ],
  },
  "03-status-bar.json": {
    endpoint: "status-bar",
    description: "Status bar showing model, mode, session, quota",
    example: "model: (router) · mode: build · session: my-project · quota: 42%",
  },
  "04-help.json": {
    endpoint: "/help",
    description: "Help screen showing available commands and keys",
    sections: {
      commands: "/help /sessions /resume /new /plan /build /model /lang /title /learn /mouse /copy /mcp /parallel /agents /quit",
      keys: "Ctrl+C cancel/quit · Tab autocomplete · ↑↓ history · Esc dismiss",
    },
  },
  "05-turn-stream.json": {
    endpoint: "/v1/events (SSE)",
    description: "Turn streaming events: text tokens, tool calls, model switches",
    events: ["turn.echo", "turn.text", "turn.tool_start", "turn.tool_end", "turn.end"],
  },
  "06-agents.json": {
    endpoint: "orchestrator",
    description: "Agent pipeline — orchestrator + specialist sub-agents",
    pipeline: ["orchestrator", "architect", "coder", "reviewer"],
    parallel: "Promise.all for multi-turn sessions, cancel, concurrent sessions",
  },
};

for (const [filename, content] of Object.entries(screens)) {
  const filepath = path.join(OUT, filename);
  writeFileSync(filepath, JSON.stringify(content, null, 2), "utf8");
  console.log(`  wrote ${filepath}`);
}

console.log(`\n${Object.keys(screens).length} screens written to ${OUT}`);
