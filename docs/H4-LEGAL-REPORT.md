# H4 — Informe Legal: Licencia MIT y Separación del Motor

**Fecha**: 2026-09-23
**Basado en**: LICENSE (MIT), NOTICE, package.json

---

## 1. ¿Qué exige la licencia MIT del fork?

La licencia MIT es **la más permisiva** que existe. Exige **solo 2 cosas**:

1. **Incluir el aviso de copyright original** en todas las copias o partes sustanciales:
   > Copyright (c) 2025 Kujtim Hoxha

2. **Incluir el archivo LICENSE** (o aviso de permiso) en todas las distribuciones.

**No exige**:
- Contribuir código fuente de vuelta al upstream
- Usar la misma licencia en trabajos derivados
- Pagar regalías
- Notificar al autor original

**Conclusión**: NoiraCoder cumple ambas condiciones con LICENSE + NOTICE.

---

## 2. ¿Es viable separar el motor TS en un paquete publicado solo compilado?

### Análisis de dependencias del motor

| Paquete | Licencia | ¿Compatible con MIT? |
|---------|----------|----------------------|
| zod | MIT | ✅ |
| @modelcontextprotocol/sdk | MIT | ✅ |
| eventsource | MIT | ✅ |
| express | MIT | ✅ |
| hono | MIT | ✅ |
| ajv | MIT | ✅ |
| jose | MIT | ✅ |
| pkce-challenge | MIT | ✅ |
| raw-body | MIT | ✅ |
| cross-spawn | MIT | ✅ |
| cors | MIT | ✅ |

**Todas las dependencias del motor son MIT o equivalente.** No hay licencias copyleft (GPL, AGPL, LGPL) que impidan la separación.

### ¿Qué se puede publicar?

El motor (dist/) se puede publicar como paquete npm independiente **con las siguientes condiciones**:

1. **Incluir LICENSE** (MIT de Kujtim Hoxha) en el paquete
2. **Incluir NOTICE** con el copyright dual (OpenCode + NoiraCoder)
3. **No eliminar** los créditos originales del código fuente (aunque publiquemos solo compilado)
4. **Opcional**: Añadir nuestra propia licencia adicional (doble licencia)

### ¿Qué NO se puede hacer?

- **No se puede reclamar** que el código 100% es nuestro (debe incluir el copyright original)
- **No se puede usar** una licencia incompatible (ej: GPL) en el mismo paquete
- **No se puede eliminar** las referencias a OpenCode del código fuente

---

## 3. Verificación de cumplimiento actual

| Requisito MIT | Estado | Evidencia |
|---------------|--------|-----------|
| Copyright original incluido | ✅ | LICENSE: "Copyright (c) 2025 Kujtim Hoxha" |
| LICENSE file presente | ✅ | `/LICENSE` (21 líneas, MIT completo) |
| NOTICE con atribución | ✅ | `/NOTICE` — copyright dual + referencia a OpenCode |
| package.json "license": "MIT" | ✅ | `package.json` línea 3 |
| Sin dependencias copyleft | ✅ | Todas son MIT/Apache/ISC |

---

## 4. Recomendación para publicación del motor

### Opción A: Paquete compilado solo (dist/)
```json
{
  "name": "@noiracoder/motor",
  "version": "0.1.0",
  "license": "MIT",
  "files": ["dist/", "LICENSE", "NOTICE"]
}
```
**Viable**: MIT lo permite. Solo necesitamos incluir LICENSE + NOTICE.

### Opción B: Paquete con fuente (recomendado)
```json
{
  "name": "@noiracoder/motor",
  "version": "0.1.0",
  "license": "MIT",
  "files": ["src/", "dist/", "LICENSE", "NOTICE"]
}
```
**Más transparente**: Facilita auditorías y contribuciones.

### Opción C: Doble licencia
Publicar bajo MIT + licencia comercial para uso enterprise.
**Viable**: MIT permite sublicenciar.

---

## 5. Conclusión

**SÍ es viable** separar el motor TS como paquete independiente compilado.

**Requisitos**:
1. Incluir LICENSE (MIT de Kujtim Hoxha)
2. Incluir NOTICE (copyright dual)
3. No eliminar referencias a OpenCode del código fuente
4. Verificar que todas las dependencias son MIT/Apache/ISC (ya verificado)

**Riesgo**: Mínimo. MIT es la licencia más permisiva del ecosistema open source.

---

*Informe generado el 2026-09-23. No constituye asesoría legal profesional.*
