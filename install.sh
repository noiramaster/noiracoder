#!/usr/bin/env bash
# NoiraCoder — instalador Unix (1 comando): motor TS (npm) + TUI Go (release).
# Uso: curl -fsSL https://raw.githubusercontent.com/noiramaster/noiracoder/main/install.sh | sh
set -e
echo "> Noira — instalando..."
if ! command -v node >/dev/null 2>&1; then echo "[error] necesitas Node 20+: https://nodejs.org"; exit 1; fi
if ! command -v npm >/dev/null 2>&1; then echo "[error] necesitas npm"; exit 1; fi
npm i -g noiracoder
# Binario Go precompilado del release (opcional, fallback al motor TS/Node).
# Nombres canónicos de asset: noira-go-<Windows|Linux|Darwin>-<x86_64|arm64>
if command -v curl >/dev/null 2>&1; then
  OS="$(uname -s)"; ARCH="$(uname -m)"
  case "$OS" in MINGW*|MSYS*|CYGWIN*|Windows_NT*) OS="Windows";; Darwin*) OS="Darwin";; Linux*) OS="Linux";; esac
  case "$ARCH" in x86_64|amd64) ARCH="x86_64";; arm64|aarch64) ARCH="arm64";; esac
  BIN_URL="https://github.com/noiramaster/noiracoder/releases/latest/download/noira-go-${OS}-${ARCH}"
  if [ "$OS" = "Windows" ]; then DEST="$(npm root -g)/noiracoder/bin/noira-go.exe";
  else DEST="$(npm root -g)/noiracoder/bin/noira-go"; fi
  curl -fsSL "$BIN_URL" -o "$DEST" 2>/dev/null && chmod +x "$DEST" && echo "[ok] TUI Go instalada" || echo "[warn] sin binario Go (se usa el motor Node)"
fi
echo "[ok] instalado — ejecuta: noira"
echo "     luego: noira login  (1 clic)"
