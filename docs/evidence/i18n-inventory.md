# M0.c — Inventario exhaustivo de textos visibles (2026-09-21, extraído del código)

Método: grep sistemático (no memoria) sobre `internal/thinclient/*.go`
(no test), `src/cli|tui|core|server|i18n|sandbox|models|auth|tools`,
`bin/noiracoder.mjs`, `scripts/*.mjs`, `install.sh/ps1`. `test/i18n.mjs`
cubre la LANDING (`landing/i18n.js`), no el CLI.

## 1. Pantalla Go — catálogo `lang.go` (38 claves × 7 idiomas, completo)
Cabecera/estado: `prompt_ph, connected, hints, st_model, st_mode,
st_session, st_thinking, st_turn, st_quota`. Comandos: `help_cmds,
help_keys, resume_usage, model_usage, model_set, resume_hint, plan_on,
build_on, unknown_cmd`. Confirmaciones: `confirm_q, confirm_yn,
confirm_yes, confirm_no`. Sesiones: `resumed, new_session, no_sessions`.
Motor: `model_switched, tool_start, tool_end, tool_end_fail, mem_line,
quota_warn, err_motor, err_line, cancel_line, fatal_line, err_sessions,
err_resume, err_model`. Todas con variables `%s/%d`, sin plurales ni fechas.

## 2. Pantalla Go — LITERALES fuera del catálogo (15, van a M1.1)
- `model.go:283`: `"%s%d · %s (%d turnos)"` (lista de sesiones; con
  variables pero fija en español: "turnos").
- `model.go:411`: `"[confirm] %s"` (prefijo fijo inglés).
- `protocol.go` (13 errores que la pantalla muestra vía `err_motor/err_line/
  fatal`): `health ilegible, motor no ok, protocolo distinto… (actualiza
  noira / noira-go), ya hay un turno en curso, turno rechazado (%d),
  confirm rechazado (%d), sesiones %d, sesión %d, modelo %d, ya hay una
  pantalla conectada (409), events %d, stream cortado, stream cerrado por
  el motor`. Españoles, con códigos del SO/red pegados (de-fuera parcial).
- Marca permitida: `NOIRACODER`, `"> "`, unión `modelo · modo` (puntuación).

## 3. CLI/REPL TS — diccionario `src/i18n` (24 claves EN × 62 idiomas)
`langUnsupported, langDetected, langSelectorPrompt, langSelectorTitle,
confirmYes, confirmNo, confirmDelete, confirmGitPush, confirmExecute,
deniedSensitivePath, deniedConfirmDisabled, canceledByUser, okWritten,
okEdited, okDeleted, okRead, errorRead, errorEditOldNotFound, errorNotExist,
noApiKey, quotaWarning, quotaExhausted, freeWarning, routerLevelPrefix`.
SOLO 7 idiomas completos (en es pt fr de it ar); los otros 55 pierden
`freeWarning` (cae a EN por fallback — verificar en M1).

## 4. CLI/REPL TS — literales fuera del diccionario (~90 puntos, van a M1.1)
- Banner/welcome: `> NOIRA vX`, cwd, `Offline/Modelos locales`,
  `Awaiting connection… (usa /login)`, `Ready.`, `No sessions yet…`,
  `Comandos: /login · /new · /level · /help`.
- Panel sesiones: `Recent sessions:`, `[i] emoji título fecha`,
  `/resume [indice] · /new · /search · /level · /help`, `X turnos`
  (fecha relativa y plural SIN Intl — M1.2).
- Comandos: sugerencias, `Enter para nueva tarea · Esc`,
  `> Noira · <nivel>`, `Paso(s): N`, `No hay sesiones…`, `Retomando: …
  (N turnos)`, `Índice inválido/no encontrado`, `Sesión nueva iniciada`,
  `Uso: /search|/level …`, `Idioma guardado/actual`, `Comando desconocido`,
  `Agentes: … [estado]`, `Paralelo… (usa /parallel)`, `Memoria global: N
  nota(s), M promocion(es)` (plural manual — M1.2), `Hasta la próxima…`,
  `Fin de la entrada…`.
