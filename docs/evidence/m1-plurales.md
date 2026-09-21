# M1.2 — Plurales, relativo y fechas (2026-09-21, VERIFICADO EJECUTANDO)

## Qué
- `screenPlural(lang,key,count)` con `Intl.PluralRules` (ar 6 formas, resto
  one/other; fr 0→one). Variantes `__one/__other` (+`__zero/__two/__few/
  __many` en ar) para `resumed` y `session_row`; nunca se concatenan trozos.
- `relTime` (Intl.RelativeTimeFormat) + `dayBucket` (today/yesterday/week/
  older) + `groupLabel` (`group_*` en catálogo). `/v1/sessions` añade `rel`
  (aditivo, v2 compatible).
- Go: `pluralCategory` (7 idiomas) + `FP` (variante→other→base); fila con
  `{rel}`; `Session.Rel`.
- Lint ampliado: variantes completas, unidades (ar 0/1/2/3/11/100, buckets,
  grupos), placeholders de variantes (pueden omitir, no añadir).

## En vivo
- `1 · di solo OK (1 turno) · hace 24 minutos` por pty (singular ES + relativo).
- `/v1/sessions`: `"rel":"hace 21 minutos"`.

## Hallazgo: NOIRARC_HOME inconsistente (corregido)
TS lo trataba como dir de config (`$NH/prefs.json`) y Go/sessions como home
(`$NH/.noirarc/…`): con la variable fijada, motor y pantalla leían prefs
distintos (el motor siempre en EN en mis harnesses). Canónico = home:
`i18n/index.ts`, `auth/keys.ts`, `auth/crypto.ts`, `models/accountQuota.ts`
ahora unen `.noirarc`. e2e 48/48 tras el cambio (ruta keys actualizada).
