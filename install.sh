#!/usr/bin/env bash
# NoiraCoder — instalador Unix (1 comando): motor TS (npm) + TUI Go (release).
# Uso: curl -fsSL https://raw.githubusercontent.com/noiramaster/noiracoder/main/install.sh | sh
set -e
echo "> Noira — instalando..."
if ! command -v node >/dev/null 2>&1; then echo "[error] necesitas Node 20+: https://nodejs.org"; exit 1; fi
if ! command -v npm >/dev/null 2>&1; then echo "[error] necesitas npm"; exit 1; fi
npm i -g noiracoder
# HITO 0: no se descarga ningún binario Go. El motor Node es el único camino
# por defecto; la TUI Go llegará como cliente fino en el Hito 2 (con hash).
echo "[ok] instalado — ejecuta: noira"
echo "     luego: noira login  (1 clic)"
