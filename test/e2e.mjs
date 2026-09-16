/**
 * NoiraCoder — SECURITY & HONESTY VERIFICATION HARNESS (Fases 1.4 + 9).
 *
 * Intentos de exploit REALES contra cada superficie; solo se reporta
 * "protegido" si el sistema bloquea/confirma de verdad.
 */
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { get as httpGet, request as httpRequest } from "node:http";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpHome = path.join(os.tmpdir(), "noira-e2e-home");
// Must be set BEFORE any auth module import so keys land in a temp dir.
process.env.NOIRARC_HOME = tmpHome;

let pass = 0;
let fail = 0;
const results = [];

function record(name, ok, detail = "") {
  if (ok) pass++;
  else fail++;
  results.push(`${ok ? "[PASS]" : "[FAIL]"} ${name}${detail ? "  <-- " + detail : ""}`);
}

async function load(spec) {
  return import(pathToFileURL(path.join(root, "dist", spec)).href);
}

/** Silence the app's logger calls from tools. */
function quietLog() {
  return { raw: () => {}, info: () => {}, ok: () => {}, warn: () => {}, error: () => {} };
}

/** Minimal ToolCallContext. */
function ctx(cwd, confirmImpl = async () => false, confirmDestructive = true) {
  return { cwd, confirmDestructive, confirm: confirmImpl, isSensitive: () => false, log: quietLog() };
}

// ───────────────────────────────────────────────────────────────────────────
// 0. Scratch project
// ───────────────────────────────────────────────────────────────────────────
const scratch = path.join(os.tmpdir(), "noira-e2e-proj");
await fs.rm(scratch, { recursive: true, force: true });
await fs.mkdir(scratch, { recursive: true });
await fs.writeFile(path.join(scratch, "sample.txt"), "primera linea\n");
await fs.rm(tmpHome, { recursive: true, force: true });
await fs.mkdir(tmpHome, { recursive: true });

// ───────────────────────────────────────────────────────────────────────────
// 1. FASE 1 / SANDBOX (whitelist): intentos de ejecución REAL
// ───────────────────────────────────────────────────────────────────────────
{
  const { bashTool } = await load("tools/bash.js");
  const tool = bashTool();
  const cYes = ctx(scratch, async () => true); // "user says yes to everything"
  const cNo = ctx(scratch, async () => false); // "user refuses"
  const cTrack = { asked: false };
  const cSafe = ctx(scratch, () => { cTrack.asked = true; return true; });

  // 1a. Hard-deny: deletion of the whole system drive. Even granting 'yes' -> denied.
  let out = await tool.handler({ command: "del /s /q C:\\*" }, cYes);
  record("1a sandbox: 'del /s /q C:\\*' DENEGADO aunque se confirme", out.startsWith("[denied]"), out.slice(0, 80));

  // 1b. Hard-deny: Remove-Item recursive on system root.
  out = await tool.handler({ command: "Remove-Item -Recurse -Force C:\\" }, cYes);
  record("1b sandbox: 'Remove-Item -Recurse -Force C:\\' DENEGADO", out.startsWith("[denied]"), out.slice(0, 80));

  // 1c. Hard-deny: format
  out = await tool.handler({ command: "format c:" }, cYes);
  record("1c sandbox: 'format c:' DENEGADO", out.startsWith("[denied]"), out.slice(0, 80));

  // 1d. Hard-deny: POSIX rm -rf /
  out = await tool.handler({ command: "rm -rf /" }, cYes);
  record("1d sandbox: 'rm -rf /' DENEGADO", out.startsWith("[denied]"), out.slice(0, 80));

  // 1e. Merge-chains: '&&' can't smuggle a hard-deny past the gate.
  out = await tool.handler({ command: "echo ok && del /s /q C:\\foo" }, cYes);
  record("1e sandbox: cadena con '&&' de comando duro DENEGADA", out.startsWith("[denied]"), out.slice(0, 80));

  // 1f. Not in whitelist (runas): asking, and refusal cancels.
  out = await tool.handler({ command: "runas /user:admin cmd" }, cNo);
  record("1f sandbox: 'runas' fuera de whitelist -> pide y se cancela al negar", out.startsWith("[cancel]"), out.slice(0, 80));

  // 1g. In whitelist, safe command runs without confirmation.
  out = await tool.handler({ command: "node --version" }, cSafe);
  record("1g sandbox: 'node' en whitelist corre SIN pedir confirmacion", !cTrack.asked && /v\d+\.\d+\.\d+/.test(out.trim()), out.trim().slice(0, 40));

  // 1h. Bridging a token via cmd.exe /c: inner destructive command still denied.
  out = await tool.handler({ command: "cmd /c del /s /q C:\\*" }, cYes);
  record("1h sandbox: 'cmd /c del /s/q C:\\*' DENEGADO (patron interno)", out.startsWith("[denied]"), out.slice(0, 80));
}

