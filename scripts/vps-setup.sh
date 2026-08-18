#!/usr/bin/env bash
# ============================================================
# Way Servidores - instalacao automatica em VPS (Ubuntu 22.04+)
# Uso: bash scripts/vps-setup.sh
# Instala Docker, clona o projeto e sobe o painel completo
# (Postgres + backend + worker + frontend/nginx).
# ============================================================
set -euo pipefail

REPO_URL="${1:-https://github.com/dudufla120-crypto/servidores-today.git}"
APP_DIR="$HOME/servidores-today"

echo "==> 1/5 Instalando Docker e Git..."
sudo apt-get update -qq
sudo apt-get install -y -qq docker.io docker-compose-v2 git
sudo usermod -aG docker "$USER"

echo "==> 2/5 Clonando o projeto..."
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

echo "==> 3/5 Criando o .env com chaves seguras..."
if [ ! -f .env ]; then
  cp .env.example .env
fi
sed -i "s|^API_KEY=.*|API_KEY=$(openssl rand -hex 24)|" .env
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 24)|" .env
if ! grep -q '^POSTGRES_PASSWORD=' .env; then
  echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" >> .env
fi

echo "==> 4/5 Buildando as imagens (pode levar 10-20 min na primeira vez)..."
set -a
source .env
set +a
docker compose -f docker/docker-compose.yml up -d --build

echo "==> 5/5 Verificando..."
sleep 10
docker compose -f docker/docker-compose.yml ps

echo ""
echo "=============================================================="
echo " PRONTO! Abra http://$(hostname -I | awk '{print $1}') no navegador"
echo ""
echo " IMPORTANTE: libere no firewall da nuvem (Security List) as portas:"
echo "   - TCP 80   (painel)"
echo "   - TCP 22   (SSH, normalmente ja liberada)"
echo "   - TCP 25565-25665 (servidores Minecraft)"
echo "=============================================================="
