# Evidencia H1.4 — pty real (ConPTY via node-pty), 2026-09-19

Harness: `noira-pty/h1pty.cjs` (temp, fuera del repo) + `node bin/noiracoder.mjs --go`
en pty 100x30, cwd aislado `noira-pty/proj`, modelo real (claves del usuario).

## Resultado: 9/9 PASS
- `D-segundo-SSE-409`: segundo GET /v1/events → 409 (un solo cliente).
- `A-pantalla-Go-arranca`: cabecera `> NOIRACODER` en la pantalla.
- `A-turno-lanza-streaming`: tras Enter, estado `pensando… ((router))`.
- `A-turno-termina`: streaming `OK`, barra con `sesión: Responde solo con la
  palabra OK` (session.updated previo a turn.end).
- `A-sin-huerfanos-tras-salir`: Ctrl+C + kill pty → 0 procesos `serve --thin`
  (detección por CIM Win32_Process, wmic ya no existe en Win11).
- `B-motor-muerto-muestra-error`: taskkill al motor a mitad de poema →
  la pantalla muestra `[error motor]` (evErr), sin cuelgue.
- `B-resto-limpio`: 0 restos tras 9 s.
- `C-motor-detectado` + `C-matar-pty-sin-huerfanos`: kill del pty → el motor
  se suicida por parent-watchdog (5 s) → 0 restos tras 10 s.

## Notas honestas
- El log crudo del pty repite frames (redibujado alt-screen): normal, no es bug.
- `401` y `426` ya verificados por HTTP en h1-thin-server.md.
- node-pty 1.1.0 necesitó copiar los prebuilds win32-x64 a build/Release
  y ruta absoluta a node.exe (bare `node` + cwd no raíz falla con ConPTY).
- El turno A usó el orquestador real (level medium) con una llamada real.