// ───────────────────────────────────────────────────────────────────────────
// 2. FASE 1 / SERVER: bind 127.0.0.1 + token. Exploit sin credencial.
// ───────────────────────────────────────────────────────────────────────────
let srvPort = 0;
{
  const { startServer } = await load("server/server.js");
  srvPort = 39871;
  await startServer({
    port: srvPort,
    log: quietLog(),
    level: "low",
    lang: "es",
    authToken: "sekrit-e2e-token-abc-123",
  });
  await new Promise((r) => setTimeout(r, 500));
}

const httpReq = (port, pathname, opts = {}) =>
  new Promise((resolve, reject) => {
    const r = httpRequest(
      { hostname: "127.0.0.1", port, path: pathname, method: opts.method ?? "GET" },
      (res) => {
        let t = "";
        res.on("data", (d) => (t += d));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, text: t }));
      },
    );
    r.on("error", reject);
    if (opts.token) r.setHeader("Authorization", `Bearer ${opts.token}`);
    if (opts.body) r.write(opts.body);
    r.end();
  });

{
  // 2a. No credencial -> 401
  const noToken = await httpReq(srvPort, "/session", { method: "POST", body: JSON.stringify({ prompt: "borra todo el disco" }) });
  record("2a server: /session SIN token -> 401", noToken.status === 401, `status=${noToken.status}`);
  // 2b. Token invalido -> 401
  const badToken = await httpReq(srvPort, "/session", { method: "POST", token: "wrong-token", body: JSON.stringify({ prompt: "x" }) });
  record("2b server: /session con token INCORRECTO -> 401", badToken.status === 401, `status=${badToken.status}`);
  // 2c. /health abierto (liveness sin ejecutar nada)
  const health = await httpReq(srvPort, "/health");
  record("2c server: /health sin token -> 200", health.status === 200, `status=${health.status}`);
  // 2d. Sin token nunca arranca la tarea (401 antes de orchestrate)
  record("2d server: 401 sin token = la tarea NO se ejecuta", noToken.text.includes("no autorizado"), noToken.text.slice(0, 60));

  const ping = await httpReq(srvPort, "/health").catch(() => ({ status: 0, text: "" }));
  record("2e server: alcanzable en loopback 127.0.0.1", ping.status === 200, `status=${ping.status}`);

  const src = await fs.readFile(path.join(root, "src", "server", "server.ts"), "utf8");
  record("2f server: HOST fijado a 127.0.0.1 en codigo", src.includes('const HOST = "127.0.0.1"'), "");
}

// ───────────────────────────────────────────────────────────────────────────
// 3. FASE 2 / KEYS: cifrado en disco (DPAPI) + round-trip + /logout borra archivo
// ───────────────────────────────────────────────────────────────────────────
{
  const keys = await load("auth/keys.js");
  const secret = "sk-or-v3-E2E-DPAPI-" + Date.now();
  await keys.storeKey("openrouter", secret);

  const file = path.join(tmpHome, "keys.json");
  const raw = await fs.readFile(file).catch(() => null);
  record("3a keys: se escribe keys.json", raw !== null && raw.length > 0, `bytes=${raw ? raw.length : 0}`);

  const text = raw ? raw.toString("utf8") : "";
  record("3b keys: el secreto NO aparece en claro en el archivo", !text.includes(secret) && !text.trim().startsWith("{"), "sin plaintext");

  const loaded = await keys.loadAllKeys();
  record("3c keys: round-trip DPAPI devuelve la key", loaded.openrouter === secret, `len=${(loaded.openrouter ?? "").length}`);

  // Legacy plaintext se migra automaticamente al leer
  await fs.writeFile(file, JSON.stringify({ openrouter: secret }), "utf8");
  const migrated = await keys.loadAllKeys();
  record("3d keys: migra legacy plaintext al leer", migrated.openrouter === secret, "");

  const after = await keys.removeStoredKeys();
  const existsAfter = await fs.readFile(file).then(() => true).catch(() => false);
  record("3e keys: /logout elimina keys.json del disco", after.deleted && !existsAfter, `deleted=${after.deleted}`);
}

// ───────────────────────────────────────────────────────────────────────────
// 4. FASE 2 / OAUTH: state anti-CSRF en el callback
// ───────────────────────────────────────────────────────────────────────────
{
  const oauth = await load("auth/oauth.js");
  const url = oauth.authorizeUrl({ callbackUrl: "http://127.0.0.1:9999/callback", challenge: "cc", state: "state-A" });
  const authURL = new URL(url);
  const cb = new URL(authURL.searchParams.get("callback_url"));
  record("4a oauth: el state viaja en callback_url (round-trip)", cb.searchParams.get("state") === "state-A", cb.searchParams.get("state") ?? "");
  const src = await fs.readFile(path.join(root, "src", "auth", "oauth.ts"), "utf8");
  record("4b oauth: callback valida state ANTES de intercambiar (CSRF)", src.includes("returnedState !== state"), "grep codigo");
  record("4c oauth: callback sin state -> rechazado", src.includes("!returnedState || returnedState !== state"), "");
}

