# Evidencia H3.1 — OpenCode legacy vs Noira thin (2026-09-19)

## Frame legacy (`noira-go.exe`, pty 100x30, sin claves)
- Diálogo init Noira.md (Yes/No), barra `>`, hints `ctrl+? help`,
  estado con modelo (`Qwen Qwq`), zona de entrada multilínea.
- Init dialog = onboarding de proyecto (crea Noira.md como memoria).

## Tabla funcional (legacy → thin H2 → acción H3)

| Capacidad | Legacy | Thin H2 | H3 |
|---|---|---|---|
| Pantalla completa + entrada abajo + estado | sí | sí | pulir + resize |
| Streaming + "pensando" + modelo visible | sí | sí | medir TTFB |
| Diálogo de confirmación estructurado | permission.go | y/n propio | ya |
| / comandos (picker interactivo) | picker UI | texto (/help…) | texto basta |
| Diálogo de modelos | models.go | `/model <id>` texto | texto basta |
| Sesiones (diálogo + sidebar) | session.go + sidebar | `/sessions /resume` texto | texto basta |
| Historial de prompt (↑↓) | sí (input) | NO | **implementar** |
| Atajos visibles | ctrl+? help | NO | **línea de hints** |
| Init Noira.md | init.go | NO (memoria auto) | no necesario |
| Tema NoiraXplum + dorado | sí | sí | mantener |
| Sin marca opencode visible | rebrand parcial | verificar | barrer "opencode" |

## Decisión
No se clona el picker/dialogs legacy: los comandos texto cubren lo mismo con
menos código. Se implementa historial ↑↓ + hints + TTFB + i18n + resize.
