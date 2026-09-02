'use strict';
/**
 * MENÚ DIGITAL — Servidor Express v2.2
 * Roles: admin (acceso completo) y cajero (solo POS + transacciones)
 * Usuarios cajero gestionados desde el admin — guardados en /data/users.json
 */
const express = require('express');
const session = require('express-session');
const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3001;
const ROOT = __dirname;

// ── Archivos de datos ────────────────────────────────────────
const CONFIG_FILE       = '/data/store_config.json';
const TRANSACTIONS_FILE = '/data/transactions.json';
const USERS_FILE        = '/data/users.json';
const ORDERS_FILE       = '/data/orders.json';

// ── Variables de entorno ─────────────────────────────────────
const ADMIN_USER     = process.env.ADMIN_USER     || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const SESSION_SECRET = process.env.SESSION_SECRET || 'cambiar_esta_clave_secreta';

// ── Helpers de I/O ───────────────────────────────────────────
function readJSON(file) {
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function writeJSON(file, data) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// ── Gestión de usuarios cajero ───────────────────────────────
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'menudo_salt_v1').digest('hex');
}

function loadUsers() {
  return readJSON(USERS_FILE) || [];
}

function saveUsers(users) {
  writeJSON(USERS_FILE, users);
}

/**
 * Verifica credenciales. Retorna { role, username } o null.
 */
function checkCredentials(user, password) {
  // Admin siempre desde .env (no editable desde UI)
  if (user === ADMIN_USER && password === ADMIN_PASSWORD) {
    return { role: 'admin', username: user };
  }
  // Usuarios cajero desde users.json
  const users = loadUsers();
  const hashed = hashPassword(password);
  const found = users.find(u => u.username === user && u.passwordHash === hashed && u.active !== false);
  if (found) {
    return { role: 'cajero', username: found.username };
  }
  return null;
}

// ── Middlewares ───────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 10 * 60 * 60 * 1000  // 10 horas
  }
}));

// ── Auth middlewares ──────────────────────────────────────────
function requireAnyAuth(req, res, next) {
  if (req.session?.authenticated) return next();
  if (req.headers['accept']?.includes('application/json')) {
    return res.status(401).json({ error: 'Sesión expirada, vuelve a iniciar sesión.' });
  }
  res.redirect('/login');
}