- Login/connect: `Abriendo el flujo…`, `Conectado a OpenRouter (user…)` /
  `[ok] guardado en ~/.noirarc/keys.json`, `Falta key…`, `Con 3 claves
  gratis…`, `NOIRA - funciona SIN claves (Kilo anónimo, 200 req/hora)`,
  `Comprobando cada clave (red real)…`, `Listo. Elige proveedor…`, `Aún no
  hay claves…`, `[mcp] Servidores MCP conectados.`.
- Serve/one-shot: `[thin] token…`, `[thin] el wrapper murió…`,
  `[serve] confirmación denegada (headless)…`, `Noira · <nivel>`,
  `Paso(s)`, salida del modelo y de herramientas TAL CUAL (de-fuera, no se
  traduce — M1.7 ya se cumple aquí).
- TUI Ink (respaldo, ~10): `> noira`, `> >> >`, `cargando…`, `Necesitas
  autorizar…`, `Presiona Enter para autorizar con OpenRouter`, `/login`,
  `Sin conexión. Escribe /login`, `Comandos: /login /clear /help`,
  `Atajos: ctrl+c salir` (+ caja NOIRA_NOTICE con variables).
- Excepciones volcadas al usuario (`e.message`, de-fuera): login, connect,
  one-shot, repl, fetch catálogo. Van con mensaje NUESTRO delante salvo en
  4 puntos (M1.7: poner mensaje propio + detalle debajo).

## 5. Servidor thin — errores JSON (10, los pinta la Go)
`sesión no encontrada, campo 'confirmId/id/message' requerido, no hay turno
en curso con ese id, ya hay un cliente/turno en curso, no autorizado: falta
token Bearer válido, no encontrado`. Españoles fijos; los muestra la Go
pegados a `err_line` (M1: pasan al catálogo con el detalle aparte).

## 6. Wrapper + instaladores (~21)
Wrapper (8): `Sin binario thin… / npm run build:thin`, `El motor no arrancó`,
`no conectó en 10 s`, `no arrancó (arquitectura…)`, `protocolo incompatible`,
`terminó muy pronto (código)`, `--go necesita terminal interactivo`,
`` `nc` es siempre…``. postinstall (5): `NOIRA_GO_BIN_URL…`, `hash
verificado/distinto`, `pantalla Go instalada`, `sin pantalla Go…`,
`plataforma sin binario`. build:thin (2), check-release (4), install.sh/ps1
(~6 echos). Fijos ES salvo `"actualiza noira / noira-go"` (Go).

## 7. Sistema (no visible tal cual, pero M0.f(1) y M1.6)
`src/core/identity.ts`: ordena decir `"Noira · <nivel>"` (§Nivel de
ejecución) — el modelo lo renderiza ("nivel bajo") y se filtra el ajuste
interno. El prompt del sistema está en español con la instrucción de
detectar idioma (bien), pero sin anti-fuga (router/motor/proveedores/nivel).

## Recuento
| Fuente | Cadenas |
|---|---|
| Go catálogo (38×7, completo) | 38 claves |
| Go literales fuera | ~15 |
| CLI diccionario (24×62; 7 completos) | 24 claves |
| CLI/REPL/Ink literales fuera | ~100 |
| Servidor thin errores | 10 |
| Wrapper + instaladores | ~21 |
| Sistema/identidad | 1 prompt |
| **Total aprox.** | **~210 puntos visibles** |
| Plurales con Intl | 0 (todo manual: "turnos", "nota(s)") |
| Fechas relativas con Intl | 0 (fecha cruda del store) |
| De-fuera que se muestran tal cual | salida modelo/herramientas, e.message (4 pts sin mensaje propio), códigos HTTP/SO |

## M0.d (idiomas, 2026-09-21)
- Pantalla Go: 7 (en es pt fr de it ar) × 38 claves, paridad completa
  (`lang_test.go` la impone). Pty verificado en EN y AR (H3).
- CLI diccionario: 62 idiomas; 7 completos (24 claves); 55 con 23 (falta
  `freeWarning`, fallback a EN). "No idéntico al inglés": casi todo pasa
  (1–2 idénticas por idioma: marca/comandos/técnicas).
- Landing (`landing/i18n.js`, `test:i18n`): 7 idiomas × 162 claves, 0 fallos.
- Detección: `detectLang` por `prefs.json`; sin prefs → EN (verificado en
  pty A2: HOME virgen sale en inglés). Sin autodetección del SO todavía.
- Afirmaciones hoy: README no da cifra de idiomas (bien); landing dice 7
  (coincide con lo verificado).
