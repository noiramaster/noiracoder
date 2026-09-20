# A2 — Camino NORMAL verificado: tarball + postinstall + pantalla por pty (2026-09-20)

## Procedimiento (sin NOIRA_THIN_BIN en ningún paso)
1. `npm run build` (tsc limpio) + `npm run build:thin` → `bin/noira-thin.exe`
   fresco. SHA256: `b069516f64264018122927782cbb7e65982140b3f7f7ccaa2ebc68f37c7a4d50`.
2. `npm pack` → `noiracoder-0.1.0.tgz` (180 ficheros: dist nuevo, wrapper nuevo,
   `scripts/fetch-go-binary.mjs`).
3. Servidor HTTP local con el binario (= simula el asset del release) +
   `npm install --prefix <aislado> noiracoder-0.1.0.tgz` con
   `NOIRA_GO_BIN_URL` + `NOIRA_GO_SHA256` (mismo mecanismo que el postinstall
   usa contra el release real: descarga + verificación + `bin/`).
4. `node <aislado>/…/bin/noiracoder.mjs --go` por pty (node-pty, 100×30),
   entorno SIN `NOIRA_THIN_BIN`, sin claves, `NOIRARC_HOME` aislado.
   Harness: `Temp\opencode\noira-pty\a2pty.cjs`.

## Resultado: A2 11/11 PASS (VERIFICADO EJECUTANDO)
- Binario presente tras postinstall; cabecera `NOIRACODER`; `connected to the
  engine`; caja de entrada; atajos (`/help`, `Ctrl+C`); estado
  `model: (router) · mode: build · session: —`; motor thin real en marcha;
  sin aviso de respaldo; `/quit` sale 0; sin huérfanos (sonda `process.kill`
  sobre los PIDs `serve --thin` nuevos).
- (La pantalla sale en inglés porque el HOME aislado no tiene `prefs.json`;
  con el HOME real usa su idioma.)

## Cuota en la barra: hallazgo (no bug)
- El primer run dio 10/11: `cuota:` no aparece al arrancar porque `setStatus`
  (`model.go:96`) solo añade el segmento con `quotaPct > 0` (sin dato no se
  inventa — correcto por diseño).
- Verificado con dato por test Go nuevo `internal/thinclient/status_test.go`:
  `go test ./internal/thinclient/` OK (quotaPct 8 → `quota: 8%`/`cuota: 8%`;
  sin dato → modelo/modo/sesión sin segmento). En el pty A5 (turno real) se
  verá el segmento en vivo.

## Postinstall: descarga + hash (logs reales)
- OK: `[noira] NOIRA_GO_BIN_URL: descargando…` → `[noira] hash verificado
  (b069516f6426…)` → `[noira] pantalla Go instalada (…)`; hash del fichero
  instalado idéntico al servido.
- Hash mal: `[noira] sin pantalla Go (hash distinto (quiero 0000…, tengo
  b069…)): se usa el motor Node.` + NO deja binario + exit 0 (nunca rompe).
- Nota npm 11: avisa `install-scripts … not yet covered by allowScripts` pero
  el postinstall SÍ se ejecutó (binario presente y verificado).

## Conclusión A2
NO hay bug bloqueante en el camino normal: el tarball + postinstall deja el
binario verificado y `--go` abre la pantalla completa. La causa de A1 era solo
la copia global obsoleta.
