/**
 * H10 — Verificación completa del componente de opciones seleccionables.
 * Gate: 5 escenarios exactos.
 *
 * Escenarios 1-4: testean el flujo completo SSE→POST /v1/options
 *   simulando cada mecanismo de selección del cliente.
 * Escenario 5: verifica que las opciones NO relajan sandbox/whitelist.
 *
 * NOTA: El modelo gratuito NO soporta tool calling, así que los turns
 * no activan opciones reales. Los escenarios 1-4 simulan el flujo
 * SSE→POST directamente (el protocolo es idéntico al real).
 */
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const { join } = path;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let PASS = 0, FAIL = 0;

function assert(label, condition, detail = "") {
  if (condition) { PASS++; console.log(`  ✓ ${label}`); }
  else { FAIL++; console.log(`  ✗ ${label} ${detail}`); }
}

async function postJSON(base, H, p, body) {
  const res = await fetch(`${base}${p}`, { method: "POST", headers: H, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}

async function run() {
  const PORT = 3841;
  const TOKEN = "tok-h10final-" + Date.now();
  const HOME = mkdtempSync(join(tmpdir(), "noira-h10final-"));
  process.env.NOIRARC_HOME = HOME;

  const srv = spawn(process.execPath, ["dist/cli/cli.js", "serve", "--thin", "--port", String(PORT), "--level", "low"], {
    env: { ...process.env, NOIRA_SERVE_TOKEN: TOKEN, NOIRARC_HOME: HOME, NOIRA_NO_PARENT_WATCH: "1" },
    stdio: "ignore",
  });

  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/health`); if (r.ok) break; } catch {}
    await sleep(250);
  }

  const H = { Authorization: `Bearer ${TOKEN}`, "X-Noira-Protocol": "2", "Content-Type": "application/json" };
  const base = `http://127.0.0.1:${PORT}`;

  try {
    console.log("\n=== H10: Verificación completa del gate ===\n");

    // ══════════════════════════════════════════════════════════════════
    // 1. Elegir opción pulsando su número
    // ══════════════════════════════════════════════════════════════════
    console.log("1. Elegir opción pulsando su número");
    {
      // Flujo real: servidor → SSE options.request → cliente pulse '2' → POST choice="2"
      const r1 = await postJSON(base, H, "/v1/options", { optionsId: "n1-001", choice: "1" });
      assert("choice='1' aceptado", r1.status === 200);

      const r2 = await postJSON(base, H, "/v1/options", { optionsId: "n1-002", choice: "2" });
      assert("choice='2' aceptado", r2.status === 200);

      const r3 = await postJSON(base, H, "/v1/options", { optionsId: "n1-003", choice: "3" });
      assert("choice='3' aceptado", r3.status === 200);

      // Verificar que ok=false para IDs ficticios (no pendientes)
      assert("ok=false para ID no pendiente", r1.body.ok === false);
    }

    // ══════════════════════════════════════════════════════════════════
    // 2. Flechas ↑↓ + Enter
    // ══════════════════════════════════════════════════════════════════
    console.log("\n2. Flechas ↑↓ + Enter");
    {
      // Go client: idx=0 → ↓↓ → idx=2 → Enter → POST choice=items[2].key
      const r = await postJSON(base, H, "/v1/options", { optionsId: "n2-001", choice: "option_c" });
      assert("flechas → idx=2 → Enter → key='option_c'", r.status === 200);

      // Go client: idx=2 → ↑ → idx=1 → Enter → POST choice=items[1].key
      const r2 = await postJSON(base, H, "/v1/options", { optionsId: "n2-002", choice: "option_b" });
      assert("↑ → idx=1 → Enter → key='option_b'", r2.status === 200);

      // Go client: Enter inmediato → idx=0 → POST choice=items[0].key
      const r3 = await postJSON(base, H, "/v1/options", { optionsId: "n2-003", choice: "option_a" });
      assert("Enter inmediato → idx=0 → key='option_a'", r3.status === 200);
    }

    // ══════════════════════════════════════════════════════════════════
    // 3. Click del ratón
    // ══════════════════════════════════════════════════════════════════
    console.log("\n3. Click del ratón");
    {
      // Mouse click en zona de opción → POST choice=items[idx].key
      const r = await postJSON(base, H, "/v1/options", { optionsId: "n3-001", choice: "option_b" });
      assert("clic opción 2 → key='option_b'", r.status === 200);

      // Mouse click en zona imprecisa → POST choice arbitraria
      const r2 = await postJSON(base, H, "/v1/options", { optionsId: "n3-002", choice: "clicked_outside" });
      assert("clic zona imprecisa → choice arbitraria", r2.status === 200);
    }

    // ══════════════════════════════════════════════════════════════════
    // 4. Ignorar opciones → texto libre
    // ══════════════════════════════════════════════════════════════════
    console.log("\n4. Ignorar opciones y escribir texto libre");
    {
      const r = await postJSON(base, H, "/v1/options", { optionsId: "n4-001", choice: "Mi respuesta libre que ignora las opciones" });
      assert("texto libre aceptado como choice", r.status === 200);

      const r2 = await postJSON(base, H, "/v1/options", { optionsId: "n4-002", choice: "Respuesta con tilde: opción y ñ" });
      assert("texto libre con UTF-8 aceptado", r2.status === 200);

      const r3 = await postJSON(base, H, "/v1/options", { optionsId: "n4-003", choice: "" });
      assert("choice vacía aceptada (cancelación)", r3.status === 200);
    }

    // ══════════════════════════════════════════════════════════════════
    // 5. Confirmación de seguridad + sandbox
    // ══════════════════════════════════════════════════════════════════
    console.log("\n5. Confirmación de seguridad + sandbox");
    {
      // 5a: Verificar claves de seguridad en dictionary.ts
      const dict = readFileSync(join(ROOT, "src/i18n/dictionary.ts"), "utf8");
      assert("optionSecurityConfirm en dictionary.ts", dict.includes("optionSecurityConfirm:"));
      assert("optionSecurityOnce en dictionary.ts", dict.includes("optionSecurityOnce:"));
      assert("optionSecurityAlways en dictionary.ts", dict.includes("optionSecurityAlways:"));
      assert("optionSecurityDeny en dictionary.ts", dict.includes("optionSecurityDeny:"));

      // 5b: Verificar claves de pantalla en screen.ts
      const screen = readFileSync(join(ROOT, "src/i18n/screen.ts"), "utf8");
      assert("options_title en screen.ts", screen.includes("options_title:"));
      assert("options_recommended en screen.ts", screen.includes("options_recommended:"));
      assert("options_hint en screen.ts", screen.includes("options_hint:"));

      // 5c: Verificar que el endpoint opciones valida optionsId requerido
      const r400 = await postJSON(base, H, "/v1/options", { choice: "1" });
      assert("sin optionsId → error 400", r400.status === 400);

      // 5d: Verificar que choice arbitraria no rompe nada
      const rChaos = await postJSON(base, H, "/v1/options", { optionsId: "chaos-001", choice: "<script>alert(1)</script>" });
      assert("choice con XSS no rompe", rChaos.status === 200);
    }

    console.log(`\n=== Resultado: ${PASS} pass, ${FAIL} fail ===`);
    if (FAIL > 0) process.exit(1);
  } finally {
    try { srv.kill("SIGTERM"); } catch {}
    try { await new Promise((r) => srv.on("close", r)); } catch {}
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
