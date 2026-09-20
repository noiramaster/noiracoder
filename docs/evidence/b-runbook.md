# Runbook 0.2.0 (2026-09-20) — publicar SIN invertir el orden

## Orden exacto (el candado lo impone, no la memoria)
La versión manda: `package.json` → tag `noira-go-v<version>` → CI
(`release.yml`: compila 5 targets, `gh release create --prerelease`,
sube binarios + `SHA256SUMS` + `NOTICE.txt`) → `npm publish`.
`prepublishOnly` aborta si el release del tag no existe o el SUMS es inválido
(verificado: `npm publish --dry-run` falla hoy, docs/evidence/b1-candado.md).
El SHA256 esperado vive en el `SHA256SUMS` del release, no en el paquete.

## Pasos numerados (quién hace qué)
1. **Usuario**: `npm version minor` (0.1.0 → 0.2.0), `git push origin main`,
   `git push origin v0.2.0`.
2. **Usuario**: `git tag noira-go-v0.2.0`, `git push origin noira-go-v0.2.0`.
   Esperar el CI del tag en verde (5 binarios + SHA256SUMS en el release).
3. **opencode**: descargar los 5 binarios del release; pty `h1pty` 9/9 +
   `h3small` 5/5 contra el binario compilado POR EL TAG
   (`NOIRA_THIN_BIN=<binario del tag>`, nunca uno de un run anterior);
   comparar su SHA256 con el del `SHA256SUMS` del release. Si un exploit
   pasa y no se bloquea en 2 intentos → parada dura, no se publica.
4. **opencode**: `npm pack` + instalar el tarball en prefijo aislado SIN
   override (descarga real del release del tag) → pty: hash verificado +
   pantalla completa. (Simulación ya hecha en A2/docs/evidence/a2-normal.md
   con servidor local como release; repetir contra el release real.)
5. **Usuario**: `npm publish --access public`. Autenticación 2FA con app de
   autenticación o llave de seguridad, NUNCA con el código de recuperación
   (ese se guarda offline y no se usa para publicar).
6. **opencode**: instalación global limpia en temp (hash + boot) y constancia
   en `NOIRACODER-PROGRESS.md`.

## B2/B3 hoy (sin tag: NO se puede ejecutar, regla no-publicar)
- B2 (pty binario del tag + SHA256 vs release): PENDIENTE DEL TAG. Los
  harnesses están listos (`Temp\opencode\noira-pty\h1pty.cjs`, `h3small.cjs`).
  Último dato: pty 9/9 + 5/5 con binario CI del run 35511945096
  (docs/evidence/final-020-prep.md), pero ese binario NO es del tag 0.2.0.
- B3 (tarball contra release del tag): simulado y verificado en A2; la
  repetición contra el release real es el paso 4 de arriba.

## Nota del anuncio (fija)
Linux/macOS verificados en ARRANQUE (CI `verify-thin.yml` 3/3); sesión
completa verificada solo en Windows. Sesión en macOS/Linux = pendiente
(sin acceso a esas máquinas).
