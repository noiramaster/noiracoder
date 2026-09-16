/**
 * Agent roster: 1 orchestrator + 4 specialized subagents.
 *
 * Deliberately small. Coordination between many agents destroys context and
 * makes debugging impossible, so Noira keeps exactly five roles.
 */

import type { RolePolicy } from "../models/router.js";

export type AgentRole =
  | "orchestrator"
  | "code"
  | "research"
  | "review"
  | "security";

export interface AgentSpec {
  role: AgentRole;
  name: string;
  /** Short job description injected into the model prompt. */
  description: string;
  /** Which core+ext tool names this agent is allowed to use. */
  allowedTools: string[];
}

export const ORCHESTRATOR: AgentSpec = {
  role: "orchestrator",
  name: "orchestrator",
  description:
    "Recibe el prompt del usuario, decide que sub-agentes y herramientas usar y en que orden, y consolida el resultado. Si la tarea es trivial (crear/leer un archivo, un comando), EJECUTALA TU MISMO invocando las herramientas; no la describas, hazla.",
  allowedTools: ["list", "read", "write", "edit", "bash", "git"],
};

export const CODE_AGENT: AgentSpec = {
  role: "code",
  name: "code",
  description:
    "Edita archivos, ejecuta bash y git. Es el que aplica cambios de codigo. Nunca hace deploy ni push sin confirmacion.",
  allowedTools: ["read", "write", "edit", "list", "bash", "git", "delete_file"],
};

export const RESEARCH_AGENT: AgentSpec = {
  role: "research",
  name: "research",
  description:
    "Busca en web y lee documentacion. Devuelve hallazgos factuales. No edita archivos de codigo.",
  allowedTools: ["list", "read", "bash", "git"],
};

export const REVIEW_AGENT: AgentSpec = {
  role: "review",
  name: "review",
  description:
    "Revisa los cambios propuestos antes de aplicarlos, corre tests y valida. Reporta problemas concretos, no opiniones.",
  allowedTools: ["read", "list", "bash", "git"],
};

export const SECURITY_AGENT: AgentSpec = {
  role: "security",
  name: "security",
  description:
    "Revision obligatoria antes de aplicar cambios en zonas de alto riesgo (definidas por la politica del proyecto: infraestructura, secretos, fondos) o cualquier accion marcada como riesgosa. Busca efectos irreversibles, fuga de credenciales y perdida de datos.",
  allowedTools: ["read", "list", "bash", "git"],
};

export const AGENTS: Record<AgentRole, AgentSpec> = {
  orchestrator: ORCHESTRATOR,
  code: CODE_AGENT,
  research: RESEARCH_AGENT,
  review: REVIEW_AGENT,
  security: SECURITY_AGENT,
};

/** Maps an agent role to the model role-policy key for routing. */
export function roleKey(role: AgentRole): keyof RolePolicy {
  return role;
}

/** Composes a stable per-agent system block (cache-friendly, same per role). */
export function agentSystemPrefix(spec: AgentSpec): string {
  return `# Rol: ${spec.name}\n${spec.description}\n\nUsa solo estas herramientas: ${spec.allowedTools.join(", ")}.\nResponde con el tono Noira (prefijos >, [ok], [error], [warn]). Si una herramienta falla, dilo y continua; no inventes salidas. REGLA DURA: si afirmas que creaste, editaste o ejecutaste algo, DEBES haber invocado la herramienta correspondiente en esta misma respuesta. No afirmes acciones que no ejecutaste.`;
}

/**
 * Returns the pipeline for a given level. Lower levels use fewer steps to
 * save free quota; higher levels add review and cross-checking.
 */
export function pipelineFor(level: "low" | "medium" | "high" | "max" | "offline", sensitive: boolean): AgentRole[] {
  const base: AgentRole[] = ["orchestrator"];
  switch (level) {
    case "low":
      return base;
    case "medium":
      return [...base, "code"];
    case "high":
      return sensitive
        ? [...base, "research", "code", "security", "review"]
        : [...base, "research", "code", "review"];
    case "max":
      return [...base, "research", "code", "security", "review"];
    case "offline":
      return base;
    default:
      return base;
  }
}
