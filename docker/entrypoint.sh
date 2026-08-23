#!/bin/bash
# =============================================================
#  ENTRYPOINT — Menú Digital
#  Genera el .htpasswd con las credenciales del .env
#  y luego arranca Nginx normalmente.
# =============================================================

set -e

HTPASSWD_FILE="/etc/nginx/auth/.htpasswd"
AUTH_DIR="/etc/nginx/auth"

echo "──────────────────────────────────────────────"
echo "  🍲  Menú Digital — Iniciando contenedor..."
echo "──────────────────────────────────────────────"

# Validar variables de entorno
if [ -z "${ADMIN_USER}" ] || [ -z "${ADMIN_PASSWORD}" ]; then
    echo "❌ ERROR: ADMIN_USER y ADMIN_PASSWORD deben estar definidos."
    echo "   Verifica tu archivo .env y vuelve a intentarlo."
    exit 1
fi

# Crear directorio de auth si no existe
mkdir -p "${AUTH_DIR}"

# Generar el archivo .htpasswd (sobrescribe siempre al iniciar)
echo "🔑  Generando credenciales de acceso para el admin..."
htpasswd -bc "${HTPASSWD_FILE}" "${ADMIN_USER}" "${ADMIN_PASSWORD}"

echo "✅  Panel de administración protegido para el usuario: ${ADMIN_USER}"
echo "🌐  Nginx listo — Puerto 80 interno"
echo "──────────────────────────────────────────────"

# Arrancar el proceso pasado como CMD (nginx -g "daemon off;")
exec "$@"
