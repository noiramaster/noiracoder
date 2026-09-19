/**
 * Orchestrator: equipo dinámico real.
 * 1) Resuelve keys + catálogo (multi-provider cuando haya más keys)
 * 2) Decide pipeline según nivel + sensibilidad + análisis del orquestador
 * 3) Ejecuta sub-agentes en secuencia (con posible paralelo) pasando contexto
 * 4) Review interno + cross-check selectivo
 */

import type { Level, ChatMessage, ModelInfo } from "../types.js";
import { resolveApiKey, loadAllKeys } from "../auth/keys.js";
import { OpenRouterClient } from "../models/provider.js";
import { loadCatalog, QuotaTracker } from "../models/catalog.js";
import { buildProviderPool, fetchAllModels, fetchMergedCatalog, isChatModel, type ProviderClient, type ProviderId } from "../models/providers/index.js";
import { OPENROUTER_FREE_ACCOUNT_ID, loadNoiraConfig, openRouterSharedLimit } from "../models/accountQuota.js";
import { buildRolePolicy, buildRouter, shouldAutoCrossCheck } from "../models/router.js";
import { AdaptiveRanker } from "../models/adaptive.js";
import { buildSystemPrefix, cacheAwareTask } from "../models/context.js";
import { pipelineFor, roleKey, agentSystemPrefix, AGENTS, type AgentRole } from "./roster.js";
import { buildToolRegistry, type ToolCallCtx } from "./toolRegistry.js";
import { runAgentLoop } from "./agentLoop.js";
import { ProjectMemory } from "../memory/agentsMd.js";
import type { McpRegistry } from "../mcp/registry.js";
import type { Logger } from "../core/logger.js";
import { loadProjectPolicy, isSensitivePath, type SandboxPolicy } from "../sandbox/policies.js";

export interface OrchestratorOptions {
  apiKey?: string;
  allowInteractiveAuth?: boolean;
  level: Level;
  cwd: string;
  log: Logger;
  mcp?: McpRegistry;
  freeOnly?: boolean;
  lang?: string;
  confirm: (msg: string) => Promise<boolean>;
  policy?: SandboxPolicy;
  /** Para TUI streaming: emite tokens del modelo activo. */
  onToken?: (delta: string) => void;
  /** Para TUI: notifica cambio de sub-agente. */
  onAgentStart?: (role: AgentRole) => void;
  /** HITO 1: override manual de modelo (POST /v1/model). Debe existir en el catálogo. */
  model?: string;
  /** HITO 1: rotación visible + cancelación cooperativa. */
  onModelSwitch?: (from: string, to: string, reason: "auth" | "quota" | "routing" | "transient") => void;
  /** HITO 2.1: la pantalla ve herramientas (inicio/fin). */
  onToolEvent?: (ev: { phase: "start" | "end"; name: string; preview: string; ms?: number; error?: boolean }) => void;
  /** HITO 2.2: memoria guardada + cuota visibles en la pantalla. */
  onMemoryEvent?: (ev: { nivel: "sesion" | "proyecto" | "global"; resumen: string }) => void;
  onQuotaEvent?: (q: { usadoPct: number; restante: number; total: number }) => void;
  onModelErrorExt?: (model: string, kind: "transient" | "quota" | "auth") => void;
  signal?: AbortSignal;
}

export interface RunResult {
  output: string;
  steps: number;
  level: Level;
  agentsRun: AgentRole[];
}

