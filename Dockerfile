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

# Copiar el servidor y archivos estáticos
COPY server.js     .
COPY index.html    .
COPY admin.html    .
COPY caja.html     .
COPY login.html    .
COPY app.js        .
COPY admin.js      .
COPY caja.js       .
COPY data.js       .
COPY styles.css    .

# Directorio de datos persistentes (se monta como volumen)
RUN mkdir -p /data

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --spider -q http://localhost:3001/api/health || exit 1

CMD ["node", "server.js"]
