# Evidencia — verificación final pre-0.2.0 (2026-09-20, SIN publicar)

## /v1/status (nuevo tras la adversaria)
- Sin token → 401. Token malo → 401. Con token sin versión → 426.
- Forma exacta `{ok, protocol, clientes, turnoActivo}` — sin rutas, claves
  ni contenido de sesión. Tests en `test/adversarial.mjs` (3 nuevos).
- Documentado en `docs/PROTOCOL.md` (fila de endpoints + uso por el wrapper).

## Baterías (código final en main)
- `test:adversarial` 39/39 · `test:e2e` 48/48 · `test:i18n` 0 fallos ·
  `test:sanitize` OK · `go test thinclient` OK.

## pty con BINARIO CI FRESCO (run 35511945096, no el de desarrollo)
- h1pty 9/9 (`NOIRA_THIN_BIN` al exe CI): boot, streaming, fin, matar
  motor→error, matar pty→sin huérfanos, 409.
- h3small 5/5: boot 40x10, historial Up/Up/Down.

## Runbook 0.2.0 (NO ejecutado)
1. `npm version minor` (0.1.0 → 0.2.0) + push.
2. `git tag noira-go-v0.2.0` + push → CI adjunta 5 binarios + SHA256SUMS
   (release prerelease automático).
3. Usuario: `npm publish --access public` (pide su security key) + output.
4. Yo: install limpio global en temp (verifica hash+boot) y constancia.
5. Nota: Linux/macOS verificados en ARRANQUE (CI 3/3); sesión completa
   solo en Windows. macOS/Linux en sesión = PENDIENTE (sin acceso).
