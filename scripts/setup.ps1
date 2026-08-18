# ============================================================
# Way Servidores - setup local (Windows / PowerShell)
#   Uso:  powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
# ============================================================
param(
  [switch]$SkipDeps
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Write-Host "==> Way Servidores - setup local" -ForegroundColor Cyan

if (-not (Test-Path "$Root\.env")) {
  Copy-Item "$Root\.env.example" "$Root\.env"
  Write-Host "==> Arquivo .env criado a partir de .env.example. Edite as credenciais." -ForegroundColor Yellow
} else {
  Write-Host "==> .env já existe. Nada a copiar." -ForegroundColor Green
}

if (-not $SkipDeps) {
  Write-Host "==> Instalando dependencias (npm install)..." -ForegroundColor Cyan
  Push-Location $Root
  try {
    npm install
  } finally {
    Pop-Location
  }
}

Write-Host ""
Write-Host "Pronto!" -ForegroundColor Green
Write-Host "1. Configure o PostgreSQL e crie o banco (veja database/README.md)."
Write-Host "2. Preencha DATABASE_URL e API_KEY no arquivo .env."
Write-Host "3. Em terminais separados rode:  npm run dev:worker   e   npm run dev"
Write-Host "4. Painel: http://localhost:5173  |  API: http://localhost:4000/api"