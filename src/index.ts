/**
 * NoiraCoder public API (library entry, same API both CLI and server use).
 */

export { orchestrate, type OrchestratorOptions, type RunResult } from "./agents/orchestrator.js";
export { runAgentLoop } from "./agents/agentLoop.js";
export { buildToolRegistry } from "./agents/toolRegistry.js";
export { pipelineFor, AGENTS, type AgentRole } from "./agents/roster.js";
export { OpenRouterClient } from "./models/provider.js";
export { loadCatalog, QuotaTracker } from "./models/catalog.js";
export { buildRolePolicy, buildRouter, shouldAutoCrossCheck } from "./models/router.js";
export { buildSystemPrefix, pruneToolResult, maybeCompact } from "./models/context.js";
export { resolveApiKey, storeKey, loadStoredKey, configDir } from "./auth/keys.js";
export { interactiveSignIn } from "./auth/oauth.js";
export { ProjectMemory } from "./memory/agentsMd.js";
export { LanguageSelector, T, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "./i18n/index.js";
export { McpRegistry } from "./mcp/registry.js";
export { discoverSkills, resolveSkillInstruction, baseSkillsDir } from "./skills/skills.js";
export { sandboxedExec } from "./sandbox/sandbox.js";
export { decide, compilePolicy, DEFAULT_POLICY, isSensitivePath } from "./sandbox/policies.js";
export type { Level, ChatMessage, ToolCall, ToolResult } from "./types.js";