function requireAdmin(req, res, next) {
  if (req.session?.authenticated && req.session?.role === 'admin') return next();
  if (req.headers['accept']?.includes('application/json')) {
    return res.status(403).json({ error: 'Acceso exclusivo para administradores.' });
  }
  res.redirect('/login');
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
  const result = checkCredentials(user?.trim(), password);
  if (result) {
    req.session.authenticated = true;
    req.session.role = result.role;
    req.session.user = result.username;
    return res.redirect(result.role === 'cajero' ? '/caja' : '/admin.html');
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
app.get('/caja',    requireAnyAuth, (req, res) => sendFile(res, 'caja.html'));
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

// ── API — Usuarios cajero (solo admin) ───────────────────────
/**
 * GET /api/users
 * Lista de usuarios cajero (sin contraseñas).
 */
app.get('/api/users', requireAdmin, (req, res) => {
  const users = loadUsers().map(u => ({
    username: u.username,
    name:     u.name || '',
    active:   u.active !== false,
    createdAt: u.createdAt || ''
  }));
  res.json(users);
});

/**
 * POST /api/users
 * Crea un nuevo usuario cajero.
 * Body: { username, password, name? }
 */
app.post('/api/users', requireAdmin, (req, res) => {
  const { username, password, name } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos.' });
  }

  const userClean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (userClean.length < 3) {
    return res.status(400).json({ error: 'El usuario debe tener al menos 3 caracteres (solo letras, números y _).' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres.' });
  }

  // No puede usar el mismo username que el admin
  if (userClean === ADMIN_USER.toLowerCase()) {
    return res.status(400).json({ error: 'Ese nombre de usuario está reservado para el administrador.' });
  }

  const users = loadUsers();
  if (users.find(u => u.username === userClean)) {
    return res.status(409).json({ error: `El usuario "${userClean}" ya existe.` });
  }

  const newUser = {
    username:     userClean,
    name:         (name || '').trim(),
    passwordHash: hashPassword(password),
    role:         'cajero',
    active:       true,
    createdAt:    new Date().toISOString().slice(0, 10)
  };

  users.push(newUser);
  saveUsers(users);

  console.log(`[${new Date().toISOString()}] Usuario cajero creado: ${userClean} por ${req.session.user}`);
  res.json({ ok: true, username: userClean });
});

/**
 * PATCH /api/users/:username
 * Activa o desactiva un usuario, o cambia la contraseña.
 * Body: { active?: boolean, password?: string }
 */
app.patch('/api/users/:username', requireAdmin, (req, res) => {
  const { username } = req.params;
  const users = loadUsers();
  const idx = users.findIndex(u => u.username === username);
  if (idx < 0) return res.status(404).json({ error: 'Usuario no encontrado.' });

  if (typeof req.body.active === 'boolean') {
    users[idx].active = req.body.active;
  }
  if (req.body.password) {
    if (req.body.password.length < 4) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres.' });
    }
    users[idx].passwordHash = hashPassword(req.body.password);
  }

  saveUsers(users);
  console.log(`[${new Date().toISOString()}] Usuario ${username} actualizado por ${req.session.user}`);
  res.json({ ok: true });
});

/**
 * DELETE /api/users/:username
 * Elimina un usuario cajero.
 */
app.delete('/api/users/:username', requireAdmin, (req, res) => {
  const { username } = req.params;
  const users = loadUsers();
  const filtered = users.filter(u => u.username !== username);
  if (filtered.length === users.length) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }
  saveUsers(filtered);
  console.log(`[${new Date().toISOString()}] Usuario ${username} eliminado por ${req.session.user}`);
  res.json({ ok: true });
});

// ── API — Imágenes ────────────────────────────────────────────
const VALID_IMG_KEYS = ['menudo', 'birria', 'tacos', 'quesadillas', 'refresco', 'cafe', 'pan'];

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
app.post('/api/transactions', requireAnyAuth, (req, res) => {
  try {
    const tx = req.body;
    if (!tx || !tx.id || !tx.timestamp || !Array.isArray(tx.items)) {
      return res.status(400).json({ error: 'Datos de transacción inválidos' });
    }
    const all = readJSON(TRANSACTIONS_FILE) || [];
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

app.get('/api/transactions', requireAnyAuth, (req, res) => {
  try {
    const all = readJSON(TRANSACTIONS_FILE) || [];
    const { date, month } = req.query;
    let filtered = all;
    if (date)  filtered = all.filter(t => t.date === date);
    if (month) filtered = all.filter(t => t.date?.startsWith(month));
    filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    res.set('Cache-Control', 'no-store');
    res.json(filtered);
  } catch (e) {
    res.status(500).json({ error: 'No se pudo leer historial' });
  }
});

app.delete('/api/transactions/:id', requireAdmin, (req, res) => {
  try {
    const all = readJSON(TRANSACTIONS_FILE) || [];
    writeJSON(TRANSACTIONS_FILE, all.filter(t => t.id !== req.params.id));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo eliminar' });
  }
});

// ── Módulo de Cocina ─────────────────────────────────────────
app.get('/cocina',    requireAnyAuth, (req, res) => sendFile(res, 'cocina.html'));
app.get('/cocina.js', requireAnyAuth, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(ROOT, 'cocina.js'));
});

// ── API — Órdenes de Cocina ───────────────────────────────────

/**
 * GET /api/orders
 * Retorna: active (cocina), doneToday, pendingPayment (por cobrar en caja).
 */
app.get('/api/orders', requireAnyAuth, (req, res) => {
  try {
    const all = readJSON(ORDERS_FILE) || [];
    const today = new Date().toISOString().slice(0, 10);
    const active = all.filter(o => o.status !== 'listo' && o.status !== 'archivado');
    const doneToday = all
      .filter(o => (o.status === 'listo' || o.status === 'archivado') && o.date === today)
      .slice(-30);
    // Órdenes de hoy sin cobrar (para la tab "Por Cobrar" del POS)
    const pendingPayment = all
      .filter(o => o.paymentStatus === 'pendiente' && o.date === today)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    res.set('Cache-Control', 'no-store');
    res.json({ active, doneToday, pendingPayment });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo leer órdenes' });
  }
});

/**
 * POST /api/orders
 * Crea una orden nueva desde el POS.
 * Body: { clientName, orderType, items, total }
 */
app.post('/api/orders', requireAnyAuth, (req, res) => {
  try {
    const { clientName, orderType, items, total } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'La orden debe tener al menos un ítem' });
    }
    const all = readJSON(ORDERS_FILE) || [];

    const today = new Date().toISOString().slice(0, 10);
    const todayOrders = all.filter(o => o.date === today);
    const num = todayOrders.length + 1;

    const order = {
      id:            'ord_' + Date.now(),
      num,
      clientName:    (clientName || '').trim() || `Cliente #${num}`,
      orderType:     orderType === 'llevar' ? 'llevar' : 'aqui',
      timestamp:     new Date().toISOString(),
      date:          today,
      status:        'pendiente',
      paymentStatus: 'pendiente',   // se marca 'cobrado' con PATCH /pay
      items,
      total:         Number(total) || 0,
      paymentMethod: null,
      createdBy:     req.session.user || 'caja'
    };

    all.push(order);
    writeJSON(ORDERS_FILE, all);
    console.log(`[${new Date().toISOString()}] Orden #${num} ${order.id} | ${order.clientName} | ${order.orderType} | $${order.total}`);
    res.json({ ok: true, order });
  } catch (e) {
    console.error('Error orden:', e);
    res.status(500).json({ error: 'No se pudo crear la orden' });
  }
});

