# NoiraCoder — instalador Windows (1 comando)
# Uso: irm https://raw.githubusercontent.com/noiramaster/noiracoder/main/install.ps1 | iex
$ErrorActionPreference = "Stop"
Write-Host "> Noira — instalando..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Host "[error] Node 20+ requerido: https://nodejs.org" -ForegroundColor Red; exit 1 }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { Write-Host "[error] npm requerido" -ForegroundColor Red; exit 1 }
npm i -g noiracoder 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "[error] fallo npm install -g noiracoder" -ForegroundColor Red; exit 1 }
# HITO 6: la pantalla Go se descarga con hash ejecutando el fetch explícito
# (los lifecycle scripts requieren aprobación aparte):
node "$(npm root -g)/noiracoder/scripts/fetch-go-binary.mjs" 2>&1 | Out-Null
Write-Host "[ok] instalado — ejecuta: noira --go   (pantalla completa)" -ForegroundColor Green
Write-Host "     o        : noira          (motor Node)" -ForegroundColor Gray
