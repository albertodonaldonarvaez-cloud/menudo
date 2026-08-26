'use strict';
/**
 * MENÚ DIGITAL — Servidor Express
 * Maneja: autenticación con sesión, API de configuración compartida,
 * y servicio de archivos estáticos protegiendo el admin.
 */
const express = require('express');
const session = require('express-session');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3001;
const ROOT = __dirname;
const CONFIG_FILE    = '/data/store_config.json';
const ADMIN_USER     = process.env.ADMIN_USER     || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const SESSION_SECRET = process.env.SESSION_SECRET || 'cambiar_esta_clave_secreta';

// ── Middlewares ───────────────────────────────────────────────
// 50mb para soportar múltiples fotos en Base64 (cada foto ~4-7mb en Base64)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,       // El HTTPS lo maneja el proxy externo
    sameSite: 'lax',
    maxAge: 10 * 60 * 60 * 1000  // 10 horas
  }
}));

// ── Helpers ───────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session?.authenticated) return next();
  // Si es una petición fetch/XHR → 401 JSON
  if (req.headers['accept']?.includes('application/json')) {
    return res.status(401).json({ error: 'Sesión expirada, vuelve a iniciar sesión.' });
  }
  res.redirect('/login');
}

function readConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return null; }
}

function writeConfig(data) {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data), 'utf8');
}

function noCache(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}

function sendFile(res, file, useNoCache = false) {
  if (useNoCache) noCache(res);
  res.sendFile(path.join(ROOT, file));
}

// ── Rutas de autenticación ────────────────────────────────────
app.get('/login', (req, res) => {
  if (req.session?.authenticated) return res.redirect('/admin.html');
  noCache(res);
  res.sendFile(path.join(ROOT, 'login.html'));
});

app.post('/login', (req, res) => {
  const { user, password } = req.body;
  if (user === ADMIN_USER && password === ADMIN_PASSWORD) {
    req.session.authenticated = true;
    req.session.user = user;
    return res.redirect('/admin.html');
  }
  res.redirect('/login?error=1');
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// ── Archivos del Admin (protegidos) ──────────────────────────
app.get('/admin.html', requireAuth, (req, res) => sendFile(res, 'admin.html', true));
app.get('/admin.js',   requireAuth, (req, res) => {
  res.set('Cache-Control', 'no-store');
  sendFile(res, 'admin.js');
});

// ── API — Subida de imágenes (una a la vez, comprimidas en cliente) ──
// POST: protegido — guarda imagen en disco
app.post('/api/upload-image', requireAuth, (req, res) => {
  try {
    const { key, image } = req.body;
    const validKeys = ['menudo', 'birria', 'tacos', 'quesadillas'];
    if (!validKeys.includes(key) || !image) {
      return res.status(400).json({ error: 'Clave o imagen inválida' });
    }
    // image llega como data URL: "data:image/jpeg;base64,/9j/..."
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const imgDir = '/data/images';
    if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

    const filename = `${key}.jpg`;
    fs.writeFileSync(path.join(imgDir, filename), buffer);
    console.log(`[${new Date().toISOString()}] Imagen guardada: ${filename} (${Math.round(buffer.length/1024)}KB)`);

    res.json({ ok: true, url: `/images/${key}` });
  } catch (e) {
    console.error('Error guardando imagen:', e);
    res.status(500).json({ error: 'No se pudo guardar la imagen' });
  }
});

// GET: público — sirve imágenes guardadas en disco
app.get('/images/:key', (req, res) => {
  const { key } = req.params;
  const validKeys = ['menudo', 'birria', 'tacos', 'quesadillas'];
  if (!validKeys.includes(key)) return res.status(404).end();

  const imgPath = path.join('/data/images', `${key}.jpg`);
  if (!fs.existsSync(imgPath)) return res.status(404).end();

  res.set('Cache-Control', 'public, max-age=86400');
  res.set('Content-Type', 'image/jpeg');
  res.sendFile(imgPath);
});

// ── API — Configuración del menú ─────────────────────────────
// GET: público (todos los celulares leen la config compartida)
app.get('/api/config', (req, res) => {
  const data = readConfig();
  res.set('Cache-Control', 'no-store');
  res.json(data || {});
});

// POST: protegido (solo el admin puede guardar)
app.post('/api/config', requireAuth, (req, res) => {
  try {
    writeConfig(req.body);
    console.log(`[${new Date().toISOString()}] Config guardada por: ${req.session.user}`);
    res.json({ ok: true });
  } catch (e) {
    console.error('Error guardando config:', e);
    res.status(500).json({ error: 'No se pudo guardar la configuración.' });
  }
});

// GET: verificar sesión (admin.js lo usa al cargar)
app.get('/api/session', (req, res) => {
  res.json({ authenticated: !!req.session?.authenticated });
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── Archivos públicos del menú ────────────────────────────────
const PUBLIC_FILES = ['index.html', 'app.js', 'data.js', 'styles.css'];
PUBLIC_FILES.forEach(file => {
  app.get(`/${file}`, (req, res) => {
    if (file.endsWith('.html')) noCache(res);
    else if (file.endsWith('.js') || file.endsWith('.css')) {
      // Assets con version string → cacheable
      res.set('Cache-Control', 'public, max-age=604800, immutable');
    }
    sendFile(res, file);
  });
});

// Raíz → index.html sin caché
app.get('/', (req, res) => {
  noCache(res);
  sendFile(res, 'index.html');
});

// 404 fallback
app.use((req, res) => {
  res.status(404).redirect('/');
});

// ── Iniciar servidor ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log('══════════════════════════════════════════');
  console.log(`  🍲  Menú Digital v2.0 corriendo en :${PORT}`);
  console.log(`  👤  Admin: ${ADMIN_USER}`);
  console.log(`  📁  Config: ${CONFIG_FILE}`);
  console.log('══════════════════════════════════════════');
});
