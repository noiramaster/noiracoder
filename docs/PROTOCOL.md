# NoiraCoder — Protocolo motor (TS) ↔ pantalla (Go): CLIENTE FINO

Versión del protocolo: **1**. Estado: **diseño (Hito 0)** — el servidor actual
(`src/server/server.ts`) solo tiene `GET /health` + `POST /session` (bloqueante,
sin streaming ni confirmaciones remotas). El Hito 1 lo lleva hasta aquí.

## 0. Principios no negociables

1. El motor TS es el ÚNICO que llama a modelos, ejecuta herramientas, guarda
   memoria/sesiones, rota proveedores y controla cuotas. La Go pinta y lee teclas.
2. La Go NUNCA ve claves de API. Solo ve el token de sesión del motor.
3. Solo loopback: el motor escucha en `127.0.0.1`, puerto libre aleatorio
   elegido por el wrapper en cada arranque. Token Bearer aleatorio
   (32 bytes hex) NUEVO en cada arranque.
4. Token y puerto viajan por **variables de entorno** (`NOIRA_PORT`,
   `NOIRA_TOKEN`). NUNCA por argumentos (visibles en `tasklist`/`ps`).
5. Un solo cliente: el primer SSE conectado manda; un segundo es rechazado
   (`409`). Sin cliente o con timeout, toda confirmación se DENIEGA.

## 1. Arranque y ciclo de vida (wrapper `bin/noiracoder.mjs`)

1. El wrapper elige puerto libre, genera token, arranca el motor
   (`node dist/index.js serve --port P`, con `NOIRA_SERVE_TOKEN` en entorno).
2. Espera `GET /health` (máx 5 s). Si no responde → error claro + respaldo Ink.
3. Arranca la Go con `NOIRA_PORT`/`NOIRA_TOKEN` en entorno.
4. Al salir la Go, el wrapper mata el motor (SIGTERM/taskkill al árbol).
   Si muere el motor, la Go muestra error fatal y el wrapper sale ≠ 0.
5. Sin huérfanos: el wrapper registra ambos PIDs y los mata al salir él.
6. Si falta el binario Go o falla al arrancar → respaldo Ink con mensaje claro.

## 2. Versionado

- La Go envía `X-Noira-Protocol: 1` en cada request y como query del SSE.
- Versión distinta → `426 Upgrade Required` + `{error, protocol}` y cada lado
  aborta con mensaje legible ("actualiza noira / noira-go").
- `GET /health` (sin auth) responde `{ok, app:"noiracoder", protocol:1}`.

## 3. Endpoints (todos con `Authorization: Bearer`, salvo `/health`)

| Método | Ruta | Uso |
|---|---|---|
| GET | `/health` | liveness (sin auth) |
| GET | `/v1/status` | estado para el watchdog del wrapper: `{ok, protocol, clientes, turnoActivo}`. Con auth como los demás (sin token → 401). No expone rutas, claves ni contenido de sesiones. Prueba: `test/adversarial.mjs` (401/426/forma). |
| GET | `/v1/events?protocol=1` | **SSE único** (un cliente; 2º → 409) |
| GET | `/v1/models` | modelos `{id, provider, disponible, cuota}` |
| POST | `/v1/model` `{id}` | cambio manual de modelo |
| GET | `/v1/sessions` | lista `{id, nombre, updatedAt, modelo, modo}` |
| POST | `/v1/sessions` `{nombre?}` | crear sesión |
| POST | `/v1/turn` `{sessionId?, mensaje, modo, modelo?}` | nuevo turno → `{turnId}` (409 si hay turno activo) |
| POST | `/v1/cancel` `{turnId}` | cancelar turno (Ctrl+C no cierra sesión) |
| POST | `/v1/confirm` `{confirmId, aprobado}` | responder confirmación |
| POST | `/v1/undo` `{sessionId}` / `/v1/redo` | deshacer / rehacer |

`modo`: `"build"` (defecto, puede ejecutar) | `"plan"` (solo lectura: el motor
rechaza cualquier herramienta de escritura antes de ejecutarla).

## 4. Eventos SSE (`event:` + `data:` JSON; heartbeat `:ping` cada 15 s)

- `hello` `{protocol, motor, modelo}` — bienvenida del stream.
- `turn.text` `{turnId, delta}` — texto del modelo en streaming.
- `turn.tool_start` `{turnId, nombre, detalle, confirmId?}` — p.ej. comando exacto.
- `turn.tool_end` `{turnId, exitCode, salida}` — salida ya saneada y truncada.
- `confirm.request` `{confirmId, accion, detalle, timeoutMs}` — la Go pinta
  **su propia barra** desde estos campos (nunca desde texto del modelo).
- `confirm.result` `{confirmId, aprobado}` — eco de lo aplicado.
- `model.switch` `{de, a, motivo}` — rotación visible siempre.
- `model.quota` `{proveedor, usadoPct, aviso}` — aviso al acercarse al límite.
- `memory.event` `{nivel, resumen}` — qué se guardó (sesión/proyecto/global).
- `session.updated` `{id, nombre}` — nombre inteligente tras el turno.
- `turn.error` `{turnId, mensaje}` — error claro, nunca silencio.
- `turn.end` `{turnId, motivo: done|cancelled|error}`.

## 5. Confirmaciones (decisión Hito 0.4)

- Por defecto **DENEGAR**. Solo se aprueba con `POST /v1/confirm{aprobado:true}`
  desde EL cliente conectado. Sin cliente, con timeout o con segundo cliente
  → denegado. Timeout de confirmación: 120 s con cuenta visible.
- La lista de acciones prohibidas se deniega **SIEMPRE, incluso confirmando**
  (comportamiento actual del motor: E2E 1a–1e).
- Cada `confirm.request` lleva `confirmId` único; respuestas tardías o
  duplicadas se ignoran y se registran.

## 6. Saneo de pantalla (detalle en Hito 2.4)

Toda cadena que venga de modelo/ficheros/herramientas se sanea antes de
pintarse: se eliminan secuencias ANSI/OSC/C0 (salvo `\n`, `\t`), límite de
2000 caracteres por línea, y la barra de confirmación solo se construye con
datos estructurados del evento. Así una salida maliciosa no puede simular
una confirmación ni manipular la terminal.

## 7. Límites y errores

- Turno sin eventos > 60 s → `turn.error` (timeout) + turno liberado.
- Motor caído a mitad de turno → la Go muestra error fatal (no cuelgue).
- Go caída → el wrapper mata el motor (sin huérfanos).
- Token incorrecto/ausente → `401`; segundo SSE → `409`; protocolo distinto → `426`.
