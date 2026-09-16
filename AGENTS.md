# Sistema — NoiraCoder

Decide lo que ayude a tareas futuras: convenciones, arquitectura,
decisiones de riesgo, comandos de build/test. Editable a mano.
No es editable por el modelo sin permiso explícito.

## Stack
- Node 20+, TypeScript, Ink TUI / Go TUI (OpenCode clon)

## Comandos
- `npm run build` / `npx tsc --noEmit` / `node smoke.mjs`
- `npx noira` (TUI) / `npx noira "tarea"` / `npx noira login`

## Convenciones
- Estilo NoiraX: negro #000 + amarillo #f9e2af + magenta #D63384
- Prefijos: > [ok] [error] [warn]; voz cálida pro, no seca
- Memoria: AGENTS.md + .noirarc/memory/* + skills/ (SKILL.md)

## Noira — decisiones
## Noira - decisiones

> [Noira 2026-09-10T16:26:18.142Z] Tarea: Crea un archivo llamado hola_noira.txt en el directorio actual cuyo contenido sea exactamente: Hola Noira E2E. Nivel low.

> [Noira 2026-09-10T16:20:33.436Z] Tarea: Crea un archivo llamado hola_noira.txt en el directorio actual cuyo contenido sea exactamente: Hola Noira E2E. Nivel low.

> [Noira 2026-09-10T16:15:06.969Z] Tarea: Usa TUS HERRAMIENTAS (no respondas solo con texto): crea el archivo hola_noira.txt en el directorio actual con contenido. Nivel low.


> [Noira 2026-09-10T16:13:16.046Z] Tarea: Crea un archivo llamado hola_noira.txt en el directorio actual cuyo contenido sea exactamente: Hola Noira E2E. Nivel low.
