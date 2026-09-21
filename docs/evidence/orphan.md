# Punto 3 — Cero huérfanos (2026-09-21, VERIFICADO EJECUTANDO)

## Cambios
- `bin/noiracoder.mjs`: `killTree` en todos los caminos; handlers
  SIGINT/SIGTERM/SIGHUP + `exit` que matan Go+motor; `cleanOrphans()` al
  arrancar (solo procesos NUESTROS con padre muerto; nunca toca padre vivo).
  De paso: header `X-Noira-Protocol` del watchdog a "2".
- Go `parentwatch_{windows,unix}.go` + `main.go`: si el wrapper muere, la Go
  sale limpia (`p.Quit()` restaura la terminal) en ≤5 s. Entonces el motor ve
  el stream cerrado y se suicida: cadena completa sin huérfanos.
- Limitación honesta: PID reutilizado da falso vivo (documentado en código).

## Prueba pty (`m3orphan.cjs`): 12/12 PASS
A `/quit` (sale 0), B Ctrl+C, C matar pty (= cierre ventana), D taskkill al
wrapper (= kill): en las 4, cero supervivientes (sonda `process.kill` por
PID, no CIM) y secuencia `?1049l` de restauración en A/B.
