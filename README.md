# 🍲 Menú Digital — Menudería & Antojitos

Menú digital para negocio de comida, diseñado para funcionar en red local (WiFi cautivo / QR de mesa). Incluye panel de administración protegido con contraseña para gestionar guisados del día, fotos, precios, descripciones y generar volantes publicitarios.

---

## ✨ Características

- 📋 Menú visual y responsivo para comensales (sin carrito, solo consulta)
- 🍲 Secciones: Menudo, Gorditas, Burritos y Bebidas & Café
- 🥘 Guisados del día activables/desactivables en tiempo real
- 📸 Subida de fotos reales desde el celular del administrador
- ✏️ Títulos y descripciones editables por platillo
- 🏷️ Precios configurables desde el panel admin
- 📱 Generador de Carteles QR (3 por hoja Carta) para mesas
- 📢 Generador de Volantes Publicitarios (4 por hoja Carta) para la calle
- 🔐 Panel de administración protegido con usuario y contraseña
- 🐳 Listo para Docker con puerto externo configurable

---

## 🚀 Instalación en Ubuntu Server (Recomendado)

### Opción A — Instalación automática con un solo comando

```bash
# 1. Descargar el instalador directamente desde GitHub
curl -fsSL https://raw.githubusercontent.com/albertodonaldonarvaez-cloud/menudo/main/install.sh -o install.sh

# 2. Ejecutar (pedirá puerto y contraseña de forma interactiva)
sudo bash install.sh
```

El script automáticamente:
- ✅ Instala Docker si no está instalado
- ✅ Clona el repositorio en `/opt/menudo`
- ✅ Te pregunta el puerto y la contraseña del admin
- ✅ Construye y levanta el contenedor
- ✅ Muestra la URL de acceso al finalizar

---

### Opción B — Instalación manual paso a paso

#### Requisitos previos

```bash
# Ubuntu 22.04 / 24.04 LTS
# Instalar Docker
curl -fsSL https://get.docker.com | sudo bash
sudo systemctl enable --now docker

# Instalar Git
sudo apt install -y git
```

#### Pasos

```bash
# 1. Clonar el repositorio
sudo git clone https://github.com/albertodonaldonarvaez-cloud/menudo.git /opt/menudo
cd /opt/menudo

# 2. Copiar y editar el archivo de configuración
cp .env.example .env
nano .env
```

Edita estos valores en `.env`:

```bash
PORT=8080              # Puerto externo donde escucha el menú
ADMIN_USER=admin       # Usuario del panel de administración
ADMIN_PASSWORD=tu_clave_segura   # Contraseña del panel de administración
```

```bash
# 3. Construir y levantar el contenedor
docker compose up -d --build

# 4. Verificar que está corriendo
docker compose ps
```

---

## ⚙️ Cambiar el puerto externo

```bash
cd /opt/menudo
nano .env                          # Cambia la línea PORT=8080 por el puerto deseado
docker compose up -d --force-recreate
```

---

## 🔑 Cambiar la contraseña del admin

```bash
cd /opt/menudo
nano .env                          # Cambia ADMIN_PASSWORD=nueva_contraseña
docker compose up -d --force-recreate
```

---

## 🔄 Actualizar a la última versión

```bash
cd /opt/menudo
git pull
docker compose up -d --build --force-recreate
```

---

## 🛠️ Comandos Docker útiles

```bash
# Ver estado del contenedor
docker compose ps

# Ver logs en tiempo real
docker compose logs -f

# Reiniciar el servicio
docker compose restart

# Detener
docker compose down

# Detener y eliminar la imagen (para reconstruir desde cero)
docker compose down --rmi all
docker compose up -d --build
```

---

## 🌐 Acceso al menú y al admin

Una vez instalado, puedes acceder desde cualquier dispositivo en la misma red:

| Página                  | URL                                           |
|-------------------------|-----------------------------------------------|
| 📋 Menú (comensales)    | `http://<IP-del-servidor>:<PUERTO>/`          |
| 🔐 Panel Admin          | `http://<IP-del-servidor>:<PUERTO>/admin.html` |

> Ejemplo con IP `192.168.1.100` y puerto `8080`:
> - Menú: http://192.168.1.100:8080
> - Admin: http://192.168.1.100:8080/admin.html

---

## 📶 Configuración de Portal Cautivo WiFi (opcional)

Para que tus clientes lleguen automáticamente al menú al conectarse al WiFi de tu negocio, configura el portal cautivo de tu router apuntando a:

```
http://<IP-del-servidor>:<PUERTO>/
```

Consulta el manual de tu router para activar el "Captive Portal" o "Portal de Acceso".

---

## 🔒 Seguridad

- El archivo `.env` **nunca** se sube a GitHub (está en `.gitignore`).
- El archivo `.htpasswd` se genera automáticamente dentro del contenedor al iniciar.
- Solo `/admin.html` está protegido con contraseña. El menú público es completamente libre.

---

## 📁 Estructura del Proyecto

```
menudo/
├── docker/
│   ├── nginx.conf        ← Configuración de Nginx (Basic Auth para /admin.html)
│   └── entrypoint.sh     ← Genera .htpasswd al iniciar el contenedor
├── .env                  ← Configuración local (NO subir a GitHub)
├── .env.example          ← Plantilla de configuración (sí en GitHub)
├── .gitignore
├── docker-compose.yml    ← Orquestación Docker
├── Dockerfile            ← Imagen Nginx Alpine
├── install.sh            ← Instalador automático para Ubuntu Server
├── index.html            ← Menú digital para comensales
├── admin.html            ← Panel de administración (protegido)
├── app.js                ← Lógica del menú público
├── admin.js              ← Lógica del panel de administración
├── data.js               ← Datos iniciales por defecto
└── styles.css            ← Estilos visuales y reglas de impresión
```

---

## 📄 Licencia

Proyecto privado para uso interno del negocio.
