# M0.e — Comparativa de funciones (2026-09-21, docs oficiales + código propio)

Fuentes: `opencode.ai/docs/{tui,cli,commands}` y `docs.anthropic.com +
support.claude.com + code.claude.com` (cheatsheet 2026-08-07) para ellos;
`internal/thinclient/model.go` + `src/cli/repl.ts` para nosotros (Go 8
comandos, REPL ~16). Estado = enemiesigo.

| Función | OpenCode | Claude Code | NoiraCoder Go | NoiraCoder REPL |
|---|---|---|---|---|
| Menciones `@fichero` + autocomplete | SÍ (fuzzy + `@alias/`) | SÍ | NO | NO |
| `!comando` en el mensaje | SÍ | SÍ | NO | NO |
| `/init` memoria proyecto | SÍ (AGENTS.md) | SÍ (CLAUDE.md) | NO | NO |
| `/compact` (+alias /summarize) | SÍ | SÍ (+foco) | NO | NO |
| `/diff` cambios sesión | — (diffs en UI) | SÍ (viewer) | NO | NO |
| `/undo` + `/redo` (restauran ficheros) | SÍ (vía git) | SÍ (checkpoints/rewind) | NO | Endpoints existen (`/v1/undo|redo`), sin comando visible |
| `/export` markdown | SÍ | SÍ | NO | NO |
| `/copy` última respuesta | — (copy-on-select exp.) | SÍ | NO | NO |
| `/model` lista+búsqueda | SÍ (`/models`) | SÍ | SÍ (fijar por id; lista del motor, sin búsqueda) | — |
| Plan/Build visibles | Plan experimental | SÍ (Shift+Tab, modos) | SÍ (`/plan` `/build`) | — |
| `/sessions` + reanudar + buscar | SÍ (+`/continue`) | checkpoints | SÍ (filtro, `/resume n\|id`, `/new`) | SÍ (+`/search`) |
| Títulos inteligentes | SÍ (trunca prompt) | — | NO (título = 1er mensaje) | NO |
| No interactivo salida limpia | SÍ (`run --format json`, `-c/-s`) | SÍ (`-p`, json/stream-json, `-c/-r`) | NO | Solo one-shot `nc "tarea"` sin `--print/--continue` |
| Permisos (preguntar/aprobar/lectura) | SÍ (permissions/policies) | SÍ (Manual/Auto/Plan) | Motor: confirmar/denegar + lista blanca; UI: diálogo sí/no | Igual (REPL) |
| Multilínea Shift+Enter | SÍ (editor externo) | SÍ (`/terminal-setup`) | NO verificado | NO |
| Historial ↑↓ + búsqueda | SÍ | SÍ (Ctrl+R) | SÍ (pty 5/5) | SÍ |
| Ratón (clic/rueda, on/off) | SÍ (default true) | — | NO | NO |
| Panel sesiones lateral | — (lista `/sessions`) | — | NO | NO |
| MCP | SÍ (add/list/auth) | SÍ (`/mcp`) | Motor SÍ (connect), UI NO gestiona | parcial |
| Subagentes/lista tareas visible | SÍ (task/todowrite) | SÍ (`/agents`, todos) | Motor SÍ (orchestrator), UI NO muestra | `/agents` estado |
| Skills | SÍ | SÍ | 10 skills motor, sin UI | 10 skills motor |
| LSP | SÍ | — | tool lsp existe, sin UI | igual |
| IDE/estadísticas/coste | web/ide/stats/share | VS Code ext, `/cost /usage /context` | NO | NO |
| Temas/keybinds | SÍ | parcial | NO | NO |

## Lo que falta (pasa a M5 por este orden)
1. `@` + autocomplete, `/init`, `/compact`, `/diff`, `/undo|redo` visibles,
   `/export`, `/copy`, `/model` con búsqueda, modos con indicador,
   `--continue` + `--print`, permisos visibles. (M5.1 ya lo pide así.)
2. Panel lateral + ratón = M2 (ya especificado).
3. Títulos inteligentes = M2.8 (ya especificado).
4. Multilínea/pegado/historial-inverso = M3.6 (ya especificado).
5. IDE/stats/coste/share/temas = "siguiente versión" (M5.2) salvo que M5.1
   sobre tiempo.
