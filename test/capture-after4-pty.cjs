/**
 * Genera capturas REALES de terminal con códigos ANSI.
 * Usa node-pty para spawnear el Go TUI y capturar la salida exacta.
 *
 * Ejecuta: node test/capture-after4-pty.mjs
 */
const pty = require(require('path').join(process.env.TEMP || process.env.TEMPDIR, 'opencode/termrender/node_modules/node-pty'));
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'evidence', 'screens', 'after4');
const HOME = path.join(process.env.TEMP, 'opencode/noira-pty/home-after4');
const GO_BIN = path.join(ROOT, 'bin/noira-thin.exe');
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

  // Clean environment
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

  console.log('=== Captura after4 con pty ===\n');

  // Spawn Go TUI
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
  await sleep(2000); // Let it fully render

  // Capture raw output (with ANSI codes)
  writeANSI('01-boot.txt', out);
  console.log(`  (captured ${out.length} bytes)`);

  // 2. Wait for status bar
  const statusOk = await waitFor(() => /modelo|model/i.test(strip(out)), 10000);
  ok('status-bar-visible', !!statusOk);

  // 3. Capture status area
  writeANSI('02-status.txt', out);

  // 4. Send /help
  console.log('2. Sending /help...');
  p.write('/help\r');
  await sleep(2000);
  const helpOk = await waitFor(() => /\/sessions|\/resume|\/new/.test(strip(out)), 5000);
  ok('help-commands-visible', !!helpOk);
  writeANSI('03-help.txt', out);

  // 5. Send /new (empty session)
  console.log('3. Sending /new...');
  p.write('/new\r');
  await sleep(2000);
  writeANSI('04-empty-session.txt', out);

  // 6. Send /connect github
  console.log('4. Sending /connect github...');
  p.write('/connect github\r');
  await sleep(3000);
  const connectOk = await waitFor(() => /GitHub|github|token|key|enlace|link/i.test(strip(out)), 10000);
  ok('connect-form-visible', !!connectOk);
  writeANSI('05-connect-github.txt', out);

  // 7. Send a fake key
  console.log('5. Sending fake key...');
  p.write('ghp_fake_test_key_1234567890\r');
  await sleep(3000);
  writeANSI('06-connect-result.txt', out);

  // 8. Exit
  console.log('6. Exiting...');
  p.write('/quit\r');
  await sleep(3000);

  try { p.kill(); } catch {}
  await sleep(1000);

  // Summary
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
