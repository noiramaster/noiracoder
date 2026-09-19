# Evidencia HITO 4 — Kilo + OpenRouter (2026-09-19)

## 4.1 Oficiales + reales (kilo.ai/docs)
- Base `https://api.kilo.ai/api/gateway` OpenAI-compatible (`/chat/completions`,
  `/models`). Anónimo: solo `:free`, 200 req/h por IP. Con clave: todo.
- `GET /models` sin auth → 381 modelos. `kilo-auto/free` anónimo → 200 con
  resolución a `dots-studio/dots-3-note-preview:free`.
- 20 modelos `:free`, 18 con `tools` (verificado campo a campo).
- Auth vacía/`Bearer `/falsa en `:free` → 200 (el gateway la ignora).

## 4.2 Router
- `KiloClient` (anon filtra a `:free`; con clave, todo) + `classify` por sufijo.
  Siempre primero del pool. `isNetworkError` → rota (antes tumbaba el turno).
  Provider caído 3 seguidas → se aparta con aviso (`deadProviders`).
- Hallazgos honestos en el camino: caché envenenada con vacío (fix: nunca
  cachear vacío + fallback a rancio + bump a `catalog.v5.json`), tags de
  provider ausentes en fallback (fix: `classifyProviderModels`), caché
  compartida entre estados de claves (fix: `cacheDir` por `configDir()`),
  modelo inicial `""` por `??` (fix: `||` + fallback `nextAlive`).

## 4.3 Cuotas
- OpenRouter 50/día (1000 con 10 $) — existe. Kilo anónimo 200/h por IP —
  documentado, sin contador cliente (el 429 rota por `isRetryableStatus`).
- En vivo: `model.quota usadoPct 6→8`; aviso de agotada OpenRouter disparado
  de verdad hoy (65/50 por el testeo) y el router siguió con otros.

## 4.4 Sin claves (entorno LIMPIO, sin *KEY* heredadas)
- `/v1/models` → `{"kilo":20}`. Turno → streaming + `turn.end done`. CERO claves.
- `noira connect` reescrito: Kilo primero (siempre ok), OpenRouter/Groq/Zen
  opcionales con URLs directas. Validación viva por provider.

## 4.5 Kilo caído (KILO_BASE_URL a 127.0.0.1:9)
- Antes: `turn.error fetch failed` sin rotar. Después: 3 intentos → aviso
  `kilo: no responde` → cae a groq/openRouter con `model.switch` visible.
  (Failover cruzado a groq verificado en kf5: openrouter-401 → flip → groq done.)

## 4.6 Clave OpenRouter muerta
- En vivo: `openrouter: clave inválida (401). Se rota (4 modelos reasignados).
  Revisa con: noira connect` → el turno siguió en groq.
- PENDIENTE DEL USUARIO: regenerar la clave con `noira login`.

## 4.7 Primer uso (7 idiomas, una sola vez)
- Clave `freeWarning` en EN/ES/PT/FR/DE/IT/AR (+fallback EN para el resto).
  `freeWarningOnce` con flag `~/.noirarc/.freewarn-shown`: 1ª vez muestra,
  2ª calla. Llamado en `run` y en cada turno thin. Verificado ejecutando.
