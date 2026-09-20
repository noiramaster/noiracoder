# A1 — Causa exacta de `noira --go` sin pantalla (2026-09-20, VERIFICADO EJECUTANDO)

## Dónde apunta `noira`
- `where.exe noira` → `C:\Users\aissa\AppData\Roaming\npm\noira` (+ `noira.cmd`).
  Ambos ejecutan `…\node_modules\noiracoder\bin\noiracoder.mjs`.
- Esa carpeta es una **copia física vieja** (directorio real, no symlink;
  fecha 19/09/2026; `package.json` = `noiracoder@0.1.0` sin `postinstall`
  thin en `files`: solo `dist`, `bin/noiracoder.mjs`, `skills`).

## Qué busca el wrapper instalado (2646 bytes, pre-thin)
- Busca `noira-go.exe` / `noira-go` (binario legacy con motor propio), NUNCA
  `noira-thin.exe`. En su `bin/` solo hay `noiracoder.mjs` → `existsSync(goBin)`
  es falso.
- Con terminal + binario ausente **no imprime ningún aviso** (el único mensaje
  de ese wrapper cubre el caso sin-TTY *con* binario) y cae silencioso a
  `cliMain`. Por eso el "aviso de respaldo prometido" no se ve: **en la copia
  instalada ese aviso no existe** (solo existe en el wrapper nuevo del repo).

## Por qué sale `> Noira · medium`
- El wrapper viejo no conoce `--go` (`isCliFlag` no lo incluye) y el
  `parseArgs` instalado lo mete como positional → `prompt = "--go"`.
- `invokedAs` = `basename(argv[1])` = `noiracoder.mjs` ≠ `noira` →
  `wantsRepl` falso → **one-shot con prompt `--go`**, que imprime
  `Noira · ${level}` (`dist/cli/cli.js:249`, `log.info`) y trata `--go`
  como tarea. Esa es exactamente la línea que vio el usuario.
- Ni siquiera es el REPL de Node: es el motor ejecutando la "tarea" `--go`.

## Hipótesis NOIRA_THIN_BIN
- **Refutada como causa en su máquina**: esa variable solo la usan los
  harnesses pty del laboratorio (`Temp\opencode\noira-pty\*.cjs`); el wrapper
  instalado ni la lee. El problema real es la copia global obsoleta.

## Dato de contraste
- En el repo (`C:\Users\aissa\noiracoder\bin\`) SÍ existe `noira-thin.exe`
  (11 MB, compilado local, gitignored): el repo abriría la pantalla, pero el
  usuario ejecuta la copia global vieja. Arreglo: reinstalar desde el repo
  (A3/A5) tras verificar el camino normal por tarball (A2).

## Comandos ejecutados (salida íntegra recortada)
- `where.exe noira` / `where.exe noiracoder`
- `Get-Content $env:APPDATA\npm\noira.cmd` (delega a `node_modules\noiracoder\bin\noiracoder.mjs`)
- `Get-ChildItem $env:APPDATA\npm\node_modules\noiracoder\bin` → solo `noiracoder.mjs` (2646 B)
- `Get-Content …\node_modules\noiracoder\bin\noiracoder.mjs` (busca `noira-go.exe`, sin `--go`, sin `thin`)
- `Select-String …\dist\cli\cli.js -Pattern "Noira · |invokedAs|wantsRepl"` → `:249 log.info('Noira · …')`, `:109 inNoira`, `:110 wantsRepl`
