# =============================================================
#  DOCKERFILE — Menú Digital v2.0
#  Un solo contenedor: Express.js sirve todo (auth + API + archivos)
# =============================================================

FROM node:18-alpine

# Crear directorio de la app
WORKDIR /app

# Instalar dependencias primero (capa cacheada)
COPY package*.json ./
RUN npm install --omit=dev

# Copiar el código fuente completo
COPY . .

# Directorio de datos persistentes (se monta como volumen)
RUN mkdir -p /data

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --spider -q http://localhost:3001/api/health || exit 1

CMD ["node", "server.js"]
