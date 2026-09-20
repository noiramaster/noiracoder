# A4 — Aviso de respaldo siempre visible (2026-09-20)

## Mecanismo
El wrapper fija `process.env.NOIRA_NOTICE` en CADA caída a Node (falta
binario, motor que no arranca, Go colgada >10 s, spawn-error, protocolo 426,
muerte <3 s, sin TTY). El aviso viaja por entorno al motor y se pinta donde
no se borra:
- TUI Ink (TTY): caja amarilla con borde bajo la cabecera (`src/tui/tui.ts`,
  prop `notice` desde `cli.ts`).
- `printWelcome` (TTY texto): línea amarilla tras el arte (`welcome.ts`).
- REPL sin TTY (nuevo en esta sesión, `repl.ts`): `[warn] …` en stdout, porque
  ahí no hay welcome ni Ink y el stderr se pierde entre más salida.

## Pruebas (VERIFICADO EJECUTANDO)
- pty sin binario (instalación aislada, `noira-thin.exe` apartado) → A4 6/6:
  cae a Ink (`> noira`, sin `conectado al motor`), la caja
  `Pantalla Go no disponible: falta el binario. Arreglo: npm run build:thin
  (o espera la 0.2.0).` aparece y PERMANECE (2 s después sigue), sale limpio.
  Harness: `Temp\opencode\noira-pty\a4pty.cjs`. Binario restaurado después.
- Sin TTY (`"/quit" | node bin/noiracoder.mjs --go`): stderr del wrapper +
  `[warn] Pantalla Go no disponible: sin terminal interactivo. Sigues en el
  motor Node.` en stdout y el REPL sigue (`> NOIRA v0.1.0`, sesiones, sale).

## Solo por código
- Los otros 5 triggers (motor caído, Go colgada, spawn-error, 426, muerte
  <3 s) usan el mismo pipeline de pintado; no se repitió pty por cada uno
  (el fallback genérico ya tenía 4/4 en la sesión anterior).
