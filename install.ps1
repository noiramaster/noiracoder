# NoiraCoder — instalador Windows (1 comando)
# Uso: irm https://raw.githubusercontent.com/noiramaster/noiracoder/main/install.ps1 | iex
$ErrorActionPreference = "Stop"
Write-Host "> Noira — instalando..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Host "[error] Node 20+ requerido: https://nodejs.org" -ForegroundColor Red; exit 1 }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { Write-Host "[error] npm requerido" -ForegroundColor Red; exit 1 }
npm i -g noiracoder 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "[error] fallo npm install -g noiracoder" -ForegroundColor Red; exit 1 }
# HITO 0: no se descarga ningún binario Go. El motor Node es el único camino
# por defecto; la TUI Go llegará como cliente fino en el Hito 2 (con hash).
Write-Host "[ok] instalado — ejecuta: noira" -ForegroundColor Green
Write-Host "     luego: noira login" -ForegroundColor Gray
