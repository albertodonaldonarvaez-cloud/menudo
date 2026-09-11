# 🖨️ Menudo Print Bridge

Imprime comandas de cocina automáticamente en una impresora térmica Bluetooth cuando se envía una orden desde el POS.

## Funcionamiento

```
POS Web → Servidor → [Print Bridge] → Impresora Térmica Bluetooth
                         ↑ polling cada 5s
```

## Requisitos

- **Node.js 16+** — https://nodejs.org/
- **PC/Laptop con Bluetooth** (o adaptador USB Bluetooth)
- **Impresora térmica Bluetooth** (58mm o 80mm, compatible ESC/POS)

---

## Setup en Windows

### Paso 1 — Emparejar la impresora Bluetooth
1. Enciende la impresora térmica
2. Ve a `Configuración → Bluetooth` en Windows
3. Agrega la impresora (aparece como "RPP02", "Printer-XXX" o similar)
4. Ve a `Panel de control → Hardware y sonido → Dispositivos e impresoras`
5. Clic derecho en la impresora → `Propiedades de Bluetooth`
6. En la pestaña **Servicios**, activa el puerto COM de entrada/salida
7. Anota el número de **puerto COM** (ej: `COM5`)

### Paso 2 — Configurar el bridge
```bash
# En esta carpeta:
copy config.example.json config.json
```
Edita `config.json` con:
- `serverUrl` — la URL de tu servidor
- `username` / `password` — credenciales del POS
- `comPort` — el puerto COM de la impresora (ej: `"COM5"`)
- `paperWidth` — `58` o `80` según tu rollo de papel

### Paso 3 — Iniciar
```bash
npm install
npm start
```
O simplemente doble clic en **`start.bat`**

---

## Setup en Linux / Raspberry Pi

```bash
# Emparejar la impresora
bluetoothctl
> scan on
> pair XX:XX:XX:XX:XX:XX   (MAC de tu impresora)
> trust XX:XX:XX:XX:XX:XX
> quit

# Crear puerto serial virtual
sudo rfcomm bind 0 XX:XX:XX:XX:XX:XX

# En config.json usar: "comPort": "/dev/rfcomm0"
```

Para que inicie al arrancar (systemd):
```bash
# Crear archivo: /etc/systemd/system/menudo-print.service
[Unit]
Description=Menudo Print Bridge
After=bluetooth.target network.target

[Service]
Type=simple
WorkingDirectory=/ruta/a/print-bridge
ExecStart=/usr/bin/node bridge.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target

sudo systemctl enable menudo-print
sudo systemctl start menudo-print
```

---

## Para iniciar automáticamente en Windows (al encender la PC)

1. Clic derecho en `start.bat` → `Crear acceso directo`
2. Presiona `Win + R` → escribe `shell:startup` → Enter
3. Mueve el acceso directo a esa carpeta

---

## Solución de problemas

| Síntoma | Causa | Solución |
|---------|-------|----------|
| `No se pudo abrir COM5` | Impresora apagada o no emparejada | Enciende la impresora y verifica el emparejamiento BT |
| `Error de autenticación` | Usuario/contraseña incorrecto | Revisa `config.json` |
| `No se pudo conectar al servidor` | Servidor caído o URL incorrecta | Verifica que `https://menudo.tecti-cloud.com` responda |
| Imprime caracteres raros | Encoding incorrecto | El archivo `escpos.js` limpia caracteres especiales automáticamente |
| No imprime ordenes viejas | Normal | Solo imprime órdenes desde que se inició el bridge (no reimprimir) |

---

## Formato del ticket impreso (ejemplo 58mm)

```
--------------------------------
  RESTAURANTE
--------------------------------
** PARA LLEVAR **

Orden #12  2:30 PM

NOMBRE CLIENTE
--------------------------------
2x Menudo plato          $160
1x Refresco               $20
--------------------------------
               $180
```