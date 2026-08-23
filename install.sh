#!/bin/bash
# =============================================================
#  INSTALL.SH — Instalador Automático para Ubuntu Server
#  Menú Digital con Docker
#
#  Uso:
#    chmod +x install.sh && sudo bash install.sh
# =============================================================

set -e

REPO_URL="https://github.com/albertodonaldonarvaez-cloud/menudo.git"
INSTALL_DIR="/opt/menudo"
ENV_FILE="${INSTALL_DIR}/.env"

# ── Colores ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # Sin color

header() {
    echo ""
    echo -e "${CYAN}${BOLD}════════════════════════════════════════════${NC}"
    echo -e "${CYAN}${BOLD}  🍲  Menú Digital — Instalador Automático  ${NC}"
    echo -e "${CYAN}${BOLD}════════════════════════════════════════════${NC}"
    echo ""
}

ok()   { echo -e "${GREEN}  ✅  $1${NC}"; }
info() { echo -e "${CYAN}  ℹ️   $1${NC}"; }
warn() { echo -e "${YELLOW}  ⚠️   $1${NC}"; }
err()  { echo -e "${RED}  ❌  $1${NC}"; exit 1; }
step() { echo -e "\n${BOLD}── $1 ──────────────────────────────────${NC}"; }

# ─── Verificar que se ejecuta como root ──────────────────────
check_root() {
    if [ "$EUID" -ne 0 ]; then
        err "Este script debe ejecutarse con sudo. Ejemplo: sudo bash install.sh"
    fi
}

# ─── Instalar Docker si no existe ────────────────────────────
install_docker() {
    step "1/5 Verificando Docker"
    if command -v docker &>/dev/null; then
        ok "Docker ya está instalado: $(docker --version)"
    else
        info "Instalando Docker..."
        apt-get update -qq
        apt-get install -y -qq ca-certificates curl gnupg lsb-release

        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
            | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        chmod a+r /etc/apt/keyrings/docker.gpg

        echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
            | tee /etc/apt/sources.list.d/docker.list > /dev/null

        apt-get update -qq
        apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
            docker-buildx-plugin docker-compose-plugin

        systemctl enable --now docker
        ok "Docker instalado correctamente: $(docker --version)"
    fi

    # Verificar docker compose
    if docker compose version &>/dev/null; then
        ok "Docker Compose disponible: $(docker compose version)"
    else
        err "Docker Compose no está disponible. Revisa la instalación de Docker."
    fi
}

# ─── Instalar Git si no existe ───────────────────────────────
install_git() {
    step "2/5 Verificando Git"
    if command -v git &>/dev/null; then
        ok "Git ya está instalado: $(git --version)"
    else
        info "Instalando Git..."
        apt-get install -y -qq git
        ok "Git instalado."
    fi
}

# ─── Clonar o actualizar repositorio ─────────────────────────
clone_or_update_repo() {
    step "3/5 Descargando código del Menú Digital"
    if [ -d "${INSTALL_DIR}/.git" ]; then
        warn "El directorio ${INSTALL_DIR} ya existe. Actualizando..."
        git -C "${INSTALL_DIR}" pull
        ok "Código actualizado."
    else
        info "Clonando repositorio en ${INSTALL_DIR}..."
        git clone "${REPO_URL}" "${INSTALL_DIR}"
        ok "Repositorio clonado."
    fi
}

