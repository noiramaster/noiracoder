# Evidencia HITO 6 — distribución (2026-09-19, sin publicar nada por 0.6)

## 6.1 CI (release.yml reescrito, sin matrix)
- Dispatch manual 35475389513 → build OK 1m23s (el `matrix.include`-only
  tumbaba el arranque; reescrito a bucle bash).
- Artefactos descargados y verificados: 5 binarios (MZ/ELF×2/Mach-O×2,
  7-8 MB) + NOTICE.txt. El exe Win arranca (exit 2 sin env, mensaje correcto).
- Linux/macOS ejecución: SOLO POR CÓDIGO (compilados en CI, no ejecutables aquí).

## 6.2 Descarga con hash
- `scripts/fetch-go-binary.mjs` (+`postinstall`, incluido en `files`):
  fallback elegante probado (`sin pantalla Go (HTTP 404)`), override
  `NOIRA_GO_BIN_URL` probado (binario instalado, `True`).
- Hallazgo honesto: `install-scripts approve` NO funciona para installs
  globales (ENOMATCH) → los instaladores ejecutan el fetch EXPLÍCITO con
  node (sin aprobación necesaria). El postinstall queda para installs
  locales aprobados. Hallazgo 2: `node:https.get` rechaza http → el fetch
  elige http/https por protocolo (fix verificado).

## 6.3 Instaladores
- install.sh/ps1: solo npm + fetch explícito. Sin URLs muertas
  (las de releases/latest de H0, eliminadas entonces).

## 6.4 Máquina limpia (Windows, aislada: prefix+home+tgz local)
- Install tgz local OK; bins noira/nc/noiracoder creados.
- Con override: `noira-thin.exe` del CI instalado.
- pty h6clean.cjs 3/3 con home SIN claves y env sin *KEY*: boot, turno
  Kilo anónimo con streaming, /sessions. Sin huérfanos.
- `npm rm` desinstala limpio.
- macOS/Linux: PENDIENTE (sin acceso; CI compila, H7 lo probará si hay medio).
