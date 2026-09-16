/**
 * Plan tool — genera y actualiza plan con marcadores [ ]/[x] estilo OpenCode/Claude.
 * El orquestador lo usa para tareas complejas; el TUI lo renderiza bonito.
 */
import type { ToolDefinition, ToolCallContext } from "./index.js";
import { params } from "./index.js";

let currentPlan: string[] = [];

export function planTool(): ToolDefinition<{ action: string; items?: string }> {
  return {
    name: "plan",
    description: "Gestiona plan de tarea: create/update/complete. Items separados por ';'. Ej: action=create, items='leer repo; diseñar API; implementar; testear'",
    parameters: params({
      action: { type: "string", description: "create | update | complete | show" },
      items: { type: "string", description: "Items separados por ;" },
    }),
    async handler(args) {
      if (args.action === "create" && args.items) {
        currentPlan = args.items.split(";").map((s) => s.trim()).filter(Boolean);
        return formatPlan();
      }
      if (args.action === "update" && args.items) {
        // marca con prefijo x: para completar, ej: "x:leer repo"
        for (const item of args.items.split(";").map((s) => s.trim())) {
          if (item.startsWith("x:")) {
            const target = item.slice(2).trim();
            const idx = currentPlan.findIndex((p) => p.includes(target) || target.includes(p));
            if (idx !== -1) currentPlan[idx] = `x ${currentPlan[idx]}`;
          } else {
            currentPlan.push(item);
          }
        }
        return formatPlan();
      }
      if (args.action === "complete") {
        const done = currentPlan.filter((p) => p.startsWith("x ")).length;
        const total = currentPlan.length;
        return `[ok] plan ${done}/${total} completados\n` + formatPlan();
      }
      return formatPlan();
    },
  };
}

function formatPlan(): string {
  if (currentPlan.length === 0) return "Plan vacío";
  return currentPlan.map((p, i) => {
    const done = p.startsWith("x ");
    const label = done ? p.slice(2) : p;
    return `${done ? "[x]" : "[ ]"} ${i + 1}. ${label}`;
  }).join("\n");
}

export function getPlan(): string[] { return [...currentPlan]; }
export function resetPlan(): void { currentPlan = []; }
