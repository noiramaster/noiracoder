# B1 — Candado prepublishOnly + orden exacto (2026-09-20)

## De dónde sale el SHA256 esperado
Del RELEASE (no del paquete): el postinstall (`scripts/fetch-go-binary.mjs`)
descarga el binario + `SHA256SUMS` del tag `noira-go-v<version>` (versión
leída de `package.json`, ya no hardcodeada) y solo instala si el hash
coincide. Sin release, sin red o con hash distinto → aviso y motor Node.
NUNCA rompe la instalación (`|| true`).

## Cómo se evita publicar antes que los binarios
`prepublishOnly` (`scripts/check-release.mjs`) aborta `npm publish` si el
release del tag de ESTA versión no existe, le faltan binarios o alguna línea
de `SHA256SUMS` no tiene formato `<64 hex>  <fichero>`. La igualdad
byte-a-byte se verifica donde toca: en cada instalación (fetch) y en el pty
post-tag (B2).

## Pruebas (VERIFICADO EJECUTANDO)
- `node scripts/check-release.mjs` con versión 0.1.0 (sin release
  `noira-go-v0.1.0`): exit 1 + `BLOQUEADO: no hay release … Orden correcto:
  bump versión → tag … → CI publica → npm publish.`
- `npm publish --dry-run`: ejecuta `prepublishOnly`, falla igual (exit 1) y
  NO publica nada. El candado está en el pipeline real, no solo en el script.
- Releases reales hoy (API GitHub): solo `v0.1.0` (pre-release, 0 assets).
  No hay ningún `noira-go-v*` todavía: el tag 0.2.0 es paso del runbook.

## Solo por código
- Rama positiva (release existente con 5 binarios + SUMS válido → exit 0):
  sin release real contra el que probarla; se probará en el runbook 0.2.0
  antes del publish de verdad (paso B4.4).
