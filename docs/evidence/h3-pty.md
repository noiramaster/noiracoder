# Evidencia H3 — pty (2026-09-19)

## i18n UI (h3lang.cjs, sin modelo)
- EN: placeholder + hints + /help en inglés. AR: placeholder + hints + /help
  en árabe, sin crashes ni mojibake. Sin huérfanos.

## Pantalla pequeña + historial (h3small.cjs, 40x10 y 100x30)
- 5/5: boot, sin crash en 10 s, Up→anterior, Up→anterior-2, Down→vuelve.
- Hallazgo: a 40x10 el cabezal quedaba fuera → layout responsive
  (entrada a 1 fila si <18 filas). Re-verificado 5/5.

## TTFB (h3ttfb.cjs, modelo real, level low)
- POST /v1/turn (202) → primer `turn.text`: **3729 ms** → `turn.end`.

## Frame legacy (legacyframe.cjs)
- `noira-go.exe` muestra init Noira.md + status con modelo + hints.
  Base de la tabla h3-diff.md.
