#!/usr/bin/env bash
# =============================================================
#  DEPLOY RÁPIDO Y SEGURO — Menú Digital
#  Uso (en el server):   cd /opt/menudo && ./deploy.sh
#
#  1. Respalda TODO el volumen de datos (/data) a /opt/menudo-backups
#  2. Baja el código nuevo (git pull)
#  3. Construye la imagen nueva MIENTRAS la actual sigue atendiendo
#  4. Reemplaza el contenedor (~2 s de corte) y verifica que responda
#
#  Los datos (config, ventas, órdenes, usuarios, fotos, sesiones)
#  viven en el volumen Docker "store_data" y NO se tocan.
#  ⚠️  NUNCA uses "docker compose down -v": -v BORRA el volumen.
# =============================================================
set -euo pipefail
cd "$(dirname "$0")"

CONTAINER=menudo_app
BACKUP_DIR=/opt/menudo-backups
PORT=$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 | tr -d '[:space:]' || true)
PORT=${PORT:-8070}

c_ok()   { echo -e "\e[32m✔ $*\e[0m"; }
c_info() { echo -e "\e[36m➜ $*\e[0m"; }
c_err()  { echo -e "\e[31m✘ $*\e[0m"; }

# ── 1. Respaldo del volumen ──────────────────────────────────
mkdir -p "$BACKUP_DIR"
if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  STAMP=$(date +%F_%H%M%S)
  c_info "1/4 Respaldando datos → $BACKUP_DIR/data-$STAMP.tgz"
  docker run --rm --volumes-from "$CONTAINER" -v "$BACKUP_DIR":/backup node:18-alpine \
    tar czf "/backup/data-$STAMP.tgz" -C /data --exclude=./backups .
  # Conservar los últimos 30 respaldos
  ls -1t "$BACKUP_DIR"/data-*.tgz 2>/dev/null | tail -n +31 | xargs -r rm --
  c_ok "Respaldo listo ($(du -h "$BACKUP_DIR/data-$STAMP.tgz" | cut -f1))"
else
  c_info "1/4 No hay contenedor previo; se omite respaldo"
fi

# ── 2. Código nuevo ──────────────────────────────────────────
c_info "2/4 Bajando código (git pull)"
git pull --ff-only

# ── 3. Construir imagen (el sistema sigue funcionando) ───────
c_info "3/4 Construyendo imagen nueva (el POS sigue funcionando mientras tanto)"
docker compose build

# ── 4. Reemplazar contenedor y verificar ─────────────────────
c_info "4/4 Reemplazando contenedor"
docker compose up -d --no-deps --remove-orphans

for i in $(seq 1 30); do
  if curl -fsS "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
    c_ok "¡Desplegado! El sistema ya responde en el puerto $PORT"
    docker image prune -f >/dev/null 2>&1 || true
    exit 0
  fi
  sleep 1
done

c_err "El contenedor no respondió en 30 s. Revisa: docker compose logs --tail=80"
c_err "Tus datos están a salvo en el volumen y en $BACKUP_DIR"
exit 1
