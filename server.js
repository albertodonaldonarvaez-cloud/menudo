'use strict';
/**
 * MENÚ DIGITAL — Servidor Express v2.1
 * Dos roles: admin (acceso completo) y cajero (solo POS + transacciones)
 */
const express = require('express');
const session = require('express-session');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3001;
const ROOT = __dirname;

// ── Archivos de datos ────────────────────────────────────────
const CONFIG_FILE       = '/data/store_config.json';
const TRANSACTIONS_FILE = '/data/transactions.json';

// ── Variables de entorno ─────────────────────────────────────
const ADMIN_USER      = process.env.ADMIN_USER      || 'admin';
const ADMIN_PASSWORD  = process.env.ADMIN_PASSWORD  || 'changeme';
const CAJERO_USER     = process.env.CAJERO_USER     || 'cajero';
const CAJERO_PASSWORD = process.env.CAJERO_PASSWORD || 'caja1234';
const SESSION_SECRET  = process.env.SESSION_SECRET  || 'cambiar_esta_clave_secreta';

// ── Middlewares ───────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,     // HTTPS lo maneja el proxy externo
    sameSite: 'lax',
    maxAge: 10 * 60 * 60 * 1000  // 10 horas
  }
}));

// ── Auth middlewares ──────────────────────────────────────────
/** Cualquier usuario autenticado (admin o cajero) */
function requireAnyAuth(req, res, next) {
  if (req.session?.authenticated) return next();
  if (req.headers['accept']?.includes('application/json')) {
    return res.status(401).json({ error: 'Sesión expirada, vuelve a iniciar sesión.' });
  }
  res.redirect('/login');
}

/** Solo el rol admin */
function requireAdmin(req, res, next) {
  if (req.session?.authenticated && req.session?.role === 'admin') return next();
  if (req.headers['accept']?.includes('application/json')) {
    return res.status(403).json({ error: 'Acceso exclusivo para administradores.' });
  }
  res.redirect('/login');
}

// ── Helpers de I/O ───────────────────────────────────────────
function readJSON(file) {
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function writeJSON(file, data) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data), 'utf8');
}

function noCache(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}

function sendFile(res, file, cache = false) {
  if (!cache) noCache(res);
  res.sendFile(path.join(ROOT, file));
}

// ── Rutas de autenticación ───────────────────────────────────
app.get('/login', (req, res) => {
  if (req.session?.authenticated) {
    return res.redirect(req.session.role === 'cajero' ? '/caja' : '/admin.html');
  }
  noCache(res);
  res.sendFile(path.join(ROOT, 'login.html'));
});

app.post('/login', (req, res) => {
  const { user, password } = req.body;
  if (user === ADMIN_USER && password === ADMIN_PASSWORD) {
    req.session.authenticated = true;
    req.session.role = 'admin';
    req.session.user = user;
    return res.redirect('/admin.html');
  }
  if (user === CAJERO_USER && password === CAJERO_PASSWORD) {
    req.session.authenticated = true;
    req.session.role = 'cajero';
    req.session.user = user;
    return res.redirect('/caja');
  }
  res.redirect('/login?error=1');
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// ── Admin (solo rol admin) ────────────────────────────────────
app.get('/admin.html', requireAdmin, (req, res) => sendFile(res, 'admin.html'));
app.get('/admin.js',   requireAdmin, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(ROOT, 'admin.js'));
});

// ── Caja POS (admin o cajero) ─────────────────────────────────
app.get('/caja', requireAnyAuth, (req, res) => sendFile(res, 'caja.html'));
app.get('/caja.js', requireAnyAuth, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(ROOT, 'caja.js'));
});

// ── API — Sesión ──────────────────────────────────────────────
app.get('/api/session', (req, res) => {
  res.json({
    authenticated: !!req.session?.authenticated,
    role: req.session?.role || null,
    user: req.session?.user || null
  });
});

// ── API — Imágenes ────────────────────────────────────────────
const VALID_IMG_KEYS = ['menudo', 'birria', 'tacos', 'quesadillas'];

app.post('/api/upload-image', requireAdmin, (req, res) => {
  try {
    const { key, image } = req.body;
    if (!VALID_IMG_KEYS.includes(key) || !image) {
      return res.status(400).json({ error: 'Clave o imagen inválida' });
    }
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer     = Buffer.from(base64Data, 'base64');
    const imgDir     = '/data/images';
    if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
    const filename = `${key}.jpg`;
    fs.writeFileSync(path.join(imgDir, filename), buffer);
    console.log(`[${new Date().toISOString()}] Imagen: ${filename} (${Math.round(buffer.length/1024)}KB)`);
    res.json({ ok: true, url: `/images/${key}` });
  } catch (e) {
    console.error('Error imagen:', e);
    res.status(500).json({ error: 'No se pudo guardar la imagen' });
  }
});