export async function orchestrate(
  prompt: string,
  opts: OrchestratorOptions
): Promise<RunResult> {
  if (opts.level === "offline") {
    return await orchestrateOffline(prompt, opts);
  }

  // ── Keys + pool multi-provider REAL ──
  const apiKey = opts.apiKey ?? (await resolveApiKey({ allowInteractive: opts.allowInteractiveAuth }));
  const allKeys = await loadAllKeys();
  // Asegura que la key resuelta está en el pool
  if (apiKey && !allKeys.openrouter) allKeys.openrouter = apiKey;
  const pool = buildProviderPool(allKeys);
  const primaryClient = new OpenRouterClient({ apiKey });
  // Client per provider: chat MUST go through the owner of the model id.
  // (Sending a groq/* id to OpenRouter would 404.)
  const clientsByProvider = new Map<string, ProviderClient>();
  for (const p of pool) if (!clientsByProvider.has(p.id)) clientsByProvider.set(p.id, p);
  if (!clientsByProvider.has("openrouter")) {
    const c = primaryClient;
    clientsByProvider.set("openrouter", {
      id: "openrouter", label: "OpenRouter",
      complete: (o) => c.complete(o),
      completeStreamed: (o) => c.completeStreamed(o),
      listModels: () => c.listModels(),
    });
  }
  const clientFor = (provider: string | undefined): ProviderClient =>
    (provider && clientsByProvider.get(provider)) || clientsByProvider.get("openrouter")!;

  // Catálogo: si hay pool con 2+ providers, agrega modelos de todos; si no, solo OpenRouter
  // providersById recuerda qué providers sirven cada id (mismo modelo en varios).
  const catalog = await loadCatalog({
    fetch: async () => {
      if (pool.length > 1) {
        const merged = await fetchMergedCatalog(pool);
        if (merged.models.length > 0) {
          return {
            models: merged.models,
            providersById: Object.fromEntries(merged.providersById),
            freeByProvider: Object.fromEntries([...merged.freeByProvider].map(([k, v]) => [k, Object.fromEntries(v)])),
          };
        }
      }
      return primaryClient.listModels();
    },
  });
  const modelsById = new Map(catalog.models.map((m) => [m.id, m]));
  const providersById = catalog.providersById;
  const freeByProvider = catalog.freeByProvider;

  // HITO 1: override manual de modelo (POST /v1/model), validado contra catálogo.
  let preferredModel: string | undefined;
  if (opts.model && modelsById.has(opts.model)) {
    preferredModel = opts.model;
  } else if (opts.model) {
    opts.log.warn(`[modelo] '${opts.model}' no está en el catálogo; se ignora y decide el router.`);
  }

  const quota = new QuotaTracker();
  await quota.load();
  const ranker = new AdaptiveRanker();
  await ranker.load();
  const rolePolicy = buildRolePolicy(catalog.models, catalog.free);
  const noiraCfg = await loadNoiraConfig();
  // Shared OpenRouter free bucket: one daily budget for ALL :free models.
  const sharedQuota = {
    accountId: OPENROUTER_FREE_ACCOUNT_ID,
    limit: openRouterSharedLimit(noiraCfg),
    appliesTo: (_modelId: string, info: ModelInfo | undefined) =>
      info?.provider === "openrouter" && info?.free === true,
  };
  const router = buildRouter({
    level: opts.level,
    rolePolicy,
    modelsById,
    quota,
    freeOnly: opts.freeOnly ?? true,
    warn: (msg) => opts.log.warn(msg),
    onQuota: opts.onQuotaEvent,
    adaptive: ranker,
    sharedQuota,
  });
  router.checkCombinedQuota();

  const memory = new ProjectMemory(opts.cwd);
  await memory.ensureFileExists();
  const { compileMemory } = await import("../memory/memory.js");
  const compiled = await compileMemory({ cwd: opts.cwd, prompt });
  const agentsMd = compiled.project;

  const policy = opts.policy ?? (await loadProjectPolicy(opts.cwd));

  const { discoverSkills, resolveSkillInstruction } = await import("../skills/skills.js");
  const skills = await discoverSkills(opts.cwd);
  const skillBodies = resolveSkillInstruction(skills, prompt);

  const sensitive = isSensitivePrompt(prompt, policy) || opts.level === "max" || opts.level === "high";
  const system = buildSystemPrefix({ agentsMd, global: compiled.global, noteLines: compiled.noteLines, skills: skillBodies });

  const registry = buildToolRegistry({
    mcp: opts.mcp,
    onTool: opts.onToolEvent,
  });
  const toolCtx: ToolCallCtx = {
    cwd: opts.cwd,
    confirmDestructive: true,
    confirm: opts.confirm,
    isSensitive: (p) => isSensitivePrompt(prompt, policy) || isSensitivePath(p, policy),
    log: opts.log,
  };

  // ── Pipeline dinámico ──
  let pipeline = pipelineFor(opts.level, sensitive);

  // Para "equipo dinámico": el orquestador puede recortar pipeline si la tarea es trivial
  // (lo decide tras el primer loop; si el orquestador dice "solo yo", no lanzamos resto)
  const tools = registry.descriptors();
  const taskBlock = cacheAwareTask(prompt);

  // Providers con clave muerta (401): se descartan de la sesión y se rota a otro.
  const deadProviders = new Set<string>();
  const providerOf = (model: string): string | undefined => modelsById.get(model)?.provider;
  const markDead = (model: string): void => {
    const p = providerOf(model);
    if (p && !deadProviders.has(p)) {
      deadProviders.add(p);
      // El mismo id puede vivir en otro provider (ej. gpt-oss-120b en OpenRouter
      // y en Groq): reasigna esos modelos al primer provider vivo que los sirva,
      // recalculando también el flag free (gratis en uno, de pago en otro).
      let flipped = 0;
      for (const [id, provs] of providersById) {
        const info = modelsById.get(id);
        if (!info || info.provider !== p) continue;
        const alt = provs.find((q) => q !== p && !deadProviders.has(q) && clientsByProvider.has(q));
        if (alt) {
          info.provider = alt;
          const flags = freeByProvider.get(id);
          if (flags && typeof flags[alt] === "boolean") info.free = flags[alt];
          flipped++;
          rotDbg(`flip ${id}: ${p} -> ${alt} free=${info.free}`);
        }
      }
      opts.log.warn(
        `${p}: clave inválida o revocada (401). Se rota a otro proveedor${flipped ? ` (${flipped} modelos reasignados)` : ""}. Revisa con: noira connect`,
      );
    }
  };
  const freeOnly = opts.freeOnly ?? true;
  const triedModels = new Set<string>();
  const rotDbg = (...a: unknown[]): void => {
    if (process.env.NOIRA_DEBUG_ROTATION) console.error("[rotacion]", ...a);
  };
  /** Siguiente candidato saltando providers muertos y el modelo actual. */
  const nextAlive = (role: "orchestrator" | "code" | "research" | "review" | "security" | "cheap", current: string) => {
    triedModels.add(current);
    for (let i = 0; i < 12; i++) {
      const d = router.decide(role);
      if (!d.model) break;
      if (d.model === current || triedModels.has(d.model)) continue;
      if (d.provider && deadProviders.has(d.provider)) continue;
      triedModels.add(d.model);
      rotDbg(`policy -> ${d.provider}:${d.model}`);
      return { model: d.model, free: d.free, client: clientFor(d.provider) };
    }
    // Fallback: la role policy solo trae los de mayor contexto (un provider puede
    // acapararla). Escanea el catálogo completo buscando otro provider vivo.
    const all = [...modelsById.values()];
    const s1 = all.filter((m) => m.id !== current && !triedModels.has(m.id));
    const s2 = s1.filter((m) => isChatModel(m));
    const s3 = s2.filter((m) => !m.provider || !deadProviders.has(m.provider));
    const pool = s3.filter((m) => !freeOnly || m.free).sort((a, b) => b.context_length - a.context_length);
    const pick = pool[0];
    rotDbg(`scan -> ${pick ? `${pick.provider}:${pick.id}` : "(vacio)"} | muertos=[${[...deadProviders]}] | probados=${triedModels.size} | etapas=${all.length}/${s1.length}/${s2.length}/${s3.length}/${pool.length}`);
    if (!pick) return null;
    triedModels.add(pick.id);
    return { model: pick.id, free: pick.free, client: clientFor(pick.provider) };
  };
  const onErr = (role: "orchestrator" | "code" | "research" | "review" | "security" | "cheap") =>
    (m: string, kind: "transient" | "quota" | "auth") => {
      if (kind === "auth") markDead(m);
      router.recordModelError(m, kind === "auth" ? "transient" : kind);
      opts.onModelErrorExt?.(m, kind);
    };

  // ── Ejecuta orquestador primero ──
  const orchDecision = router.decide("orchestrator");
  const orchSystem: ChatMessage[] = [
    { role: "system", content: agentSystemPrefix(AGENTS.orchestrator) },
    ...system,
  ];

  opts.onAgentStart?.("orchestrator");
  const orchBaseModel = preferredModel ?? orchDecision.model ?? "openrouter/auto";
  const orch = await runAgentLoop({
    client: clientFor(preferredModel ? providerOf(preferredModel) : orchDecision.provider),
    registry,
    toolCtx,
    system: orchSystem,
    seed: [taskBlock.detail],
    model: orchBaseModel,
    free: orchDecision.free,
    apiKey,
    tools,
    onToken: opts.onToken,
    signal: opts.signal,
    onModelSwitch: opts.onModelSwitch,
    nextModel: () => nextAlive("orchestrator", orchBaseModel),
    onModelSuccess: (m) => router.recordSuccess("orchestrator", m),
    onModelError: onErr("orchestrator"),
  });

  // Si la tarea es trivial (pocos steps y sin necesidad de más agentes), corta aquí
  const isTrivial = orch.steps <= 2 && !sensitive && opts.level === "low";
  if (isTrivial || pipeline.length === 1) {
    let output = orch.content;
    if (shouldAutoCrossCheck(opts.level, sensitive) && output.trim()) {
      output = await runCrossCheck(output, prompt, system, clientFor, apiKey, router, opts);
    }
    await rememberAll(prompt, opts, memory);
    return { output, steps: orch.steps, level: opts.level, agentsRun: ["orchestrator"] };
  }

  // ── Ejecuta resto de agentes en secuencia, pasando contexto acumulado ──
  // El contexto es: prompt original + output del orquestador + outputs previos
  let accumulated = orch.content;
  let totalSteps = orch.steps;
  const agentsRun: AgentRole[] = ["orchestrator"];
  const historyForAgents: ChatMessage[] = [
    taskBlock.detail,
    { role: "assistant", content: orch.content },
  ];

  // Para niveles medium+: research y code son los que más valor aportan
  const subAgents = pipeline.filter((r) => r !== "orchestrator");

  interface AgentOutcome { role: AgentRole; content: string; steps: number; }
  const runOne = async (role: AgentRole): Promise<AgentOutcome> => {
    const decision = router.decide(role);
    const model = preferredModel ?? decision.model ?? orchDecision.model ?? "openrouter/auto";
    const spec = AGENTS[role];
    if (!spec) return { role, content: "", steps: 0 };

    const roleInstruction = buildRoleInstruction(role, prompt, accumulated);
    const roleSystem: ChatMessage[] = [
      { role: "system", content: agentSystemPrefix(spec) },
      ...system,
    ];

    opts.onAgentStart?.(role);
    const result = await runAgentLoop({
      client: clientFor(decision.provider),
      registry,
      toolCtx,
      system: roleSystem,
      seed: [...historyForAgents, { role: "user", content: roleInstruction }],
      model,
      free: decision.free,
      apiKey,
      tools: filterToolsForRole(tools, spec.allowedTools),
      onToken: opts.onToken,
      signal: opts.signal,
      onModelSwitch: opts.onModelSwitch,
      nextModel: () => nextAlive(role, model),
      onModelSuccess: (m) => router.recordSuccess(role, m),
      onModelError: onErr(role),
    });
    return { role, content: result.content, steps: result.steps };
  };

  // ── Secuencial por defecto; PARALELO real solo para checks de hoja ──
  const { isParallelEnabled } = await import("../core/parallel.js");
  const parallel = isParallelEnabled();

  // Los checks de hoja (security/review) consumen el MISMO output ya
  // consolidado, así que pueden correr en paralelo sin romper la cadena.
  const sequential = subAgents.filter((r) => r !== "security" && r !== "review");
  const leafChecks = subAgents.filter((r) => r === "security" || r === "review");
  const runLeafParallel = parallel && leafChecks.length >= 2;

  for (const role of sequential) {
    const outcome = await runOne(role);
    totalSteps += outcome.steps;
    agentsRun.push(role);
    if (outcome.content.trim()) {
      accumulated = outcome.content;
      historyForAgents.push({ role: "user", content: buildRoleInstruction(role, prompt, outcome.content) });
      historyForAgents.push({ role: "assistant", content: outcome.content });
    }
  }

  if (runLeafParallel) {
    // REAL parallelism: security + review run concurrently with Promise.all,
    // both analyzing the same consolidated output; verdicts are merged.
    const results = await Promise.all(leafChecks.map((role) => runOne(role)));
    let block = false;
    for (const r of results) {
      totalSteps += r.steps;
      agentsRun.push(r.role);
      if (r.content.trim()) {
        accumulated += `\n\n[${r.role}]\n${r.content}`;
        historyForAgents.push({ role: "assistant", content: r.content });
      }
      if (r.role === "security" && /bloque/i.test(r.content)) block = true;
    }
    opts.log.ok(`[parallel] ${leafChecks.join(" + ")} ejecutados en paralelo.`);
    if (block) opts.log.warn("Security detuvo la entrega final.");
  } else {
    for (const role of leafChecks) {
      const outcome = await runOne(role);
      totalSteps += outcome.steps;
      agentsRun.push(role);
      if (outcome.content.trim()) {
        accumulated += `\n\n[${role}]\n${outcome.content}`;
        historyForAgents.push({ role: "assistant", content: outcome.content });
      }
    }
  }

  let output = accumulated;

  // Cross-check final si aplica y no lo hizo ya security
  if (shouldAutoCrossCheck(opts.level, sensitive) && !agentsRun.includes("security") && output.trim()) {
    output = await runCrossCheck(output, prompt, system, clientFor, apiKey, router, opts);
  }

  await rememberAll(prompt, opts, memory);

  return { output, steps: totalSteps, level: opts.level, agentsRun };
}

