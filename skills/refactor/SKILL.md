---
name: refactor
description: Limpia código, aplica patrones y reduce deuda técnica sin cambiar comportamiento. Úsala en refactors explícitos o cuando detectes smells.
---

# Refactor — Noira

1. Lista smells: duplicación, funciones largas, nombres confusos, acoplamiento.
2. Propón cambios pequeños y verificables (un refactor por commit).
3. Preserva tests verdes — si rompes uno, revierte y reintenta.
4. Aplica: extraer función, renombrar, inyectar dependencia, simplificar condicional.
5. Resume: `> refactor: -120 líneas, 3 funciones extraídas, 0 tests rotos.`

Nunca refactorices y añadas feature a la vez.
