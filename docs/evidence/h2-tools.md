# Evidencia H2.1 — herramientas y confirmaciones vía motor (2026-09-19)

## Eventos tool_start/tool_end (captura SSE real, `h2tools.cjs`)
Turno "lista los ficheros…":
- `turn.tool_start list :: {"path":""}` → `turn.tool_end list exit=0 :: .gitignore …` → deltas → fin.
Turno "qué hora es":
- 5× `turn.tool_start/end bash` (el modelo probó `date`, `echo $(…)`, powershell;
  salidas de Windows reales) → **`turn.end motivo=done`**.

## Watchdog aprende (hallazgo honesto)
Un turno largo de herramientas disparó `turn.error timeout: 60 s sin eventos`
aunque el motor trabajaba. Fix: `lastToolStartAt` da 10 min de margen desde el
inicio de la herramienta (`thin.ts`). Nunca silencio: el mecanismo avisó.

## Confirmaciones
- Deploy exige `ctx.confirm` (deploy.ts:55-61, sin cambios).
- Plan mode: política `allowCommands: []` + `remoteConfirm` deniega todo con
  evento visible (código en thin.ts; prueba dedicada en H2.5).
- `confirmId` tardías/duplicadas → ignoradas con warn (verificado en H1).

## Saneo en el motor
`sanitizeOut` (OSC/CSI/C0 + corte 2000) aplicado a `turn.tool_end.salida`.
Verificado por inspección de regex (ESC literales U+001B presentes);
corpus adversario completo en H2.4.
