# 🖨️ Menudo Print App — Impresión Bluetooth Automática

App Android nativa para imprimir comandas de cocina automáticamente en la impresora **SUM Print 365B** (57mm, Bluetooth).

## ✨ Qué hace

- Se conecta a la impresora **vía Bluetooth** (SPP)
- **Se queda en segundo plano** como servicio permanente
- **Revisa el servidor cada 8 segundos** buscando órdenes nuevas
- **Imprime automáticamente** las órdenes que llegan al POS
- **NO reimprime** órdenes que ya se imprimieron
- Al iniciar, ignora órdenes viejas (solo imprime las nuevas)

## 📋 Formato de impresión

```
================================
    MENUDERÍA Y BARBACOA
================================
  COMANDA #12
  Cliente: Juan Mesa 3
  Tipo: AQUÍ
  Hora: 10:47 PM
--------------------------------
  2x Menudo Tradicional
  1x Tacos de Barbacoa
  3x Refresco
--------------------------------
  TOTAL: $299
================================
```

## 🔧 Cómo compilar

### Opción 1: Android Studio (recomendado)
1. Abre Android Studio
2. File → Open → selecciona la carpeta `print-app/`
3. Espera a que Gradle sincronice
4. Build → Build APK
5. El APK estará en `app/build/outputs/apk/debug/app-debug.apk`

### Opción 2: Línea de comandos
```bash
cd print-app
./gradlew assembleDebug
```

## 📱 Cómo instalar

1. Pasa el APK al celular (USB, WhatsApp, Drive, etc.)
2. Abre el APK en el celular
3. Si pide "Instalar de fuentes desconocidas", actívalo en Ajustes
4. Instala la app "Menudo Printer"

## 🚀 Cómo usar

1. **Abre la app** "Menudo Printer"
2. **URL del servidor**: ya viene configurado `https://menudo.tecti-cloud.com`
3. **Enciende la impresora** SUM Print 365B y ponla en modo Bluetooth
4. **Vincula la impresora** en los ajustes de Bluetooth del celular (si no lo has hecho)
5. En la app, toca **"Seleccionar impresora"** → elige la SUM Print
6. Toca **"Iniciar servicio"**
7. **Listo.** La app se queda en segundo plano imprimiendo

### Prueba de impresión
- Toca **"Imprimir prueba"** para verificar que la conexión funciona

## ⚙️ Especificaciones técnicas

| Detalle | Valor |
|---|---|
| Impresora | SUM Print 365B |
| Ancho de papel | 57mm (32 caracteres/línea) |
| Protocolo | Bluetooth Classic SPP |
| Android mínimo | 8.0 (API 26) |
| Servicio | Foreground Service (no se cierra) |
| Polling | Cada 8 segundos |
| Endpoint | `GET /api/orders` |

## ❓ Solución de problemas

| Problema | Solución |
|---|---|
| "No se conecta" | Verifica que la impresora esté encendida y vinculada en Bluetooth del celular |
| "No imprime" | Verifica que el papel esté cargado y la impresora tenga batería |
| "La app se cierra" | En Ajustes del celular → Apps → Menudo Printer → Batería → Sin restricciones |
| "No encuentra la impresora" | Primero vincúlala desde Ajustes → Bluetooth del celular |
