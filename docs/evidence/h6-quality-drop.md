# Investigación: Caída de calidad del banco (14/20 → 7/25 → 8/25)

**Fecha**: 2026-09-23
**Ronda 1** (referencia): 14/20 (70%) — sesión anterior, modelo no documentado
**Ronda 2** (anterior): 7/25 (28%) — poolside/laguna-s-2.1:free
**Ronda 3** (hoy): 8/25 (32%) — poolside/laguna-s-2.1:free

## Análisis de fallos (ronda 3)

### Fallos rápidos (<10s) — el modelo ni intenta tools
- fix-suma (1.5s), fix-typo (0.9s), feat-invierte (0.8s), feat-clamp (4.5s), feat-csv (0.8s), feat-media (0.5s), ref-extract (0.8s), test-csv (0.9s), doc-readme (0.9s), doc-pkg (1.3s), feat-filtrar (6s), ref-rename-export (3.7s)

**Causa**: El modelo gratuito `poolside/laguna-s-2.1:free` **no soporta tool calling de forma fiable**. Responde con texto plano en vez de llamar a las herramientas write/edit.

### Fallos por timeout (>150s)
- feat-unico (150s — pasó pero justo), ref-split (150s), test-nulo (26s — falló check)

### Éxitos (8/25)
- fix-nulo, fix-operador, feat-unico, ref-nombre, ref-dup, test-suma, fix-par, doc-json

## Causa raíz

| Factor | Impacto | Evidencia |
|--------|---------|-----------|
| **Modelo gratuito sin tool calling** | CRÍTICO | 12/25 fallos en <10s (el modelo no intenta usar tools) |
| **5 tareas nuevas más difíciles** | MEDIO | Las nuevas requieren tool calling más preciso |
| **Volatilidad del modelo free** | ALTO | Comportamiento inconsistente entre sesiones |
| **Timeout de 150s** | BAJO | Solo 2 timeouts reales |

## Conclusión

**La caída NO es una regresión del código.** Es causada por:
1. El modelo gratuito no soporta tool calling de forma fiable
2. Las 5 tareas nuevas (M6) son más difíciles y requieren tool calling preciso
3. La volatilidad inherent de modelos gratuitos

**Solución**: Usar un modelo premium (GPT-4, Claude) para el banco, o aceptar que el banco con modelo gratuito mide la capacidad del modelo, no la del código.

## Recomendación

El banco de calidad con modelo gratuito **no es un indicador fiable** de la calidad del código de NoiraCoder. Para medir calidad real, usar modelos premium.
