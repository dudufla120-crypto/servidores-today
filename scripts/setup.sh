#!/usr/bin/env bash
# ============================================================
# Way Servidores - setup local (Linux / macOS)
#   Uso:  bash scripts/setup.sh
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Way Servidores - setup local"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "==> Arquivo .env criado a partir de .env.example. Edite as credenciais."
else
  echo "==> .env já existe. Nada a copiar."
fi

echo "==> Instalando dependências (npm install)..."
npm install

echo ""
echo "Pronto!"
echo "1. Configure o PostgreSQL e crie o banco (veja database/README.md)."
echo "2. Preencha DATABASE_URL e API_KEY no arquivo .env."
echo "3. Em terminais separados rode:  npm run dev:worker   e   npm run dev"
echo "4. Painel: http://localhost:5173  |  API: http://localhost:4000/api"