# Evidencia H1.1 — servidor thin (2026-09-19, ejecutado de verdad)

Comando: `node dist/cli/cli.js serve --thin --port 3799` (token por entorno)
Salida: `[ok] Noira thin escuchando en http://127.0.0.1:3799 (protocolo v1)`

## Puertas del protocolo
- `GET /health` → `{"ok":true,"app":"noiracoder","protocol":1,"engine":"node-ts"}`
- Sin token → 401. Token malo → 401. Sin `X-Noira-Protocol: 1` → 426.
- `POST /v1/confirm` con id desconocido → `{"ok":false,"aplicada":false}` (tardías ignoradas).
- `POST /v1/cancel` sin turno → 404.
- `POST /v1/undo` → `{"ok":true,...}` (revirtió un fichero de prueba del propio turno).
- `POST /v1/sessions` → `{"id":"b481c1a7-...","nombre":"prueba-h1"}`.
- `GET /v1/models` → lista real del catálogo (provider, gratis, disponible).

## Turno real con streaming (modelo real, Groq/OpenRouter del usuario)
- `POST /v1/turn` → `202 {"turnId":"518c2114-...","sessionId":"c65deb70-..."}`
- SSE: `hello proto=1` → `turn.text delta=2/1/2` → `session.updated` →
  `turn.end motivo=done` (TEXT-TOTAL 5).
- Persistencia: la sesión lista `turnos:2` (user+assistant) tras el turno.
- Efecto colateral honesto: el orquestador (level medium) creó
  `hola_noira.txt` con una tool; el propio test de `/v1/undo` lo revirtió.
  Artefacto eliminado; `git status` limpio salvo cambios intencionados.

## Herramienta de captura
`h1turn.cjs` (temporal, fuera del repo) + Invoke-WebRequest. Servidor de
prueba matado por puerto (Get-NetTCPConnection → Stop-Process). Sin huérfanos.
