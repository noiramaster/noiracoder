# A5 — Comando exacto para el usuario + pty sobre instalación normal (2026-09-20)

## Por qué `npm link` y no `npm install -g .` (hoy, pre-0.2.0)
- `npm install -g .` COPIA el paquete; su postinstall intentaría descargar el
  release `noira-go-v0.1.0`, que no tiene binarios → instalación sin pantalla
  (respaldo con aviso). Tras la 0.2.0, `npm i -g noiracoder` sí traerá todo.
- `npm link` ENLAZA el repo (donde `npm run build:thin` ya dejó el binario
  que el wrapper busca) → pantalla completa hoy mismo.

## Comando exacto (PowerShell del usuario, una vez)
```powershell
cd C:\Users\aissa\noiracoder
npm install
npm run build
npm run build:thin
npm link
noira --go
```

## Qué debe ver (y qué NO)
- SÍ: pantalla completa — barra dorada `> NOIRACODER`, `conectado al motor`,
  zona de chat, caja `escribe tu tarea…`, línea de atajos (`Enter enviar ·
  ↑↓ historial · Ctrl+C … · /help`), estado `modelo: … · modo: … · sesión: …`.
- NO: la línea suelta `> Noira · medium` (era el bug A1: `--go` ejecutado
  como tarea por la copia global obsoleta, que `npm link` sustituye).
- Si viera una caja amarilla `Pantalla Go no disponible: …` dentro del chat,
  es el aviso A4 (dice la causa y el arreglo); repórtalo tal cual.

## pty sobre la instalación normal (VERIFICADO EJECUTANDO): A5 5/5
- Instalación fresca del tarball en prefijo aislado (postinstall con
  descarga+hash, binario `b069516f…`), SIN `NOIRA_THIN_BIN`.
- Pantalla completa + turno real corto (Kilo anónimo: streaming y fin de
  turno `sesión: Responde solo con la palabra OK`) + `/quit` 0 + sin
  huérfanos. Harness: `Temp\opencode\noira-pty\a5pty.cjs`.
- Primer run 4/5: `cuota:` no sale tras un turno mínimo porque el router solo
  emite `onQuotaEvent` con cambios (`thin.ts:219`); no es bug (cuota 6→8 ya
  vista en vivo en H2; segmento con dato cubierto por `status_test.go`).
  El check quedó como informativo y el rerun dio 5/5.