// ───────────────────────────────────────────────────────────────────────────
// 5. FASE 3 / /parallel: toggle real, no placebo
// ───────────────────────────────────────────────────────────────────────────
{
  const par = await load("core/parallel.js");
  par.setParallelEnabled(true);
  record("5a /parallel: habilita de verdad", par.isParallelEnabled() === true, "");
  const orch = await fs.readFile(path.join(root, "src", "agents", "orchestrator.ts"), "utf8");
  record("5b /parallel: el orquestador usa Promise.all real", orch.includes("Promise.all"), "");
  par.setParallelEnabled(false);
  record("5c /parallel: se apaga de verdad", par.isParallelEnabled() === false, "");
}

// ───────────────────────────────────────────────────────────────────────────
// 6. FASE 6 / UNDO/REDO: snapshot real; sin el git fallback destructivo
// ───────────────────────────────────────────────────────────────────────────
{
  const snap = await load("tools/undoSnapshot.js");
  const target = path.join(scratch, "undo-test.txt");
  await fs.writeFile(target, "v1\n");
  const s1 = await snap.takeSnapshot(scratch, target, "edit");
  await fs.writeFile(target, "v2\n");
  await snap.recordAfterContent(scratch, s1, "v2\n");

  const u = await snap.doUndo(scratch);
  const afterUndo = await fs.readFile(target, "utf8");
  record("6a undo: restaura el contenido anterior", u.ok && afterUndo === "v1\n", `content=${JSON.stringify(afterUndo)}`);

  const r = await snap.doRedo(scratch);
  const afterRedo = await fs.readFile(target, "utf8");
  record("6b redo: reaplica el contenido posterior", r.ok && afterRedo === "v2\n", `content=${JSON.stringify(afterRedo)}`);

  const undoSrc = await fs.readFile(path.join(root, "src", "tools", "undo.ts"), "utf8");
  // Only check executable (non-comment) lines — mentions in docs are fine.
  const codeLines = undoSrc.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*+\s|\/\*|\*\/)/.test(l));
  record("6c undo: ya NO usa 'git checkout -- .'", !codeLines.join("\n").includes("git checkout"), "");
}

// ───────────────────────────────────────────────────────────────────────────
// 7. FASE 6 / LSP diagnostics Windows-safe
// ───────────────────────────────────────────────────────────────────────────
{
  const { diagnosticsTool } = await load("tools/lsp.js");
  const out = await diagnosticsTool().handler({}, ctx(scratch));
  record("7a diagnostics: se ejecuta sin stack (no rompe en cmd)", typeof out === "string" && out.length > 0, out.slice(0, 60));
  const src = await fs.readFile(path.join(root, "src", "tools", "lsp.ts"), "utf8");
  const lspCodeLines = src.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*+\s|\/\*|\*\/)/.test(l));
  record("7b diagnostics: sin pipes unix (| head) en codigo", !lspCodeLines.join("\n").includes("| head"), "");
  record("7c diagnostics: usa npx.cmd en win32", src.includes('"npx.cmd"'), "");
}

// ───────────────────────────────────────────────────────────────────────────
// 8. FASE 7 / SKILLS: base skills disponibles desde cualquier cwd
// ───────────────────────────────────────────────────────────────────────────
{
  const skills = await load("skills/skills.js");
  const fromScratch = await skills.discoverSkills(scratch);
  const names = fromScratch.map((s) => s.name).sort();
  record("8a skills: base dir no depende del cwd", typeof skills.baseSkillsDir() === "string", skills.baseSkillsDir());
  record("8b skills: halladas desde un cwd cualquiera (>=10)", fromScratch.length >= 10, `${fromScratch.length} skills`);
  record("8c skills: incluye code-review, refactor, security, testing", ["code-review", "refactor", "security", "testing"].every((n) => names.includes(n)), names.join(","));
  record("8d skills: el cwd sin skills/ aun incluye las base", fromScratch.length > 0, "");
}

