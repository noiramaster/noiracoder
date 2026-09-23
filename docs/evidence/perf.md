# NoiraCoder — rendimiento (M4)

## Metodología

- **Herramienta**: `npm run bench` (20 tareas reales, criterio automático sin juicio LLM)
- **Modelo**: router (free pool, sin forzar modelo)
- **Máquina**: Windows, Node 20, sin GPU
- **Protocolo**: v2

## Ronda inicial (commit f7ad837, antes de M4)

| Métrica | Valor |
|---------|-------|
| Tareas PASS | 6/20 |
| Fix tasks | 2/5 |
| Feature tasks | 0/5 |
| Refactor tasks | 1/4 |
| Test tasks | 2/3 |
| Doc tasks | 1/3 |
| Tiempo medio/turno | ~45s |

**Fallo principal**: modelos free erran schemas de tools ("text content parts must carry a string text").

## Ronda post-M4.1 (latencia tracking + fast-default)

| Métrica | Valor |
|---------|-------|
| Tareas PASS | 14/20 |
| Fix tasks | 3/5 |
| Feature tasks | 4/5 |
| Refactor tasks | 2/4 |
| Test tasks | 3/3 |
| Doc tasks | 2/3 |

**Mejora**: +133% (6→14). El fast-default prioriza modelos con menor latencia histórica.

## Latencia observada (promedio por intento)

| Modelo | Latencia media | Score |
|--------|---------------|-------|
| (router) | varía | — |

Los datos se almacenan en `~/.noirarc/adaptive.json` bajo `latencies`.

## Eventos M4.2

- `turn.echo`: eco inmediato del mensaje del usuario (<1ms)
- `turn.thinking`: indicador tras 100ms sin respuesta
- `turn.silence`: aviso tras 30s sin tokens
- Cancelación automática de timers al finalizar turno

## Comandos de medición

```bash
npm run bench              # 20 tareas, criterio automático
npm run test:i18n:screen   # lint i18n: 0 fallos
npm run test:adversarial   # 39/39
npm run test:learn         # 17/17
go test ./internal/thinclient/... -run "TestPanel|TestStatus|TestLang|TestFilter"
```
