# NoiraCoder

Tu senior 24/7, gratis. Harness agencial para el ecosistema Noira: multi-provider real, equipo dinámico de sub-agentes, memoria que aprende.

## Visión (a lo que aspiramos) vs realidad (lo que ya funciona hoy)

**Visión:** igualar o superar a los modelos de referencia actuales — **GPT-6 Astra** (OpenAI, sep-2026) y **Claude Fable 5.1** (Anthropic, sep-2026) — en calidad, velocidad, memoria, características, identidad, experiencia y capacidad de enganche. Esa es la ambición y la dirección del proyecto, no una afirmación de que ya lo hayamos conseguido.

**Realidad hoy:** un harness agencial sobre modelos gratuitos (OpenRouter/Groq/Zen) con equipo dinámico de sub-agentes, memoria de 3 niveles, TUI dual (Go + Ink), streaming real y sandbox con whitelist — verificado con 48 pruebas E2E y tráfico real contra proveedores, no con mocks. La brecha con la visión se cierra por iteración, con evidencia en cada paso.

> La seguridad y los permisos NO son negociables. Las rutas/acciones sensibles se configuran por proyecto via política, no están hardcodeadas.

## Instalación

```bash
curl -fsSL https://noiracoder.noira.sh/install | sh
# o
npm i -g noiracoder
```

## Uso

```bash
noira login   # 1 vez, 1 clic
noira         # abre chat — como claude / opencode
```

Niveles (solo ves `Noira · <nivel>`):

- `low` — rápido, sin verificación. Máxima velocidad, mínimo gasto.
- `medium` — orquestador + code. Equilibrio.
- `high` — equipo dinámico (research→code→review) + review interno.
- `max` — equipo completo + verificación cruzada por defecto.
- `offline` — Ollama local, solo si lo eliges o sin internet (aviso bonito).

## Arquitectura

```
src/
  core/        identidad Noira (cálida pro), logger NoiraX (> [ok] [error] [warn])
  auth/        OAuth PKCE 1-clic + pool multi-provider (OpenRouter/Zen/Groq/HF)
  models/      provider OpenAI-compat, catálogo 1h, cuota por modelo, router por niveles, adaptive ranker, contexto semántico
  models/providers/  pool multi-gateway, validación real de "falsos gratis"
  agents/      orquestador dinámico + 4 sub-agentes (research/code/review/security), agent loop con streaming
  tools/       read/write/edit/delete/list, bash (sandboxed), git
  memory/      jerárquica: AGENTS.md + global + notas con tags + sesiones persistentes
  i18n/        62 idiomas, detección por script, selector con memoria
  mcp/         cliente MCP por stdio + registro multi-servidor
  skills/      10 skills Noira (code-review, testing, refactor, debug, planning, docs, git-flow, security, perf, lang-expert)
  sandbox/     bwrap/seatbelt + políticas + confirmaciones inteligentes
  server/      headless (misma API que el TUI)
  tui/         TUI Ink (`nc` sin args en terminal) + TUI Go (`noira` en terminal, flujo OpenCode con thinking/tools/streaming) + sesiones con búsqueda, paleta Noira (negro #000, dorado #FBBF24, magenta #D63384)
  cli/         entrada terminal (noira)
docs/
  landing/  landing desplegada en https://noiracoder.pages.dev (ver noiracoder-landing/)
```

### Modelos y routing

- **Pool 50+ free** (ver `src/models/freeLimits.ts`): OpenRouter :free + Groq + HF + Zen. Validación real con llamada (detecta falsos gratis tipo Gemini trial). Cache catálogo 1h.
- **OAuth 1 clic** por provider; cada usuario usa sus cuentas, Noira rota. Keys en `~/.noirarc/keys.json` (chmod 600).
- **QuotaTracker** por modelo + **AdaptiveRanker** (scores por rol + cooldowns 6h quota / 5min transient). Fallback automático al siguiente modelo; usuario solo ve `Noira · <nivel>`.
- **Contexto semántico**: prefijos estables (cache hits) + poda de tools + compactación con resumen (no corte a ciegas).

### Agentes — equipo dinámico

Orquestador decide qué sub-agentes invocar según tarea y nivel:

- **orchestrator** — analiza, decide equipo, sintetiza
- **code** — edita archivos, bash, git
- **research** — busca docs, lee repo
- **review** — corre tests, revisa diffs, auto-fix hasta verde
- **security** — APROBADO/RECHAZADO en tareas sensibles

Verificación cruzada solo en riesgo (`high`/`max` + sensible). Resto del tiempo, frugalidad de cuota.

### Memoria

1. **Proyecto** — `AGENTS.md` (compatible Claude/OpenCode), auto-actualizable
2. **Global** — `~/.noirarc/memory/global.md`
3. **Notas** — `~/.noirarc/memory/notes.json` (con tags, relevancia, dedupe 0.85, cap 25/categoría)
4. **Sesiones** — `~/.noirarc/sessions/<dir>/<id>.json` con búsqueda y nombres inteligentes

### TUI

Flujo OpenCode: burbuja usuario → thinking → tools colapsables → streaming → diff → resumen. Sesiones a la izquierda con búsqueda (`/`), `tab` para toggle, `ctrl+o` nivel, `/help` `/clear` `/model`.

Paleta Noira: fondo negro #000, dorado #FBBF24, magenta #D63384, muted #666, JetBrains Mono.

### Skills

10 skills en `skills/` (compatibles SKILL.md): `code-review`, `testing`, `refactor`, `debug`, `planning`, `docs`, `git-flow`, `security`, `perf`, `lang-expert` (por lenguaje).

## Seguridad

Sin auto-registro de cuentas. OAuth explícito por usuario. Keys solo en `~/.noirarc`, nunca en el repo.
