---
name: testing
description: Escribe y ejecuta tests. Úsala cuando se cree feature, se corrija bug o se pida coverage.
---

# Testing — Noira

1. Detecta framework del repo (vitest/jest/pytest/go test). Si no hay, propone uno y crea config mínima.
2. Escribe tests que cubran: happy path, edge cases, errores.
3. Ejecuta `npm test` / `pytest` / `go test` y lee salida.
4. Si falla, auto-fix hasta verde (máx 5 intentos) — no preguntes, repara.
5. Reporta: `> [ok] 12 tests verdes (3 nuevos) — coverage ~78%` o `[warn] 2 fallos: ...`

Nunca dejes una feature sin test si el nivel es medium+.
