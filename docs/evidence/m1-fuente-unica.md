# M1.1 — Fuente única (2026-09-21, VERIFICADO EJECUTANDO)

## Qué se hizo
- `src/i18n/screen.ts`: 61 claves × 7 idiomas con `{vars}` nombradas
  (38 portadas de la Go + 23 nuevas para literales: filas de sesión,
  errores de protocolo y del servidor, sufijo de truncado).
- `GET /v1/i18n?lang=` (mismas puertas Bearer+versión): fallback
  exacto → base → en. Verificado: es / pt-BR→pt / xx→en, 401, 426.
- Go sin diccionarios (`lang.go` solo detecta + sustituye; `protocol.go`
  v2 con errores por clave; `model.go` con `F()`; `main` exige catálogo o
  exit 3). Servidor usa el catálogo con `opts.lang` (mismo prefs que la Go).
- PROTOCOL v2 documentado.
- Lint `npm run test:i18n:screen` 0 fallos: paridad 61×7, `{vars}` iguales,
  idénticas solo técnicas (allowlist), Go cero literales (allowlist con
  motivo: protocolo/marca/teclas/diagnóstico), thin.ts 0 errores literales,
  trinquete TS.
- pty 7 idiomas 56/56 (boot, conectado, hints, barra, /sessions, /help,
  error propio, /quit limpio). Harness `m1lang.cjs` (repo wrapper+binario
  v2, sin `NOIRA_THIN_BIN`).

## Decisiones
- `connected` cambió de "conectado al motor" a "listo/ready/…" (M0.f(3),
  jerga fuera; M3.3 lo refina con primera experiencia).
- Diagnósticos pre-pantalla por stderr quedan en literales con allowlist
  (los ve el wrapper, nunca la pantalla).
- Plurales/fechas con Intl quedan para M1.2 (las filas usan palabra fija).
- Traducciones nuevas redactadas por el mantenedor (no traductor
  profesional): honestidad M1.9.
