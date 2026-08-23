# =============================================================
#  DOCKERFILE — Menú Digital
#  Imagen: nginx:alpine (ligera ~7MB)
#  Incluye apache2-utils para generar .htpasswd en el entrypoint
# =============================================================

FROM nginx:alpine

# Instalar apache2-utils para el comando htpasswd
RUN apk add --no-cache apache2-utils bash

# Copiar TODOS los archivos estáticos del sitio web de una vez
# (se evita olvidar archivos nuevos al actualizar)
COPY --chown=nginx:nginx \
     index.html \
     admin.html \
     app.js \
     admin.js \
     data.js \
     styles.css \
     /usr/share/nginx/html/

# Copiar configuración de Nginx
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copiar el script de entrypoint que genera el .htpasswd
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Exponer el puerto interno 80 (el externo se define en docker-compose.yml)
EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