function buildRoleInstruction(role: AgentRole, originalPrompt: string, accumulated: string): string {
  switch (role) {
    case "research":
      return `Tarea original: ${originalPrompt}\n\nContexto del orquestador:\n${accumulated.slice(0, 4000)}\n\nTu rol es RESEARCH: busca docs, lee archivos relevantes y devuelve hallazgos factuales. No edites código.`;
    case "code":
      return `Tarea original: ${originalPrompt}\n\nContexto previo:\n${accumulated.slice(0, 6000)}\n\nTu rol es CODE: aplica los cambios de código necesarios. Usa read/write/edit/bash. Al terminar, resume qué tocaste.`;
    case "review":
      return `Tarea original: ${originalPrompt}\n\nSolución propuesta:\n${accumulated.slice(0, 6000)}\n\nTu rol es REVIEW: revisa cambios, corre tests si existen, reporta problemas concretos. Si ves bug, corrígelo.`;
    case "security":
      return `Tarea original: ${originalPrompt}\n\nCambios propuestos:\n${accumulated.slice(0, 6000)}\n\nTu rol es SECURITY: revisa riesgos (secretos, funds, efectos irreversibles). Responde APROBADO o RECHAZADO + motivo. Si es RECHAZADO, explica cómo corregir.`;
    default:
      return `Tarea: ${originalPrompt}\n\nContexto:\n${accumulated.slice(0, 4000)}`;
  }
}

