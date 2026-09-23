# NoiraCoder — banco de calidad

## Metodología

- **Herramienta**: `npm run bench` (25 tareas reales, criterio automático sin juicio LLM)
- **Modelo**: poolside/laguna-s-2.1:free (router free pool)
- **Máquina**: Windows, Node 20, sin GPU
- **Protocolo**: v2

## Ronda M6 (post-mejoras, 25 tareas)

| Métrica | Valor |
|---------|-------|
| Tareas PASS | 10/25 |
| Fix tasks | 2/7 |
| Feature tasks | 2/5 |
| Refactor tasks | 2/4 |
| Test tasks | 1/3 |
| Doc tasks | 3/5 |

**Mejoras M6**: checks resilientes (content + require fallback), 5 tareas nuevas.

## Comandos de medición

```bash
npm run bench              # 25 tareas, criterio automático
NOIRA_BENCH_MODEL=X npm run bench  # modelo específico
```
