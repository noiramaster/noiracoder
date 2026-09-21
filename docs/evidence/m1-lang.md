# M1.3/M1.4/M1.5 — Comandos, autodetección, /lang (2026-09-21)

## M1.3
Nombres /cmd en inglés (incl. `/lang`, `/lang answer`); descripciones y
`/help` del catálogo (help_cmds lleva /lang). Tab completa `/lan`→`/lang `
(pty). Teclas sin traducir (lint lo impone).

## M1.4
`detectOsLang()` (LC_ALL>LC_MESSAGES>LANG>LANGUAGE; Windows:
`Get-WinUserLanguageList`) + `getLanguage`: prefs → SO (y se guarda) → en.
Verificado: HOME virgen en esta máquina → `es` (antes: en). `/lang auto`
vuelve a detectar (HTTP: auto→es).

## M1.5
- `GET /v1/langs` (7 códigos + nativos + ui + answer), `POST /v1/lang`
  (código|n|auto; muta `opts.lang` en caliente), `POST /v1/lang/answer`
  (auto|ui|código en prefs).
- Go `/lang` (lista numerada con actual `*`, `/lang <n|código|auto>`,
  `/lang answer <modo>`): refetch de catálogo sin reiniciar.
- Respuestas: `answerLang` (auto = como escribe el usuario [defecto],
  ui, o fijo); el prompt ya ordenaba auto (identity).
- pty 6/6: lista nativos, actual, Tab, cambio ES→FR en vivo
  (`Entrée envoyer`), answer ui. Harness `m1lang2.cjs`.
