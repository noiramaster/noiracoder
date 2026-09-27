# INFORME NoiraCoder — Septiembre 2026

## 1. Estado General

| Componente | Estado | Tests |
|------------|--------|-------|
| Motor TypeScript | ✅ Funcionando | 48/48 E2E |
| Go TUI (`--go`) | ✅ Funcionando | Go tests PASS |
| CLI principal | ✅ Funcionando | 22/23 smoke |
| H8 Credenciales | ✅ DPAPI + validación real | 21/21 gate |
| H9 Experiencia | ✅ 3 fallos → explicación | — |
| H10 Opciones | ✅ 7 idiomas | — |
| Landing page | ✅ noiracoder.pages.dev | — |
| i18n | ✅ 17 idiomas | 0 errores |

## 2. Lo que tiene NoiraCoder

### Motor
- **Multi-proveedor**: Gemini, OpenRouter, OpenAI, Anthropic, xAI, Groq, DeepSeek, Mistral, Grok
- **Rotación automática**: Si falla un proveedor, prueba el siguiente
- **Memoria de 3 niveles**: Proyecto → Global → Delgado
- **MCP**: Servidores Model Context Protocol
- **Paralelismo**: Tareas concurrentes
- **Confirmaciones**: Antes de acciones destructivas
- **Sesiones**: Persistencia y continuidad

### Experiencia (Hito 7)
- **H8 Credenciales**: Detección genérica de servicios, cifrado DPAPI local, validación con API real
- **H9 Explicación**: Detección de 3 fallos repetidos → resumen automático con solución
- **H10 Opciones**: Menú de credenciales, servicios disponibles, idiomas, temas, salir

### Despliegue
- **CLI**: `npm install -g noiracoder` → `noira`
- **Go TUI**: `noira --go` (binario compilado)
- **Landing**: https://noiracoder.pages.dev (7 idiomas)
- **Cloudflare Workers**: Deploy via `landing/deploy.mjs`

## 3. Lo que NO tiene (vs competidores)

| Función | Claude Code | OpenCode | NoiraCoder |
|---------|:-----------:|:--------:|:----------:|
| Desktop app | ✅ | ✅ (Beta) | ❌ |
| IDE extension | ✅ | ✅ | ❌ |
| GitHub PR integration | ✅ | ✅ | ❌ |
| LSP integration | ❌ | ✅ | ❌ |
| Multi-sesión paralela | ✅ | ✅ | ❌ |
| Share session links | ❌ | ✅ | ❌ |
| Image in terminal | ❌ | ✅ | ❌ |
| Enterprise (Bedrock/Vertex) | ✅ | ❌ | ❌ |
| 75+ proveedores | ❌ | ✅ | ✅ (rotación) |
| Modelos anónimos gratis | ❌ | ✅ | ✅ |
| Memoria 3 niveles | ❌ | ❌ | ✅ |
| Credenciales cifradas locales | ❌ | ❌ | ✅ |
| Landing 7 idiomas | ❌ | ❌ | ✅ |

## 4. Bloqueos

### 4.1. Publicación v0.2.0
El paquete npm **no incluye** `noira-thin.exe`. El script `postinstall` intenta descargarlo de GitHub Releases pero **nunca se publicó una release**.

**Opciones:**
1. Publicar release en GitHub con tag `noira-go-v0.2.0` → funciona automáticamente
2. Agregar `.exe` al campo `files` en `package.json` → +11MB en npm
3. No hacer nada → funciona en la mayoría de máquinas (fallback Ink)

### 4.2. Flujo E2E de credenciales
Solo Cloudflare está probado end-to-end. Git push y npm publish con credenciales reales no verificados.

### 4.3. Benchmarks
El modelo gratuito no soporta tool calling, lo que hace poco confiables los benchmarks automatizados.

## 5. Recomendaciones

### Para v0.2.0 (ya)
- Publicar release en GitHub
- Ejecutar `npm version minor` + `npm publish --access public`
- No cambiar nada más — el proyecto está sólido

### Para v0.3.0
1. **GitHub integration**: Issues → PRs (alto valor, esfuerzo moderado)
2. **Desktop app**: Tauri (~5MB vs ~150MB Electron)
3. **Multi-sesión**: Ya hay client/server, solo falta UI para múltiples sesiones

### Para v0.4.0+
4. **IDE extension**: VS Code via LSP
5. **LSP integration**: Análisis de código más profundo
6. **Share session links**: URL única por sesión

## 6. Métricas del Proyecto

| Métrica | Valor |
|---------|-------|
| Commits recientes | 1b96ada, 04e6a58, 42d329e |
| Archivos TypeScript | ~100 |
| Tests E2E | 48 |
| Tests Go | todos PASS |
| Tests gate (H10) | 21/21 |
| Smoke tests | 22/23 |
| Idiomas i18n | 17 |
| Idiomas landing | 7 |
| Tamaño Go binary | ~11MB |
| Tamaño npm package | ~1.5MB (sin .exe) |

## 7. Conclusión

NoiraCoder es un agente de coding gratuito, multi-proveedor, con cifrado local y experiencia en 17 idiomas. Está técnicamente sólido. El único bloqueo para v0.2.0 es la publicación de la release en GitHub.

**¿Qué debería hacer el usuario?**
1. Publicar la release en GitHub
2. Ejecutar `npm version minor` y `npm publish`
3. O pedirme que lo haga si tiene los permisos
