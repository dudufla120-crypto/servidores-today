# ============================================================
# Way Servidores - backup dos dados dos servidores (rodar NA VM)
#   Uso:  bash scripts/backup.sh [destino]
# ============================================================
#!/usr/bin/env bash
set -euo pipefail

SERVERS_DIR="${SERVERS_DIR:-/var/way/servidores}"
BACKUPS_DIR="${1:-${BACKUPS_DIR:-/var/way/backups}}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUPS_DIR"

if [ ! -d "$SERVERS_DIR" ]; then
  echo "Diretório $SERVERS_DIR não existe. Nada a fazer."
  exit 0
fi

for server in "$SERVERS_DIR"/*/; do
  name="$(basename "$server")"
  echo "==> Backup de $name ..."
  tar -czf "$BACKUPS_DIR/${name}-${STAMP}.tar.gz" -C "$SERVERS_DIR" "$name"
done

echo "==> Backups concluídos em $BACKUPS_DIR"