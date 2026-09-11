@echo off
title Menudo Print Bridge
color 0A
echo.
echo  ==========================================
echo   Menudo Print Bridge v1.0
echo  ==========================================
echo.

REM Verificar Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: Node.js no esta instalado.
    echo  Descargalo en: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Instalar dependencias si no existen
if not exist node_modules (
    echo  Instalando dependencias...
    npm install
    echo.
)

REM Verificar config.json
if not exist config.json (
    echo  ERROR: No existe config.json
    echo  Copia config.example.json a config.json y edita los valores.
    echo.
    pause
    exit /b 1
)

echo  Iniciando... (cierra esta ventana para detener la impresion)
echo.
node bridge.js

echo.
echo  El bridge se detuvo. Presiona cualquier tecla para reiniciar.
pause >nul
start "" "%~f0"