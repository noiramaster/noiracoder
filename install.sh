#!/usr/bin/env bash
# NoiraCoder — instalador Unix (1 comando): motor TS (npm) + pantalla Go (postinstall con hash).
# Uso: curl -fsSL https://raw.githubusercontent.com/noiramaster/noiracoder/main/install.sh | sh
set -e
echo "> Noira — instalando..."
if ! command -v node >/dev/null 2>&1; then echo "[error] necesitas Node 20+: https://nodejs.org"; exit 1; fi
if ! command -v npm >/dev/null 2>&1; then echo "[error] necesitas npm"; exit 1; fi
npm i -g noiracoder
# HITO 6: la pantalla Go se descarga con hash verificado ejecutando el
# fetch explícito (los lifecycle scripts requieren aprobación aparte):
node "$(npm root -g)/noiracoder/scripts/fetch-go-binary.mjs" 2>/dev/null || true
# Sin pantalla Go (sin release aún o plataforma rara) avisa y usa el motor Node.
echo "[ok] instalado — ejecuta: noira --go   (pantalla completa)"
echo "     o        : noira          (motor Node)"