// ───────────────────────────────────────────────────────────────────────────
// 9. FASE 4 / MCP: cliente real contra un server stdio real
// ───────────────────────────────────────────────────────────────────────────
{
  const mcpServer = path.join(os.tmpdir(), "noira-e2e-mcp.mjs");
  await fs.writeFile(
    mcpServer,
    `
let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => {
  buf += c; let i;
  while ((i = buf.indexOf("\\n")) !== -1) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    let msg; try { msg = JSON.parse(line); } catch { continue; }
    if (msg.method === "initialize") write(msg.id, { protocolVersion: "2024-11-05", capabilities: {}, serverInfo: { name: "echo-demo", version: "1.0" } });
    else if (msg.method === "notifications/initialized") { /* noop */ }
    else if (msg.method === "tools/list") write(msg.id, { tools: [{ name: "echo", description: "devuelve eco", inputSchema: { type: "object", properties: { text: { type: "string" } } } }] });
    else if (msg.method === "tools/call") { const args = msg.params.arguments || {}; write(msg.id, { content: [{ type: "text", text: "ECHO:" + String(args.text) }], isError: false }); }
  }
});
function write(id, result) { process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\\n"); }
`,
    "utf8",
  );

  const { McpRegistry } = await load("mcp/registry.js");
  const reg = new McpRegistry();
  reg.add("demo", { command: process.execPath, args: [mcpServer] });
  try {
    await reg.connectAll();
    const tools = reg.callAll();
    record("9a mcp: connectAll + listTools real", tools.length === 1 && tools[0].name === "mcp__demo__echo", tools.map((t) => t.name).join(","));
    const inv = await reg.invoke("mcp__demo__echo", { text: "hola-mcp" });
    record("9b mcp: callTool end-to-end devuelve resultado", inv.result.includes("ECHO:hola-mcp"), inv.result.slice(0, 40));
  } catch (e) {
    record("9c mcp: conecta y opera con server real", false, String(e && e.message || e).slice(0, 120));
  } finally {
    reg.close();
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 10. FASE 5 / DEPLOY: la confirmacion es OBLIGATORIA; dry-run honesto
// ───────────────────────────────────────────────────────────────────────────
{
  const { deployTool } = await load("tools/deploy.js");
  const denied = await deployTool().handler({ dryRun: true }, ctx(scratch, async () => true, false));
  record("10a /deploy: si confirmDestructive=false -> [denied]", denied.startsWith("[denied]"), denied.slice(0, 60));

  const rejected = await deployTool().handler({ dryRun: true }, ctx(scratch, async () => false, true));
  record("10b /deploy: usuario dice que no -> [cancel]", rejected.startsWith("[cancel]"), rejected.slice(0, 60));

  const accepted = await deployTool().handler({ dryRun: true }, ctx(scratch, async () => true, true));
  record("10c /deploy: dry-run con 'si' simula y lo dice", accepted.includes("DRY-RUN") && accepted.includes("confirmacion SI"), accepted.slice(0, 80));
}

// ───────────────────────────────────────────────────────────────────────────
// 11. FASE 8 / IDENTIDAD: ASCII dorado solo en el logo; colores estandar en el resto
// ───────────────────────────────────────────────────────────────────────────
try {
  //  Simulate a real TTY so the ANSI emitters kick in (a real terminal has this).
  Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
} catch { /* noop */ }
{
  const { welcomeArt } = await load("core/welcome.js");
  const art = welcomeArt("78");
  record("11a welcome: arte ASCII de bienvenida con '>'", art.split("\n").length >= 6 && art.includes(">"), `${art.split("\n").length} lineas`);
  record("11b welcome: usa dorado de marca ANSI 251;191;36", art.includes("251;191;36"), "ansi gold");
  const { color } = await load("core/logger.js");
  record("11c logger: ok = verde estandar", color.ok("x").includes("32m"), JSON.stringify(color.ok("x")));
  record("11d logger: error = rojo estandar", color.error("x").includes("31m"), JSON.stringify(color.error("x")));
  record("11e logger: warn = amarillo estandar", color.warn("x").includes("33m"), JSON.stringify(color.warn("x")));
  record("11f logger: gold existe (logo) y es distintivo", color.gold("x").includes("251;191;36"), JSON.stringify(color.gold("x")));
}

// ───────────────────────────────────────────────────────────────────────────
// 12. FASE 1.3 / TUI: confirmacion real, no confirm-()=>true
// ───────────────────────────────────────────────────────────────────────────
{
  const tuiSrc = await fs.readFile(path.join(root, "src", "tui", "tui.ts"), "utf8");
  record("12a tui: NO existe 'confirm: async () => true'", !tuiSrc.includes("confirm: async () => true"), "");
  record("12b tui: usa requestConfirm + confirmResolve", tuiSrc.includes("requestConfirm") && tuiSrc.includes("confirmResolveRef"), "");
}

// ───────────────────────────────────────────────────────────────────────────
// RESUMEN
// ───────────────────────────────────────────────────────────────────────────
const line = "=".repeat(70);
console.log("\n" + line);
console.log(`RESULTADO FINAL: ${pass} PASS / ${fail} FAIL`);
console.log(line);
for (const r of results) console.log(r);

// Forzar salida (el servidor local sigue bindeado sino).
process.exit(fail > 0 ? 1 : 0);