app.get('/images/:key', (req, res) => {
  const { key } = req.params;
  if (!VALID_IMG_KEYS.includes(key)) return res.status(404).end();
  const imgPath = path.join('/data/images', `${key}.jpg`);
  if (!fs.existsSync(imgPath)) return res.status(404).end();
  res.set('Cache-Control', 'public, max-age=86400');
  res.set('Content-Type', 'image/jpeg');
  res.sendFile(imgPath);
});

// ── API — Configuración del menú ─────────────────────────────
app.get('/api/config', (req, res) => {
  const data = readJSON(CONFIG_FILE);
  res.set('Cache-Control', 'no-store');
  res.json(data || {});
});

app.post('/api/config', requireAdmin, (req, res) => {
  try {
    writeJSON(CONFIG_FILE, req.body);
    console.log(`[${new Date().toISOString()}] Config guardada por: ${req.session.user}`);
    res.json({ ok: true });
  } catch (e) {
    console.error('Error config:', e);
    res.status(500).json({ error: 'No se pudo guardar la configuración.' });
  }
});

// ── API — Transacciones de Caja ───────────────────────────────
/**
 * POST /api/transactions
 * Guarda una transacción individual (1 cliente).
 * Body: { id, timestamp, date, hour, items, total, paymentMethod }
 */
app.post('/api/transactions', requireAnyAuth, (req, res) => {
  try {
    const tx = req.body;
    if (!tx || !tx.id || !tx.timestamp || !Array.isArray(tx.items)) {
      return res.status(400).json({ error: 'Datos de transacción inválidos' });
    }
    const all = readJSON(TRANSACTIONS_FILE) || [];
    // Evitar duplicados por id
    const idx = all.findIndex(t => t.id === tx.id);
    if (idx >= 0) { all[idx] = tx; } else { all.push(tx); }
    writeJSON(TRANSACTIONS_FILE, all);
    console.log(`[${new Date().toISOString()}] Tx ${tx.id} | $${tx.total} | ${req.session.user}`);
    res.json({ ok: true });
  } catch (e) {
    console.error('Error tx:', e);
    res.status(500).json({ error: 'No se pudo guardar la transacción' });
  }
});

/**
 * GET /api/transactions
 * Devuelve transacciones filtradas.
 * Query params: ?date=YYYY-MM-DD | ?month=YYYY-MM | (nada = últimas 500)
 */
app.get('/api/transactions', requireAnyAuth, (req, res) => {
  try {
    const all = readJSON(TRANSACTIONS_FILE) || [];
    const { date, month } = req.query;
    let filtered = all;
    if (date)  filtered = all.filter(t => t.date === date);
    if (month) filtered = all.filter(t => t.date?.startsWith(month));
    // Orden cronológico descendente
    filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    res.set('Cache-Control', 'no-store');
    res.json(filtered);
  } catch (e) {
    console.error('Error leyendo tx:', e);
    res.status(500).json({ error: 'No se pudo leer historial' });
  }
});

/**
 * DELETE /api/transactions/:id — solo admin puede borrar
 */
app.delete('/api/transactions/:id', requireAdmin, (req, res) => {
  try {
    const all = readJSON(TRANSACTIONS_FILE) || [];
    const filtered = all.filter(t => t.id !== req.params.id);
    writeJSON(TRANSACTIONS_FILE, filtered);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo eliminar' });
  }
});

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '2.1' }));

// ── Archivos públicos del menú ────────────────────────────────
['index.html', 'app.js', 'data.js', 'styles.css'].forEach(file => {
  app.get(`/${file}`, (req, res) => {
    if (file.endsWith('.html')) noCache(res);
    sendFile(res, file, !file.endsWith('.html'));
  });
});

app.get('/', (req, res) => { noCache(res); sendFile(res, 'index.html'); });

// 404 fallback
app.use((req, res) => res.status(404).redirect('/'));

// ── Iniciar servidor ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log('══════════════════════════════════════════');
  console.log(`  🔥  Menú Digital v2.1 en :${PORT}`);
  console.log(`  👤  Admin: ${ADMIN_USER}  |  Cajero: ${CAJERO_USER}`);
  console.log(`  📁  Config: ${CONFIG_FILE}`);
  console.log(`  🧾  Transacciones: ${TRANSACTIONS_FILE}`);
  console.log('══════════════════════════════════════════');
});