# ─── Configuración interactiva (.env) ────────────────────────
configure_env() {
    step "4/5 Configuración del Menú Digital"

    echo ""
    echo -e "${BOLD}  Ingresa la configuración para tu servidor:${NC}"
    echo ""

    # Puerto externo
    read -p "  🌐  Puerto externo del servidor [por defecto: 8080]: " input_port
    PORT="${input_port:-8080}"

    # Usuario admin
    read -p "  👤  Usuario del panel de administración [por defecto: admin]: " input_user
    ADMIN_USER="${input_user:-admin}"

    # Contraseña admin (oculta)
    while true; do
        read -s -p "  🔑  Contraseña del panel de administración: " input_pass
        echo ""
        if [ -z "${input_pass}" ]; then
            warn "La contraseña no puede estar vacía. Inténtalo de nuevo."
        else
            read -s -p "  🔑  Confirma la contraseña: " input_pass2
            echo ""
            if [ "${input_pass}" = "${input_pass2}" ]; then
                ADMIN_PASSWORD="${input_pass}"
                break
            else
                warn "Las contraseñas no coinciden. Inténtalo de nuevo."
            fi
        fi
    done

    # Escribir el .env
    cat > "${ENV_FILE}" <<EOF
# Menú Digital — Configuración generada por install.sh
# Edita este archivo y ejecuta: docker compose up -d --force-recreate

PORT=${PORT}
ADMIN_USER=${ADMIN_USER}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
EOF

    ok ".env generado en ${ENV_FILE}"
    info "  Puerto seleccionado:  ${PORT}"
    info "  Usuario admin:        ${ADMIN_USER}"
}

# ─── Construir y levantar Docker ─────────────────────────────
start_containers() {
    step "5/5 Construyendo y levantando el contenedor"

    cd "${INSTALL_DIR}"

    # Detener contenedor previo si existe
    if docker compose ps --quiet 2>/dev/null | grep -q .; then
        info "Deteniendo instancia anterior..."
        docker compose down
    fi

    info "Construyendo imagen Docker..."
    docker compose build --no-cache

    info "Iniciando contenedor..."
    docker compose up -d

    # Esperar a que el healthcheck pase
    sleep 3

    if docker compose ps | grep -q "healthy\|Up"; then
        ok "¡Contenedor corriendo correctamente!"
    else
        warn "El contenedor tardó más de lo esperado. Verifica con: docker compose logs -f"
    fi
}

# ─── Resumen final ───────────────────────────────────────────
print_summary() {
    LOCAL_IP=$(hostname -I | awk '{print $1}')
    PORT_VAL=$(grep "^PORT=" "${ENV_FILE}" | cut -d= -f2)
    USER_VAL=$(grep "^ADMIN_USER=" "${ENV_FILE}" | cut -d= -f2)

    echo ""
    echo -e "${GREEN}${BOLD}════════════════════════════════════════════${NC}"
    echo -e "${GREEN}${BOLD}  🎉  ¡Instalación completada con éxito!    ${NC}"
    echo -e "${GREEN}${BOLD}════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  📋  ${BOLD}Menú Digital (clientes):${NC}"
    echo -e "       http://${LOCAL_IP}:${PORT_VAL}"
    echo ""
    echo -e "  🔐  ${BOLD}Panel de Administración:${NC}"
    echo -e "       http://${LOCAL_IP}:${PORT_VAL}/admin.html"
    echo -e "       Usuario: ${USER_VAL}"
    echo ""
    echo -e "  📂  ${BOLD}Directorio de instalación:${NC}  ${INSTALL_DIR}"
    echo ""
    echo -e "  🛠️   ${BOLD}Comandos útiles:${NC}"
    echo -e "       Ver logs:      cd ${INSTALL_DIR} && docker compose logs -f"
    echo -e "       Reiniciar:     cd ${INSTALL_DIR} && docker compose restart"
    echo -e "       Detener:       cd ${INSTALL_DIR} && docker compose down"
    echo -e "       Actualizar:    cd ${INSTALL_DIR} && git pull && docker compose up -d --build"
    echo ""
    echo -e "  ⚙️   Para cambiar el puerto o la contraseña:"
    echo -e "       nano ${ENV_FILE}"
    echo -e "       docker compose up -d --force-recreate"
    echo ""
    echo -e "${CYAN}  ¡Buen provecho! 🍲${NC}"
    echo ""
}

# ─── Ejecutar pasos en orden ─────────────────────────────────
header
check_root
install_docker
install_git
clone_or_update_repo
configure_env
start_containers
print_summary
