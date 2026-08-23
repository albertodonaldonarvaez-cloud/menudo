#!/bin/bash
# =============================================================
#  ENTRYPOINT — Menú Digital (simplificado sin htpasswd)
#  La autenticación del admin la maneja el Nginx del proxy externo.
# =============================================================

set -e

echo "──────────────────────────────────────────────"
echo "  🍲  Menú Digital — Iniciando contenedor..."
echo "  ℹ️   Autenticación del admin: gestionada por el proxy externo"
echo "──────────────────────────────────────────────"

echo "🌐  Nginx listo — Puerto 80 interno"
echo "──────────────────────────────────────────────"

exec "$@"
