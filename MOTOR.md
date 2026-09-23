# NoiraCoder Motor — Paquete Independiente

El motor TS de NoiraCoder puede usarse como servidor HTTP independiente,
separado del cliente Go. Esto permite:

- Usar el motor desde cualquier cliente (no solo la TUI Go)
- Integrar NoiraCoder en otros flujos de trabajo
- Ejecutar el motor en un servidor remoto

## Uso rápido

```bash
# Instalar
npm install -g noiracoder

# Arrancar motor (HTTP en loopback)
npx noiracoder serve --thin --port 3797

# O desde el repo
npm run build && node dist/cli/cli.js serve --thin --port 3797
```

## API del motor (HTTP)

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/health` | GET | Estado del servidor |
| `/v1/turn` | POST | Enviar turno (message, sessionId, mode) |
| `/v1/events` | GET | Stream SSE de eventos |
| `/v1/cancel` | POST | Cancelar turno activo |
| `/v1/sessions` | GET | Listar sesiones |
| `/v1/sessions` | POST | Crear sesión |
| `/v1/session/:id` | PATCH | Renombrar/fijar sesión |
| `/v1/session/:id` | DELETE | Eliminar sesión |
| `/v1/model` | POST | Fijar modelo preferido |
| `/v1/model/stats` | GET | Latencia y scores por modelo |
| `/v1/mcp/servers` | GET | Servidores MCP conectados |
| `/v1/mcp/tools` | GET | Tools MCP disponibles |
| `/v1/parallel` | POST/GET | Toggle modo paralelo |
| `/v1/i18n` | GET | Catálogo de idioma |
| `/v1/langs` | GET | Idiomas disponibles |
| `/v1/lang` | POST | Cambiar idioma UI |
| `/v1/learn` | GET | Reglas de aprendizaje |
| `/v1/learn/revert` | POST | Revertir regla |
| `/v1/ui` | GET/POST | Estado UI persistente |

## Autenticación

El motor usa token Bearer:
```
Authorization: Bearer <token>
X-Noira-Protocol: 2
```

El token se genera automáticamente o se fija con `NOIRA_SERVE_TOKEN`.

## Ejemplo con curl

```bash
# Health
curl http://127.0.0.1:3797/health

# Turn
curl -X POST http://127.0.0.1:3797/v1/turn \
  -H "Authorization: Bearer tok-xxx" \
  -H "Content-Type: application/json" \
  -d '{"message":"Crea hola.txt con Hola","sessionId":"...","mode":"build"}'
```

## Desde Node.js

```typescript
import { startThinServer } from "noiracoder/motor";

const server = await startThinServer({
  port: 3797,
  log: console,
  level: "low",
  lang: "es",
  authToken: "mi-token",
});
```
