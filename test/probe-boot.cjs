/** Y: arranque en frío + CPU cargada → "Cargando…" y pantalla Go, nunca Ink. */
const path = require("path");
const fs = require("fs");
const os = require("os");
const TMP = process.env.TEMP || process.env.TEMPDIR;
const pty = require(path.join(TMP, "opencode/termrender/node_modules/node-pty"));
const ROOT = path.resolve(__dirname, "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (s) => s.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "").replace(/\x1b[()][AB012]/g, "");
(async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "noira-booty-"));
  // Carga de CPU para simular máquina lenta (4 workers ocupados).
  const burners = [];
  for (let i = 0; i < 4; i++) {
    burners.push(require("child_process").spawn(process.execPath,
      ["-e", "const t=Date.now();while(Date.now()-t<150000){Math.sqrt(Math.random());}"],
      { stdio: "ignore" }));
  }
  const env = { ...process.env, NOIRARC_HOME: home };
  for (const k of Object.keys(env)) if (/^(OPENROUTER|GROQ|KILO|ZEN|OPENAI|ANTHROPIC)_API_KEY$/.test(k)) delete env[k];
  const p = pty.spawn(process.execPath, [path.join(ROOT, "bin/noiracoder.mjs"), "--go"],
    { cols: 100, rows: 34, cwd: ROOT, env });
  let out = "";
  p.onData((d) => { out += d; });
  const t0 = Date.now();
  let go = false, ink = false, loading = false;
  while (Date.now() - t0 < 120000) {
    const s = strip(out);
    if (/Cargando el motor/.test(s)) loading = true;
    if (/NOIRACODER/.test(s) && !/respaldo Ink/.test(s)) { go = true; break; }
    if (/respaldo Ink/.test(s)) { ink = true; break; }
    await sleep(500);
  }
  const secs = Math.round((Date.now() - t0) / 1000);
  console.log(`cargando-anunciado=${loading} go=${go} ink=${ink} segundos=${secs}`);
  fs.writeFileSync(path.join(TMP, "opencode/mn/booty.txt"), out, "utf8");
  console.log(go && !ink ? "BOOT-Y: PASS (Go bajo carga, sin caída a Ink)" : "BOOT-Y: FAIL");
  try { p.kill(); } catch {}
  for (const b of burners) try { b.kill(); } catch {}
  await sleep(1000);
  process.exit(go && !ink ? 0 : 1);
})().catch((e) => { console.error("HARNESS-ERROR", e); process.exit(3); });
