# M0.g — Línea base (2026-09-21, antes de tocar nada de M1–M8)

## Latencia (m0-latencia.md)
CLI ~2,4 s caliente solo al arrancar; motor frío 2,6–7 s; catálogo +2 s
frío / +25 ms caliente; turno 202 en +0,3 s. Modelo fijado: primer texto
+1,9 s (pila +0,5 s sobre Kilo directo). Router auto HOY: cancelado ~16 s o
50–60 s sin eventos (ayer OK: volatilidad free + pick ciego).

## Pantalla ANTES (screens/before/)
vacia / conversacion / error / pequena (.html+.txt, pty + xterm-headless).
Muestran (router), "conectado al motor", título=1er mensaje, y el failover
por cuota poniendo el modelo real.

## Textos e idiomas (i18n-inventory.md)
~210 puntos visibles; Go 38 claves×7 completas + ~15 literales fuera;
CLI 24 claves×62 (7 completos, 55 sin freeWarning); landing 7×162 (test 0
fallos). Plurales/Intl: 0. Sin autodetección SO; sin prefs → EN.

## Funciones (m0-comparativa.md)
Faltan: @, !, /init, /compact, /diff, /undo|redo visibles, /export, /copy,
/model con búsqueda, --continue/--print, ratón, panel, títulos, IDE/stats.
Tenemos: sesiones+resume, plan/build, permisos motor, MCP motor, historial.

## Primera experiencia (m0-firstrun.md)
HOME virgen: EN, sin aviso free, "hola" sin respuesta (stall). Problemas
1–4 verificados. Extra: memoria AGENTS.md ejecutada por un turno (sonda
hola_noira eliminada) → M2.8e/M5.3.

## Riesgos para M1–M8
- Volatilidad de modelos gratuitos (el router auto es una lotería diaria).
- `AGENTS.md` con imperativos: cualquier mejora de memoria/títulos debe
  tratarla como datos.
- Deuda i18n: ~115 literales fuera de catálogo + 0 Intl + 55 idiomas sin
  freeWarning.
