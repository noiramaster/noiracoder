# Comparativa L — NoiraCoder vs OpenCode (2026-09-27)

Mismo set de 10 tareas para los dos agentes, mismos prompts, mismos ficheros
iniciales, mismo criterio AUTOMÁTICO (contenido de ficheros, nunca juicio).
Harness: `test/compare-l.mjs`. Log literal: `comparativa-l-2026-09-27.log`.
JSON: `comparativa-l-1790462977446.json`.

Condiciones literales:
- NoiraCoder: `node dist/cli/cli.js -l low "<prompt>"` (router de modelos free).
- OpenCode 1.18.32: `opencode run --model opencode/big-pickle "<prompt>"`
  (su modelo por defecto devuelve `UnknownError: Unexpected server error`;
  con modelo explícito funciona).
- Claude Code 2.1.214: NO participó — `Not logged in · Please run /login`
  y sin credenciales en el entorno. Pendiente del usuario.

| agente | tarea | tipo | resultado | segundos |
|---|---|---|---|---|
| noira | fix-suma | fix | OK | 12 |
| opencode | fix-suma | fix | OK | 11 |
| noira | fix-nulo | fix | OK | 16 |
| opencode | fix-nulo | fix | OK | 19 |
| noira | fix-typo | fix | OK | 7 |
| opencode | fix-typo | fix | OK | 12 |
| noira | fix-operador | fix | OK | 8 |
| opencode | fix-operador | fix | OK | 14 |
| noira | fix-offbyone | fix | OK | 8 |
| opencode | fix-offbyone | fix | OK | 13 |
| noira | feat-unico | feature | OK | 13 |
| opencode | feat-unico | feature | OK | 17 |
| noira | feat-media | feature | OK | 11 |
| opencode | feat-media | feature | OK | 19 |
| noira | ref-nombre | refactor | OK | 17 |
| opencode | ref-nombre | refactor | OK | 17 |
| noira | fix-par | fix | OK | 13 |
| opencode | fix-par | fix | OK | 24 |
| noira | fix-upper | fix | OK | 11 |
| opencode | fix-upper | fix | OK | 21 |
| noira TOTAL | 10/10 (100%) | — | tiempo medio 12s | |
| opencode TOTAL | 10/10 (100%) | — | tiempo medio 17s | |

Lectura honesta: en 10 tareas triviales (una función, un JSON) ambos resuelven
todo; la diferencia medida es de tiempo medio (12 s vs 17 s), no de capacidad.
Esto NO dice nada sobre tareas difíciles. Para eso, contexto público abajo.

---

## Referencia pública (no comparable directamente)

> AVISO EXPLÍCITO: los números de esta sección vienen de benchmarks
> públicos de Anthropic (SWE-bench Verified, Terminal-bench — cientos de
> tareas reales de GitHub, mucho más difíciles). NO son del mismo set de
> 10 tareas triviales usado arriba para NoiraCoder vs OpenCode, y por tanto
> NO se pueden comparar número contra número (ni 100% contra 72%, ni 12 s
> contra nada). Es solo contexto del nivel de dificultad que manejan los
> benchmarks serios de la industria, para tener perspectiva real y no una
> falsa sensación de estar ya al nivel de Claude Code.

Cifras citadas del anuncio de lanzamiento Claude 4
(fuente primaria: https://www.anthropic.com/news/claude-4, 22-05-2025;
verificadas también en leaderboard SWE-bench Verified y prensa técnica):

- Claude Opus 4: **72,5% SWE-bench Verified** / **43,2% Terminal-bench**
  (con Claude Code como agente; 39,2% con agente genérico).
- Claude Sonnet 4: **72,7% SWE-bench Verified** / **35,5% Terminal-bench**
  (con Claude Code como agente; 33,5% con agente genérico).

Cifras citadas del anuncio de Claude Sonnet 4.5
(fuente primaria: https://www.anthropic.com/research/claude-sonnet-4-5):

- Claude Sonnet 4.5: **77,2% SWE-bench Verified** (200K contexto, media de
  10 intentos, sin cómputo extra) / **82,0% con cómputo paralelo en tiempo
  de prueba** (múltiples intentos en paralelo + selección interna).

Notas metodológicas (de las propias fuentes de Anthropic):
- SWE-bench Verified = 500 problemas reales de GitHub (issues + parches +
  tests); pass@1 con herramientas bash/editor, sin cómputo extra salvo que
  se indique.
- Terminal-bench = tareas agénticas en terminal (scripts, comandos, ficheros).
- Nuestras 10 tareas no pertenecen a ninguno de estos sets: son ejercicios
  de una función o un fichero, resolubles en segundos. Comparar nuestro
  100% con su 72–82% sería un error de categoría.

Estado: documento interno, NO publicado en la landing (requiere aprobación
expresa del usuario).
