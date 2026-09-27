/**
 * Headless smoke test for NoiraCoder core (no network required).
 */
import { T, LanguageSelector, detectLanguageFromPrompt } from "./dist/i18n/index.js";
import { detectOsLang } from "./dist/i18n/detect.js";
import { buildRolePolicy, buildRouter, crossCheck, shouldAutoCrossCheck } from "./dist/models/router.js";
import { QuotaTracker, classify } from "./dist/models/catalog.js";
import { pruneToolResult, buildSystemPrefix, maybeCompact } from "./dist/models/context.js";
import { compilePolicy, decide, DEFAULT_POLICY } from "./dist/sandbox/policies.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Directorios únicos por ejecución: antes se reusaba %TEMP%/opencode/... fijo
// y un prefs.json ajeno (language=es de otra prueba) rompía "selector default".
const smokeHome = mkdtempSync(join(tmpdir(), "noira-smoke-"));

let pass = 0;
let fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`[ok] ${name}`); }
  else { fail++; console.log(`[FAIL] ${name} ${extra}`); }
}

check("T es-es", T("okWritten", "es") !== "okWritten");
check("T fallback", T("okWritten", "xx-nope") !== "");
check("detect cyrillic", detectLanguageFromPrompt("Какая погода сегодня?") === "ru");
check("detect arabic", detectLanguageFromPrompt("ما هي الخطة؟") === "ar");
check("detect han", detectLanguageFromPrompt("我想写一个程序") === "zh");
check("detect hiragana", detectLanguageFromPrompt("こんにちは世界") === "ja");
const sel = new LanguageSelector(join(smokeHome, "prefs"));
// M1.4: primer arranque sin prefs → idioma del SO (no "en" a la fuerza).
check("selector default = SO", sel.getLanguage() === detectOsLang(), sel.getLanguage());

const mk = (id, ctx, free) =>
  classify({ id, name: id, pricing: { prompt: free ? "0" : "5", completion: free ? "0" : "15" }, context_length: ctx, free });
const models = [mk("free-a", 128000, true), mk("free-b", 100000, true), mk("paid-x", 200000, false)];
const freeModels = models.filter((m) => m.free);
const rolePolicy = buildRolePolicy(models, freeModels);
check("role policy populates", rolePolicy.orchestrator.length > 0);
const quota = new QuotaTracker(join(smokeHome, "quota"));
await quota.load();
const modelsById = new Map(models.map((m) => [m.id, m]));
const router = buildRouter({ level: "medium", rolePolicy, modelsById, quota, freeOnly: true, limits: { "free-a": 50 }, warn: () => {} });
for (let i = 0; i < 100; i++) quota.recordUsage("free-a");
const dec1 = router.decide("orchestrator");
check("router skips exhausted limit", dec1.model !== "free-a", `got ${dec1.model}`);

check("cross-check approve", crossCheck({ action: "x", level: "high", primaryDecision: "y", secondOpinion: "aprobado" }).approved === true);
check("cross-check reject", crossCheck({ action: "x", level: "high", primaryDecision: "y", secondOpinion: "rechazado por riesgo de fondos" }).approved === false);
check("max always crosscheck", shouldAutoCrossCheck("max", false) === true);
check("high sensitive crosscheck", shouldAutoCrossCheck("high", true) === true);
check("high non-sensitive no", shouldAutoCrossCheck("high", false) === false);
check("low no crosscheck", shouldAutoCrossCheck("low", true) === false);

const big = "x".repeat(100000);
const pruned = pruneToolResult({ tool_call_id: "1", content: big });
check("prune truncates", pruned.truncated === true && pruned.content.length < big.length);
check("prune keeps head/tail", pruned.content.includes("... [") && pruned.content.endsWith("xxx"));
const sys = buildSystemPrefix({ agentsMd: "# AGENTS.md", skills: [] });
const manyMsgs = [];
for (let i = 0; i < 30; i++) manyMsgs.push({ role: "user", content: "y".repeat(5000) });
const comp = maybeCompact(manyMsgs, sys, 20000);
check("compact triggers", comp.compacted === true && comp.messages.length < manyMsgs.length);

const rules = compilePolicy(DEFAULT_POLICY);
check("deny rm -rf /", decide("rm -rf /", rules, DEFAULT_POLICY.allowCommands).action === "deny");
check("ask git push", decide("git push origin main", rules, DEFAULT_POLICY.allowCommands).action === "ask");
check("allow echo", decide("echo hello", rules, DEFAULT_POLICY.allowCommands).action === "allow");

const { parseArgs } = await import("./dist/cli/cli.js");
const pa = parseArgs(["-l", "high", "haz algo", "--lang", "fr"]);
check("cli level parse", pa.level === "high");
check("cli lang flag", pa.lang === "fr");

console.log(`\nSMOKE: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
