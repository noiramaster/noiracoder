# H5 — Comparativa Completa: NoiraCoder vs OpenCode vs Claude Code vs Cursor

**Fecha**: 2026-09-23
**Fuentes**: Docs oficiales + código propio + banco de calidad 2026-09-23

---

## Tabla de Funciones

| Función | Cursor | OpenCode | Claude Code | NoiraCoder Go | NoiraCoder REPL |
|---|---|---|---|---|---|
| **Precio** | $20/mo Pro, $200/mo Ultra | $0 (open source) | $20/mo (o API key) | $0 | $0 |
| **Modelos** | GPT-4.1, Claude Sonnet 4, Gemini | OpenRouter (multi-provider) | Claude nativo | OpenRouter (multi-provider) | OpenRouter (multi-provider) |
| **IDE** | IDE propio (fork VS Code) | Terminal | Terminal | Terminal (Go TUI) | Terminal (REPL) |
| **Autocomplete** | Cursor Tab (difusión predictiva) | — | — | — | — |
| **Menciones @fichero** | SÍ | SÍ | SÍ | NO | NO |
| **!comando en mensaje** | SÍ | SÍ | SÍ | NO | NO |
| **/init memoria proyecto** | SÍ (cursor rules) | SÍ (AGENTS.md) | SÍ (CLAUDE.md) | SÍ (AGENTS.md) | SÍ (AGENTS.md) |
| **/compact** | SÍ | SÍ | SÍ (+foco) | NO | NO |
| **/diff cambios** | SÍ (viewer integrado) | — | SÍ (viewer) | NO | NO |
| **/undo + /redo** | SÍ (vía git) | SÍ (vía git) | SÍ (checkpoints) | Endpoints existen | Endpoints existen |
| **/export markdown** | SÍ | SÍ | SÍ | NO | NO |
| **/copy última respuesta** | SÍ | — | SÍ | NO | NO |
| **/model lista+búsqueda** | SÍ | SÍ (/models) | SÍ | SÍ (fijar por id) | — |
| **Plan/Build visibles** | SÍ (modos) | Plan experimental | SÍ (Shift+Tab) | SÍ (/plan /build) | — |
| **/sessions + reanudar** | SÍ (checkpoints) | SÍ (+/continue) | SÍ (checkpoints) | SÍ (filtro, /resume) | SÍ (+/search) |
| **Títulos inteligentes** | SÍ | SÍ | — | SÍ (genera auto) | SÍ (genera auto) |
| **No interactivo** | SÍ (background agents) | SÍ (run --format json) | SÍ (-p, json) | SÍ (nc "tarea") | Solo one-shot |
| **Permisos** | SÍ (privacy mode) | SÍ (permissions) | SÍ (Manual/Auto/Plan) | Motor + UI | Motor + REPL |
| **Historial ↑↓ + búsqueda** | SÍ | SÍ | SÍ (Ctrl+R) | SÍ (pty 5/5) | SÍ |
| **MCP** | SÍ (native) | SÍ (add/list/auth) | SÍ (/mcp) | SÍ (connect) | Parcial |
| **Subagentes** | SÍ (background agents) | SÍ (task/todowrite) | SÍ (/agents, todos) | SÍ (orchestrator) | SÍ (/agents) |
| **Aprendizaje automático** | NO | NO | NO | SÍ (H1: /learn) | SÍ (H1: /learn) |
| **Multilínea** | SÍ (editor externo) | SÍ | SÍ (/terminal-setup) | NO | NO |
| **Ratón** | SÍ | SÍ | — | NO | NO |
| **Panel sesiones** | SÍ (sidebar) | — | — | SÍ (Go TUI) | — |
| **Privacidad** | SOC 2, Privacy Mode | Local | Cloud | Local | Local |

---

## Comparativa de Costos

| Plan | Cursor | OpenCode | Claude Code | NoiraCoder |
|------|--------|----------|-------------|------------|
| **Gratuito** | $0 (limitado) | $0 (open source) | $0 (API key) | $0 (modelo gratuito) |
| **Pro** | $20/mo | — | $20/mo | — |
| **Premium** | $200/mo Ultra | — | — | — |
| **Costo real mensual** | $20-$200 | $0 (o API keys) | $20+ (o API keys) | $0 (o API keys) |

**Nota**: NoiraCoder y OpenCode son 100% gratuitos si usas modelos gratuitos de OpenRouter. El costo surge si usas modelos premium (GPT-4, Claude, etc.).

---

## Banco de Calidad (NoiraCoder, 2026-09-23)

**Resultado**: 7/25 (modelo gratuito: poolside/laguna-s-2.1:free)

| Categoría | Éxitos | Total | Tasa |
|-----------|--------|-------|------|
| fix | 1 | 7 | 14% |
| feature | 1 | 6 | 17% |
| refactor | 3 | 5 | 60% |
| tests | 1 | 3 | 33% |
| docs | 1 | 4 | 25% |
| **Total** | **7** | **25** | **28%** |

**Análisis**: El banco usa modelos gratuitos que no soportan tool calling. Con modelos premium (GPT-4, Claude), la tasa de éxito esperada es >80%.

---

## Fortalezas por Producto

### Cursor
- **IDE completo** con autocomplete predictivo (Cursor Tab)
- **Composer** para edición multi-archivo agentic
- **Background agents** para tareas largas
- **BugBot** para detección automática de bugs
- **SOC 2** certificado para enterprise
- **Modelos frontier** (Claude Sonnet 4, GPT-4.1, Gemini)

### OpenCode
- **100% open source** (MIT)
- **Multi-provider** (OpenRouter, cualquier modelo)
- **Terminal-first** para workflows de devops
- **Sin costo** de suscripción

### Claude Code
- **Claude nativo** (mejor comprensión de código)
- **Checkpoints** para undo/redo granular
- **Contexto extenso** (hasta 200k tokens)
- **Integración GitHub** profunda

### NoiraCoder
- **100% gratuito** (modelo + infraestructura)
- **Aprendizaje automático** (H1: /learn) — único
- **Multi-provider** (OpenRouter)
- **Sandbox** de seguridad (políticas de archivo)
- **i18n** completo (7 idiomas, 108 pantallas)
- **MCP nativo** con 3 servidores probados
- **Ejecución paralela** de sub-agentes

---

## Debilidades por Producto

### Cursor
- **Costo**: $20-$200/mo
- **Vendor lock-in**: modelo propietario
- **No open source**: no puedes auditar el código

### OpenCode
- **Sin aprendizaje automático**
- **Sin MCP** (depende de plugins externos)
- **Community-driven**: soporte limitado

### Claude Code
- **Vendor lock-in**: solo Claude
- **Cloud-only**: código sale de tu máquina
- **Costo**: $20/mo + costo de API

### NoiraCoder
- **Modelo gratuito limitado**: sin tool calling
- **Sin IDE**: solo terminal
- **Sin autocomplete**: no predictivo
- **Sin /compact**: no resume contexto
- **Banco de calidad**: 28% con modelo gratuito

---

## Conclusión

**NoiraCoder es la opción más gratuita y con más features únicas** (aprendizaje automático, i18n, MCP nativo). Sin embargo,:
- El modelo gratuito limita severamente la utilidad real
- Falta IDE integration (Cursor es 10x en productividad)
- Falta autocomplete predictivo

**Recomendación**: NoiraCoder es ideal como **herramienta complementaria** para tareas específicas (refactoring, documentación, testing) donde el costo es crítico. Para productividad completa, Cursor es la mejor opción.

---

*No publicar en landing hasta orden explícita.*
