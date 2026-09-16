# NoiraCoder — instalador Windows (1 comando)
# Uso: irm https://raw.githubusercontent.com/noiramaster/noiracoder/main/install.ps1 | iex
$ErrorActionPreference = "Stop"
Write-Host "> Noira — instalando..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Host "[error] Node 20+ requerido: https://nodejs.org" -ForegroundColor Red; exit 1 }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { Write-Host "[error] npm requerido" -ForegroundColor Red; exit 1 }
npm i -g noiracoder 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "[error] fallo npm install -g noiracoder" -ForegroundColor Red; exit 1 }
# Binario Go precompilado del release (opcional, fallback al motor Node).
try {
  $dest = Join-Path (npm root -g) "noiracoder\bin\noira-go.exe"
  Invoke-WebRequest -Uri "https://github.com/noiramaster/noiracoder/releases/latest/download/noira-go-Windows-x86_64" -OutFile $dest -UseBasicParsing
  Write-Host "[ok] TUI Go instalada" -ForegroundColor Green
} catch {
  Write-Host "[warn] sin binario Go (se usa el motor Node)" -ForegroundColor Gray
}
Write-Host "[ok] instalado — ejecuta: noira" -ForegroundColor Green
Write-Host "     luego: noira login" -ForegroundColor Gray
