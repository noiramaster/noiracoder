# M1.7/M1.8/M1.10/M1.11/M1.12 + punto 4 (2026-09-21)

## M1.7
Go ya cumplía (prefijo catálogo + detalle crudo). TS: 4 puntos
(repl turno, cli connect, cli one-shot, tui Ink) ahora emiten mensaje
nuestro (`errorExternal` del diccionario, EN+7, resto fallback EN) +
detalle original debajo sin traducir. Nunca se traduce salida de
herramientas/modelo/ficheros (ya era así).

## M1.8
Barra con presupuesto de ancho (runewidth): recorta sesión y luego modelo;
<60 cols pasa a DOS líneas (modelo·modo / sesión·cuota·avisos). Test
`TestFitStatus40` (de largo + CJK doble ancho). pty 40×10 previo mostraba
corte a mitad de palabra (before/pequena).
RTL (ar/he): mejor esfuerzo — la terminal pinta los glifos (pty ar sin
mojibake) pero el orden visual bidireccional lo decide el emulador, no
nosotros; no reordenamos segmentos (estado/hints quedan LTR con islas RTL).
Limitación real documentada: no prometer espejo RTL completo.

## M1.10
`test:i18n:screen` incluye bloque D (CLI: 7×25 completos, resto 23 con
fallback documentado, idénticas solo técnicas/cognados) + procedencia.

## M1.11
pty 13 idiomas 52/52 (`m1lang13.cjs`): 7 con UI propia; zh/ja/hi/ru/tr/he
caen a EN honesto, sin mojibake, quit limpio.

## M1.12 + punto 4
`SCREEN_PROVENANCE` (en source, resto auto) con assert en lint. Landing sin
cifras de idiomas (solo etiqueta footer). README: "62 CLI (7 completos,
resto fallback EN), pantalla en 7, traducciones automáticas en revisión,
no profesionales".