function filterToolsForRole(tools: unknown[], allowed: string[]): unknown[] {
  return (tools as Array<{ function: { name: string } }>).filter((t) => {
    const n = t.function?.name ?? "";
    // MCP tools siempre permitidos (empiezan por mcp__)
    if (n.startsWith("mcp__")) return true;
    return allowed.includes(n);
  });
}

async function runCrossCheck(
  output: string,
  prompt: string,
  system: ChatMessage[],
  clientFor: (provider: string | undefined) => ProviderClient,
  apiKey: string,
  router: ReturnType<typeof buildRouter>,
  opts: OrchestratorOptions,
): Promise<string> {
  const decision = router.decide("review");
  const reviewModel = decision.model || "openrouter/auto";
  // Va por el cliente del provider dueño del modelo (si OpenRouter está muerto,
  // el cross-check NO debe morir en silencio con él: usa quien sirva el modelo).
  const client = clientFor(decision.provider);
  const refMsg: ChatMessage[] = [
    { role: "system", content: agentSystemPrefix(AGENTS.security) },
    ...system,
    {
      role: "user",
      content: `Tarea original:\n${prompt}\n\nSolución propuesta por otro modelo:\n${output}\n\nRevisa riesgos (funds, credenciales, efectos irreversibles). Responde SOLO con APROBADO o RECHAZADO y un breve motivo.`,
    },
  ];
  try {
    const ref = await client.complete({ apiKey, model: reviewModel, messages: refMsg, temperature: 0.1 });
    const verdict = ref.content ?? "";
    if (/rechaz|deneg|no aprob/i.test(verdict)) {
      opts.log.error(`Security-reviewer: ${verdict}`);
      return `[warn] Verificación cruzada rechazó la solución.\n${verdict}\n\n---\nSolución pendiente de revisión:\n${output}`;
    }
    opts.log.ok("Verificación cruzada: aprobada.");
    return output;
  } catch {
    return output;
  }
}

