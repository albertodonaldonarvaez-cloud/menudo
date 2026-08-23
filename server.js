'use strict';
/**
 * BACKEND — Menú Digital
 * Mini servidor Node.js (sin dependencias externas) que persiste
 * la configuración del negocio en un archivo JSON compartido.
 * Todos los dispositivos leen y escriben de aquí → cambios del admin
 * se ven al instante en los celulares de los clientes.
 */
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT        = 3001;
const CONFIG_FILE = '/data/store_config.json';
const DATA_DIR    = path.dirname(CONFIG_FILE);

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readConfig() {
  ensureDir();
  if (!fs.existsSync(CONFIG_FILE)) return null;
  try { return fs.readFileSync(CONFIG_FILE, 'utf8'); } catch { return null; }
}

function writeConfig(data) {
  ensureDir();
  fs.writeFileSync(CONFIG_FILE, data, 'utf8');
}

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const server = http.createServer((req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }

  // Health check
  if (req.url === '/api/health') {
    res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' });
    return res.end('{"status":"ok"}');
  }

  // Configuración del menú
  if (req.url === '/api/config') {

    // GET — todos los dispositivos leen la config compartida
    if (req.method === 'GET') {
      const data = readConfig();
      res.writeHead(200, { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(data || '{}');
    }

    // POST — el admin guarda la config (protegido por Nginx Basic Auth en el proxy externo)
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          JSON.parse(body); // valida que sea JSON válido
          writeConfig(body);
          console.log(`[${new Date().toISOString()}] Config guardada (${body.length} bytes)`);
          res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' });
          res.end('{"ok":true}');
        } catch (e) {
          console.error('JSON inválido:', e.message);
          res.writeHead(400, { ...CORS, 'Content-Type': 'application/json' });
          res.end('{"error":"JSON inválido"}');
        }
      });
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end('{"error":"Not found"}');
});

server.listen(PORT, () => {
  console.log(`🍲 Backend Menú Digital → puerto ${PORT}`);
  console.log(`📁 Config persistente en: ${CONFIG_FILE}`);
});
