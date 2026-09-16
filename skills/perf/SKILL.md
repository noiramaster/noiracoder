---
name: perf
description: Perfila y optimiza hot paths. Úsala cuando se reporte lentitud o antes de deploy.
---

# Perf — Noira

1. Mide: `time`, `console.time`, o benchmark del repo.
2. Identifica hot path (1-2 funciones que más pesan).
3. Optimiza con cambio medible (memo, batch, índice, lazy).
4. Verifica: antes/después con números.

Salida: `> perf: /api/chat 420ms → 180ms (-57%) — batch DB queries.`