/**
 * PATCH /api/orders/:id/status
 * Cambia el estado de una orden.
 * Body: { status: 'en_prep' | 'listo' | 'pendiente' }
 */
app.patch('/api/orders/:id/status', requireAnyAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['pendiente', 'en_prep', 'listo', 'archivado'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    const all = readJSON(ORDERS_FILE) || [];
    const idx = all.findIndex(o => o.id === id);
    if (idx < 0) return res.status(404).json({ error: 'Orden no encontrada' });

    all[idx].status = status;
    if (status === 'listo') all[idx].completedAt = new Date().toISOString();
    writeJSON(ORDERS_FILE, all);
    res.json({ ok: true, order: all[idx] });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo actualizar la orden' });
  }
});

/**
 * DELETE /api/orders/clear-done
 * Limpia órdenes archivadas de más de 3 días.
 */
app.delete('/api/orders/clear-done', requireAdmin, (req, res) => {
  try {
    const all = readJSON(ORDERS_FILE) || [];
    const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const kept = all.filter(o => !(o.status === 'archivado' && o.date < cutoff));
    writeJSON(ORDERS_FILE, kept);
    res.json({ ok: true, removed: all.length - kept.length });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo limpiar' });
  }
});

/**
 * PATCH /api/orders/:id/pay
 * Cobra una orden pendiente: guarda método de pago y registra transacción.
 * Body: { paymentMethod: 'efectivo' | 'tarjeta' | 'transferencia' }
 */
app.patch('/api/orders/:id/pay', requireAnyAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod } = req.body;
    if (!['efectivo', 'tarjeta', 'transferencia'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Método de pago inválido' });
    }

    const all = readJSON(ORDERS_FILE) || [];
    const idx = all.findIndex(o => o.id === id);
    if (idx < 0) return res.status(404).json({ error: 'Orden no encontrada' });

    const order = all[idx];
    if (order.paymentStatus === 'cobrado') {
      return res.status(409).json({ error: 'Esta orden ya fue cobrada' });
    }

    const now = new Date().toISOString();
    order.paymentStatus = 'cobrado';
    order.paymentMethod  = paymentMethod;
    order.paidAt         = now;

    writeJSON(ORDERS_FILE, all);

    // Registrar en transactions.json
    const tx = {
      id:            'tx_' + Date.now(),
      timestamp:     now,
      date:          order.date,
      hour:          new Date().getHours(),
      clientName:    order.clientName || null,
      orderType:     order.orderType || null,
      orderId:       order.id,
      items:         (order.items || []).map(it => ({
        key:      it.key,
        title:    it.title,
        price:    it.price,
        qty:      it.qty,
        subtotal: it.subtotal || (it.price * it.qty)
      })),
      total:         order.total,
      paymentMethod
    };

    const txAll = readJSON(TRANSACTIONS_FILE) || [];
    txAll.push(tx);
    writeJSON(TRANSACTIONS_FILE, txAll);

    console.log(`[${now}] Cobrado: ${order.id} | ${order.clientName} | $${order.total} | ${paymentMethod} | ${req.session.user}`);
    res.json({ ok: true, transaction: tx });
  } catch (e) {
    console.error('Error al cobrar:', e);
    res.status(500).json({ error: 'No se pudo procesar el cobro' });
  }
});

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '2.4' }));

// ── Archivos públicos del menú ────────────────────────────────
['index.html', 'app.js', 'data.js', 'styles.css', 'manifest.json', 'sw.js', 'icon.svg'].forEach(file => {
  app.get(`/${file}`, (req, res) => {
    if (file.endsWith('.html')) noCache(res);
    // service worker y manifest sin caché agresiva
    if (file === 'sw.js' || file === 'manifest.json') noCache(res);
    sendFile(res, file, !file.endsWith('.html') && file !== 'sw.js' && file !== 'manifest.json');
  });
});

app.get('/', (req, res) => { noCache(res); sendFile(res, 'index.html'); });

// 404 fallback
app.use((req, res) => res.status(404).redirect('/'));

// ── Iniciar servidor ─────────────────────────────────────────
app.listen(PORT, () => {
  const userCount = loadUsers().length;
  console.log('══════════════════════════════════════════');
  console.log(`  🔥  Menú Digital v2.3 en :${PORT}`);
  console.log(`  👤  Admin: ${ADMIN_USER}`);
  console.log(`  👥  Usuarios cajero en BD: ${userCount}`);
  console.log(`  📁  Config: ${CONFIG_FILE}`);
  console.log(`  🧾  Transacciones: ${TRANSACTIONS_FILE}`);
  console.log(`  🍳  Órdenes cocina: ${ORDERS_FILE}`);
  console.log(`  🔑  Usuarios: ${USERS_FILE}`);
  console.log('══════════════════════════════════════════');
});