async function rememberAll(prompt: string, opts: OrchestratorOptions, memory: ProjectMemory): Promise<void> {
  const { rememberNote, shouldRememberProject } = await import("../memory/memory.js");
  const { dirKey } = await import("../memory/sessions.js");
  const sensitive = isSensitivePrompt(prompt, opts.policy ?? (await loadProjectPolicy(opts.cwd)));
  if (!shouldRememberProject(prompt, opts.level, sensitive)) return;
  await memory.remember(`Tarea: ${prompt.slice(0, 120)}. Nivel ${opts.level}.`);
  opts.onMemoryEvent?.({ nivel: "proyecto", resumen: `nota de proyecto guardada (${dirKey(opts.cwd)})` });
  const tags = [
    `project:${dirKey(opts.cwd)}`,
    ...prompt
      .split(/[^a-z0-9]+/i)
      .map((w) => w.toLowerCase())
      .filter((w) => w.length > 3)
      .slice(0, 8),
  ];
  if (tags.length) {
    await rememberNote({
      category: "decision",
      tags,
      title: prompt.slice(0, 60),
      body: `Completada a nivel ${opts.level}.`,
    });
    opts.onMemoryEvent?.({ nivel: "global", resumen: `decisión archivada (${tags.slice(0, 3).join(", ")})` });
  }
}

