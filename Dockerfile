# =============================================================
#  DOCKERFILE — Menú Digital
#  Imagen: nginx:alpine (ligera ~7MB)
#  Incluye apache2-utils para generar .htpasswd en el entrypoint
# =============================================================

FROM nginx:alpine

# Instalar apache2-utils para el comando htpasswd
RUN apk add --no-cache apache2-utils bash

# Copiar archivos estáticos del sitio web
COPY index.html      /usr/share/nginx/html/index.html
COPY admin.html      /usr/share/nginx/html/admin.html
COPY app.js          /usr/share/nginx/html/app.js
COPY admin.js        /usr/share/nginx/html/admin.js
COPY data.js         /usr/share/nginx/html/data.js
COPY styles.css      /usr/share/nginx/html/styles.css

# Copiar configuración de Nginx
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copiar el script de entrypoint que genera el .htpasswd
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Exponer el puerto interno 80 (el externo se define en docker-compose.yml)
EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
