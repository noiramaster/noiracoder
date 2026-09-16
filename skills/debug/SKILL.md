---
name: debug
description: Reproduce, aísla y corrige bugs con pruebas. Úsala cuando algo falle o el usuario reporte error.
---

# Debug — Noira

1. Reproduce: crea script mínimo que falle igual.
2. Aísla: biseca (git bisect mental) hasta el commit/línea culpable.
3. Corrige con el cambio mínimo posible.
4. Verifica: re-ejecuta reproducción + tests relacionados.
5. Documenta causa raíz en una línea para AGENTS.md si es relevante.

Salida: `> [ok] bug en src/foo.ts:42 — off-by-one, fix aplicado, repro ahora pasa.`