function isSensitivePrompt(prompt: string, policy: SandboxPolicy): boolean {
  const generic = /(deploy|git push|delete|borrar archivo|rm -rf|apply|migrate|drop)/i.test(prompt);
  const policyHit = policy.sensitivePaths.some((s) => s.length > 0 && prompt.toLowerCase().includes(s.toLowerCase()));
  return generic || policyHit;
}

async function orchestrateOffline(
  prompt: string,
  opts: OrchestratorOptions
): Promise<RunResult> {
  const { isOllamaInstalled, installOllama, isOllamaRunning, startOllama, getSystemSpecs, pickBestModel, listLocalModels, pullModel, localGenerate } = await import("../models/local.js");

  if (!await isOllamaInstalled()) {
    opts.log.raw("> Installing Ollama (first time only)...");
    const installed = await installOllama();
    if (!installed) {
      return { output: "Error: No se pudo instalar Ollama. Instala manualmente: https://ollama.com", steps: 0, level: opts.level, agentsRun: [] };
    }
  }

  if (!await isOllamaRunning()) {
    opts.log.raw("> Starting Ollama...");
    const started = await startOllama();
    if (!started) {
      return { output: "Error: No se pudo iniciar Ollama.", steps: 0, level: opts.level, agentsRun: [] };
    }
  }

  const existing = await listLocalModels();
  let model = existing.length > 0 ? existing[0].id : null;

  if (!model) {
    const specs = getSystemSpecs();
    model = pickBestModel(specs);
    opts.log.raw(`> Downloading ${model} for your system (${specs.ramGB}GB RAM)...`);
    await pullModel(model, (p) => opts.log.raw(`  ${p}`));
  }

  const output = await localGenerate(model, prompt);
  return { output, steps: 1, level: opts.level, agentsRun: ["orchestrator"] };
}
