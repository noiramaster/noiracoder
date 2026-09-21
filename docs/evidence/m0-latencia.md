# M0.a — Desglose de latencia hasta el primer texto (2026-09-21, VERIFICADO EJECUTANDO)

## Método
Sonda `Temp\opencode\noira-pty\m0lat.cjs` (motor `serve --thin` + `/health` +
`/v1/models` + SSE + `POST /v1/turn` "Responde solo con la palabra OK",
Kilo anónimo, HOME aislado) + `Measure-Command node bin/noiracoder.mjs
--version` (arranque CLI) + referencia directa a Kilo por fetch.

## Números (ms)
- Arranque CLI (`--version`, importa todo Ink/React): 3269 frío / 2351,
  2341, 2631 caliente. Solo arrancar Node+imports ya cuesta ~2,4 s.
- Motor hasta `/health` (boot Node + imports + MCP + listen): 2613–7140
  (frío; varía con caché FS).
- `/v1/models` tras health: +25 (caliente, catálogo en caché) / +2100
  (frío, descarga 386 modelos). Respuesta usa clave `modelos` (la sonda
  inicial leyó `models` y dio 0 — bug de sonda, no de producto).
- `POST /v1/turn` → 202: +300 aprox.
- Primer `turn.text` con modelo FIJADO (`poolside/laguna-s-2.1:free`):
  +1870; turno completo (verificación medium incluida) +6219.
- Referencia directa Kilo anónimo (mismo modelo, sin nuestra pila): 1083–1402
  al primer chunk. Nuestra pila añade ~0,5 s con modelo fijado. Bien.
- Primer texto con ROUTER AUTO (`(router)`) HOY: turno cancelado a ~16 s
  (3/3 en sonda + 2/2 en depuración), una vez 49,8 s, una vez timeout 60 s.
  Cero eventos de modelo y cero `model.switch` antes del fallo. Ayer el mismo
  camino completaba (A5). El `hello` anuncia `modelo":"(router)"`.

## Lectura (baseline, no diagnóstico final)
- Parte local controlable: ~2,4 (CLI) + ~3 (motor frío) + ~0,3 (turn) ≈ 6 s
  fríos / ~3 s calientes antes del proveedor. M4 debe recortar aquí
  (imports perezosos, motor caliente, catálogo en caché).
- Parte proveedor: con buen modelo ~1–2 s; con el pick automático de hoy,
  16 s→cancelado o 50–60 s. El router elige un modelo degradado y no hay
  visibilidad (qué modelo intenta, cuánto lleva) ni failover rápido visible.
  Pasa a M4 (medir por intento) y M7 (el cancelado silencioso sin `model.switch`
  huele a fallo no rotado). NO es regresión de esta sesión: ayer funcionaba;
  es volatilidad de modelos gratuitos + selección ciega.
- Referencia H3 (otro día/modelo): 3729 ms al primer delta. El "3,7 s" no es
  estable día a día con router auto.
