'use strict';
/**
 * BRIDGE.JS — Menudo Print Bridge v1.0
 * Polling del servidor cada 5s. Imprime ordenes nuevas en impresora termica Bluetooth.
 * 
 * Setup:
 *   1. Empareja la impresora Bluetooth con esta PC
 *   2. Nota el puerto COM asignado (ej: COM5) en Administrador de dispositivos
 *   3. Copia config.example.json -> config.json y edita los valores
 *   4. Ejecuta: npm install && npm start
 */

const { SerialPort } = require('serialport');
const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { buildTicket } = require('./escpos');

// ── Archivos ──────────────────────────────────────────────────
const CONFIG_FILE  = path.join(__dirname, 'config.json');
const PRINTED_FILE = path.join(__dirname, 'printed.json');

// ── Cargar config ─────────────────────────────────────────────
let config;
try {
  config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
} catch {
  console.error('\n❌ No se encontro config.json');
  console.error('   Copia config.example.json a config.json y edita los valores.\n');
  process.exit(1);
}

const { serverUrl, username, password, comPort, paperWidth = 58, businessName = 'Restaurante', pollMs = 5000 } = config;

// ── Estado global ─────────────────────────────────────────────
let sessionCookie = null;
let printer       = null;
let reconnecting  = false;

// ── Utilidades HTTP ───────────────────────────────────────────
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib  = url.startsWith('https') ? https : http;
    const body = options.body || null;

    const reqOptions = {
      method:  options.method || 'GET',
      headers: {
        'Content-Type': options.contentType || 'application/json',
        'Accept': 'application/json',
        ...(sessionCookie ? { Cookie: sessionCookie } : {}),
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
        ...(options.headers || {}),
      }
    };

    const req = lib.request(url, reqOptions, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = raw; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

// ── Autenticacion ──────────────────────────────────────────────
async function login() {
  log('🔐 Autenticando con el servidor...');
  try {
    // El servidor usa form-urlencoded para el login
    const body = `user=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    const res  = await httpRequest(`${serverUrl}/login`, {
      method:      'POST',
      contentType: 'application/x-www-form-urlencoded',
      body,
      headers: { 'Accept': 'text/html,application/json' }
    });

    // El servidor devuelve 302 al /caja o /admin.html y setea la cookie ahi
    const setCookie = res.headers['set-cookie'];
    if (setCookie && setCookie.length > 0) {
      sessionCookie = setCookie.map(c => c.split(';')[0]).join('; ');
      log('✅ Autenticado correctamente');
      return true;
    }

    // Si no hay cookie, intentar /api/session para verificar si ya habia sesion
    const sessionRes = await httpRequest(`${serverUrl}/api/session`);
    if (sessionRes.body?.authenticated) {
      log('✅ Sesion existente valida');
      return true;
    }

    log('❌ Error de autenticacion — verifica usuario y contrasena en config.json');
    return false;
  } catch (e) {
    log('❌ No se pudo conectar al servidor:', e.message);
    return false;
  }
}

// ── Impresora ─────────────────────────────────────────────────
async function connectPrinter() {
  if (printer && printer.isOpen) return true;
  if (reconnecting) return false;
  reconnecting = true;

  return new Promise((resolve) => {
    log(`🔌 Conectando a impresora en ${comPort}...`);
    const p = new SerialPort({ path: comPort, baudRate: 9600 }, (err) => {
      reconnecting = false;
      if (err) {
        log(`❌ No se pudo abrir ${comPort}: ${err.message}`);
        log('   Verifica que la impresora este encendida y emparejada vía Bluetooth.');
        resolve(false);
        return;
      }
      printer = p;
      log(`🖨️  Impresora lista en ${comPort} (${paperWidth}mm)`);

      printer.on('error', (e) => {
        log('⚠️  Error de impresora:', e.message);
        printer = null;
      });
      printer.on('close', () => {
        log('⚠️  Impresora desconectada');
        printer = null;
      });

      resolve(true);
    });
  });
}

async function printOrder(order) {
  const ok = await connectPrinter();
  if (!ok) return false;

  return new Promise((resolve) => {
    try {
      const ticket = buildTicket(order, { paperWidth, businessName });
      printer.write(ticket, (err) => {
        if (err) {
          log(`❌ Error al escribir en impresora: ${err.message}`);
          resolve(false);
          return;
        }
        printer.drain(() => {
          log(`✅ Impreso: Orden #${order.num} — ${order.clientName} — $${Number(order.total).toLocaleString('es-MX')}`);
          resolve(true);
        });
      });
    } catch (e) {
      log(`❌ Error construyendo ticket: ${e.message}`);
      resolve(false);
    }
  });
}

// ── Printed IDs (evita reimprimir) ────────────────────────────
function loadPrinted() {
  try { return new Set(JSON.parse(fs.readFileSync(PRINTED_FILE, 'utf8'))); }
  catch { return new Set(); }
}

function savePrinted(ids) {
  const arr = Array.from(ids).slice(-500); // max 500 IDs
  fs.writeFileSync(PRINTED_FILE, JSON.stringify(arr), 'utf8');
}

// ── Poll ──────────────────────────────────────────────────────
async function poll(printedIds) {
  try {
    const res = await httpRequest(`${serverUrl}/api/orders`);

    if (res.status === 401 || res.status === 302) {
      log('⚠️  Sesion expirada, re-autenticando...');
      sessionCookie = null;
      await login();
      return;
    }

    if (res.status !== 200 || typeof res.body !== 'object') {
      log(`⚠️  Respuesta inesperada del servidor (${res.status})`);
      return;
    }

    const orders = res.body.pendingPayment || [];

    for (const order of orders) {
      if (!printedIds.has(order.id)) {
        const printed = await printOrder(order);
        if (printed) {
          printedIds.add(order.id);
          savePrinted(printedIds);
        }
      }
    }
  } catch (e) {
    log(`⚠️  Error en poll: ${e.message}`);
  }
}

// ── Logger con timestamp ─────────────────────────────────────
function log(...args) {
  const t = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  console.log(`[${t}]`, ...args);
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  🖨️  Menudo Print Bridge v1.0');
  console.log(`  🌐  Servidor : ${serverUrl}`);
  console.log(`  🖨️  Puerto   : ${comPort}`);
  console.log(`  📄  Papel    : ${paperWidth}mm`);
  console.log(`  ⏱️  Polling  : cada ${pollMs / 1000}s`);
  console.log('══════════════════════════════════════════════\n');

  // Autenticar
  const loggedIn = await login();
  if (!loggedIn) {
    console.error('\n❌ No se pudo autenticar. Revisa config.json y que el servidor este encendido.\n');
    process.exit(1);
  }

  // Conectar impresora
  await connectPrinter();

  // Cargar IDs ya impresos
  const printedIds = loadPrinted();
  log(`📋 ${printedIds.size} ordenes ya impresas en sesiones anteriores`);

  // Primera consulta
  await poll(printedIds);

  // Polling cada N segundos
  setInterval(() => poll(printedIds), pollMs);

  log('🟢 Escuchando ordenes nuevas... (Ctrl+C para detener)\n');
}

// Manejo de Ctrl+C limpio
process.on('SIGINT', () => {
  log('\n🔴 Cerrando Print Bridge...');
  if (printer && printer.isOpen) printer.close();
  process.exit(0);
});

main().catch(e => {
  console.error('\n❌ Error fatal:', e);
  process.exit(1);
});