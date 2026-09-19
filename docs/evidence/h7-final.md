# Evidencia H7 — verificación final (2026-09-19/20)

## 7.1 Suites (código final, Windows)
- `test:e2e` 48/48 · `test:adversarial` 36/36 · `test:i18n` 0 fallos ·
  `test:sanitize` 10/10 · `go test ./internal/thinclient/` OK · `go vet` limpio.
- Producción: 10 claves × 7 idiomas idénticas local==prod (h5prod).

## 7.2 Sesión pty con BINARIO CI (h7pty.cjs) → 9/9
Artefacto: `noira-thin-Windows-x86_64.exe` del run CI 35475389513 (no el
compilado local). Home aislado, env sin *KEY* (Kilo anónimo):
boot, turno con streaming, cambio manual de modelo (/v1/model 200),
muerte de red a mitad de poema → error visible sin cuelgue,
sesiones que sobreviven al reinicio, reboot+resume con historial,
cero huérfanos (verdad kernel: PIDs trackeados + puertos libres).
- Hallazgo: CIM Win32_Process cachea muertos (fantasmas). La verificación
  usa `process.kill(pid,0)` + `Get-NetTCPConnection`, no CIM.
- Hallazgo: parent-watchdog solo con kill() es vulnerable a reutilización
  de PID → ahora verifica línea de comandos (node+noiracoder), intervalo 15 s.

## Decisión de publicación (regla 0.6)
Todo lo verificable aquí pasa. NO se publica todavía porque:
1. `npm publish` exige la security key del usuario (2FA interactivo).
2. Falta la prueba visual del usuario (docs/PRUEBA-VISUAL.md) y macOS/Linux
   solo están compilados en CI, no ejecutados.
Runbook listo en NOIRACODER-PROGRESS.md (2 comandos del usuario + 1 mío).
