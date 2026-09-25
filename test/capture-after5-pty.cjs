/**
 * Genera capturas REALES de terminal con códigos ANSI.
 * after5/: /connect con clave rechazada + sesión limpia.
 *
 * Ejecuta: node test/capture-after5-pty.cjs
 */
const pty = require(require('path').join(process.env.TEMP || process.env.TEMPDIR, 'opencode/termrender/node_modules/node-pty'));
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'evidence', 'screens', 'after5');
const HOME = path.join(process.env.TEMP, 'opencode/noira-pty/home-after5');
const WRAP = path.join(ROOT, 'bin/noiracoder.mjs');

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(HOME, { recursive: true });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, ms, step = 300) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const v = fn();
    if (v) return v;
    await sleep(step);
  }
  return null;
}

function strip(s) {
  return s.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').replace(/\x1b[()][AB012]/g, '');
}

function writeANSI(filename, content) {
  fs.writeFileSync(path.join(OUT, filename), content, 'utf8');
  console.log(`  ${filename} ✓`);
}

(async () => {
  const results = [];
  const ok = (n, c) => {
    results.push([c ? 'PASS' : 'FAIL', n]);
    console.log(`  ${c ? 'PASS' : 'FAIL'} ${n}`);
  };

  const env = { ...process.env };
  delete env.NOIRA_THIN_BIN;
  delete env.NOIRA_GO_BIN_URL;
  delete env.NOIRA_GO_SHA256;
  delete env.OPENROUTER_API_KEY;
  delete env.GROQ_API_KEY;
  delete env.KILO_API_KEY;
  delete env.ZEN_API_KEY;
  delete env.OPENAI_API_KEY;
  delete env.ANTHROPIC_API_KEY;
  env.NOIRARC_HOME = HOME;

  console.log('=== Captura after5 con pty ===\n');

  const p = pty.spawn(process.execPath, [WRAP, '--go'], {
    cols: 100,
    rows: 30,
    cwd: ROOT,
    env,
  });

  let out = '';
  p.onData(d => { out += d; });
  let exited = null;
  p.onExit(({ exitCode }) => { exited = exitCode; });

  // 1. Wait for boot
  console.log('1. Waiting for boot...');
  const bootOk = await waitFor(() => /NOIRACODER/.test(strip(out)), 30000);
  ok('boot-rendered', !!bootOk);
  await sleep(2000);

  // Capture boot
  writeANSI('01-boot.txt', out);

  // 2. Send /connect
  console.log('2. Sending /connect...');
  p.write('/connect\r');
  await sleep(2000);
  const connectOk = await waitFor(() => /OpenRouter|GitHub|Cloudflare/.test(strip(out)), 5000);
  ok('connect-form-visible', !!connectOk);
  writeANSI('02-connect-form.txt', out);

  // 3. Select GitHub (option 4)
  console.log('3. Selecting GitHub (option 4)...');
  p.write('4\r');
  await sleep(2000);
  const promptOk = await waitFor(() => /API key|clave API|Paste/.test(strip(out)), 5000);
  ok('api-key-prompt', !!promptOk);
  writeANSI('03-api-key-prompt.txt', out);

  // 4. Send a FAKE key that will be rejected
  console.log('4. Sending fake key...');
  p.write('ghp_fake_invalid_key_1234567890\r');
  await sleep(5000);
  const rejectOk = await waitFor(() => /Connection failed|Error de conexión|Échec|inválido|401|fail/i.test(strip(out)), 10000);
  ok('key-rejected', !!rejectOk);
  writeANSI('04-key-rejected.txt', out);

  // 5. Verify session list is clean (no key in sessions)
  console.log('5. Checking session list...');
  p.write('/sessions\r');
  await sleep(2000);
  // Check that "(sin sesiones guardadas)" or "(vacío)" appears — meaning no sessions exist.
  // The key may appear in the input line but NOT as a session row.
  const strippedSessions = strip(out);
  const hasNoSessions = /(sin sesiones|vacío|no sessions)/i.test(strippedSessions);
  const hasKeyAsSession = /ghp_fake.*hace\s|ghp_fake.*\d+.*min/.test(strippedSessions);
  ok('no-key-in-sessions', hasNoSessions && !hasKeyAsSession);
  writeANSI('05-sessions-clean.txt', out);

  // 6. Verify "recomendada" only on top providers
  console.log('6. Checking recomendada labels...');
  const stripped = strip(out);
  // Count occurrences of "(recomendada)"
  const recoCount = (stripped.match(/recomendada/g) || []).length;
  ok('limited-recomendada', recoCount <= 3); // Only OpenRouter, GitHub, Cloudflare
  writeANSI('06-recomendada-check.txt', out);

  // 7. Exit
  console.log('7. Exiting...');
  p.write('/quit\r');
  await sleep(3000);

  try { p.kill(); } catch {}
  await sleep(1000);

  console.log(`\n=== Results: ${results.filter(r => r[0] === 'PASS').length}/${results.length} PASS ===`);
  for (const [status, name] of results) {
    console.log(`  ${status} ${name}`);
  }
  console.log(`\nDone! Files in ${OUT}`);

  const fails = results.filter(r => r[0] === 'FAIL').length;
  process.exit(fails ? 1 : 0);
})().catch(e => {
  console.error('HARNESS-ERROR', e);
  process.exit(3);
});
