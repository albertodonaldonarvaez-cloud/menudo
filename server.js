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
// Productos por defecto + reglas de barbacoa × kilo (mismo archivo que usa el navegador)
const SHARED  = require('./data.js');

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

// ── Helpers de I/O (seguros: nunca se pierden datos) ─────────
/**
 * Lee un JSON. Si el archivo está dañado usa el respaldo .bak.
 * Si ambos están dañados LANZA error en lugar de devolver vacío:
 * así nadie sobrescribe el historial con una lista vacía.
 */
function readJSON(file) {
  for (const f of [file, file + '.bak']) {
    if (!fs.existsSync(f)) continue;
    try { return JSON.parse(fs.readFileSync(f, 'utf8')); }
    catch (e) { console.error(`⚠️  ${f} dañado: ${e.message}`); }
  }
  if (fs.existsSync(file)) throw new Error(`${path.basename(file)} dañado; no se sobrescribe para no perder datos`);
  return null;
}

/** Escritura atómica: escribe a .tmp, guarda la versión anterior como .bak y renombra. */
function writeJSON(file, data) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak');
  fs.renameSync(tmp, file);
}

// ── Respaldo diario automático dentro del volumen (/data/backups) ──
function backupData() {
  try {
    const day  = new Date().toISOString().slice(0, 10);
    const dest = path.join('/data/backups', day);
    fs.mkdirSync(dest, { recursive: true });
    [CONFIG_FILE, TRANSACTIONS_FILE, USERS_FILE, ORDERS_FILE].forEach(f => {
      if (fs.existsSync(f)) fs.copyFileSync(f, path.join(dest, path.basename(f)));
    });
    // Conservar solo los últimos 30 días
    const days = fs.readdirSync('/data/backups').filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    days.slice(0, Math.max(0, days.length - 30)).forEach(d =>
      fs.rmSync(path.join('/data/backups', d), { recursive: true, force: true }));
    console.log(`💾 Respaldo diario en ${dest}`);
  } catch (e) { console.error('Respaldo diario falló:', e.message); }
}

// ── Sesiones guardadas en disco (sobreviven a reinicios/deploys) ──
class FileSessionStore extends session.Store {
  constructor(file) {
    super();
    this.file = file;
    try { this.sessions = readJSON(file) || {}; } catch { this.sessions = {}; }
    this.timer = null;
  }
  isExpired(s) { return s?.cookie?.expires && new Date(s.cookie.expires).getTime() < Date.now(); }
  schedule(ms = 2000) { if (!this.timer) this.timer = setTimeout(() => this.flush(), ms); }
  flush() {
    clearTimeout(this.timer); this.timer = null;
    for (const [sid, s] of Object.entries(this.sessions)) if (this.isExpired(s)) delete this.sessions[sid];
    try { writeJSON(this.file, this.sessions); } catch (e) { console.error('Sesiones:', e.message); }
  }
  get(sid, cb) {
    const s = this.sessions[sid];
    if (!s || this.isExpired(s)) { delete this.sessions[sid]; return cb(null, null); }
    cb(null, JSON.parse(JSON.stringify(s)));
  }
  set(sid, sess, cb) { this.sessions[sid] = JSON.parse(JSON.stringify(sess)); this.schedule(); cb?.(null); }
  destroy(sid, cb) { delete this.sessions[sid]; this.schedule(); cb?.(null); }
  touch(sid, sess, cb) {
    if (this.sessions[sid]) { this.sessions[sid].cookie = JSON.parse(JSON.stringify(sess.cookie)); this.schedule(15000); }
    cb?.(null);
  }
}
const sessionStore = new FileSessionStore('/data/sessions.json');

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
  // Admin siempre desde .env
  if (user === ADMIN_USER && password === ADMIN_PASSWORD) {
    return { role: 'admin', username: user };
  }
  // Usuarios desde users.json (cajero / mesero / cocina)
  const users = loadUsers();
  const hashed = hashPassword(password);
  const found = users.find(u => u.username === user && u.passwordHash === hashed && u.active !== false);
  if (found) {
    return { role: found.role || 'cajero', username: found.username };
  }
  return null;
}

// ── Middlewares ───────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(session({
  store: sessionStore,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,                 // cada uso renueva las 10 h (tótem/POS no se desloguean a media jornada)
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 10 * 60 * 60 * 1000  // 10 horas
  }
}));

// ── Auth middlewares ──────────────────────────────────────────
const PRINT_API_KEY = process.env.PRINT_API_KEY || 'menudo-printer-2026';

function requireAnyAuth(req, res, next) {
  // 1. Session auth (web browser)
  if (req.session?.authenticated) return next();
  // 2. API key auth (printer app)
  if (req.headers['x-print-key'] === PRINT_API_KEY) return next();
  // 3. Not authenticated
  if (req.headers['accept']?.includes('application/json')) {
    return res.status(401).json({ error: 'Sesión expirada, vuelve a iniciar sesión.' });
  }
  res.redirect('/login');
}


// requireCajaAccess: admin + cajero + mesero (NO cocina)
function requireCajaAccess(req, res, next) {
  if (!req.session?.authenticated) {
    if (req.headers['accept']?.includes('application/json')) {
      return res.status(401).json({ error: 'Sesión expirada.' });
    }
    return res.redirect('/login');
  }
  const role = req.session?.role;
  if (role === 'cocina') {
    // Usuario de cocina no tiene acceso al POS
    if (req.headers['accept']?.includes('application/json')) {
      return res.status(403).json({ error: 'Acceso no autorizado. Usa la pantalla de Cocina.' });
    }
    return res.redirect('/cocina');
  }
  next();
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
    const role = req.session.role;
    if (role === 'admin') return res.redirect('/admin.html');
    if (role === 'cocina') return res.redirect('/cocina');
    if (role === 'totem') return res.redirect('/totem');
    return res.redirect('/caja');
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
    if (result.role === 'admin') return res.redirect('/admin.html');
    if (result.role === 'cocina') return res.redirect('/cocina');
    if (result.role === 'totem') return res.redirect('/totem');
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

// ── Caja POS (admin + cajero + mesero, NO cocina) ─────────────
app.get('/caja',    requireCajaAccess, (req, res) => sendFile(res, 'caja.html'));
app.get('/caja.js', requireCajaAccess, (req, res) => {
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

// ── API — Usuarios (solo admin) ───────────────────────────────
/**
 * GET /api/users
 * Lista de usuarios (sin contraseñas).
 */
app.get('/api/users', requireAdmin, (req, res) => {
  const users = loadUsers().map(u => ({
    username:  u.username,
    name:      u.name || '',
    role:      u.role || 'cajero',
    active:    u.active !== false,
    createdAt: u.createdAt || ''
  }));
  res.json(users);
});

/**
 * POST /api/users
 * Crea un nuevo usuario.
 * Body: { username, password, name?, role? }
 */
app.post('/api/users', requireAdmin, (req, res) => {
  const { username, password, name, role } = req.body;

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

  if (userClean === ADMIN_USER.toLowerCase()) {
    return res.status(400).json({ error: 'Ese nombre de usuario está reservado para el administrador.' });
  }

  const validRoles = ['cajero', 'mesero', 'cocina', 'totem'];
  const userRole = validRoles.includes(role) ? role : 'cajero';

  const users = loadUsers();
  if (users.find(u => u.username === userClean)) {
    return res.status(409).json({ error: `El usuario "${userClean}" ya existe.` });
  }

  const newUser = {
    username:     userClean,
    name:         (name || '').trim(),
    passwordHash: hashPassword(password),
    role:         userRole,
    active:       true,
    createdAt:    new Date().toISOString().slice(0, 10)
  };

  users.push(newUser);
  saveUsers(users);

  console.log(`[${new Date().toISOString()}] Usuario [${userRole}] creado: ${userClean} por ${req.session.user}`);
  res.json({ ok: true, username: userClean, role: userRole });
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
const VALID_IMG_KEYS = ['menudo', 'birria', 'tacos', 'quesadillas', 'refresco', 'cafe', 'pan', 'carlota', 'arrozconleche'];

function isValidImgKey(key) {
  return VALID_IMG_KEYS.includes(key) || /^extra_\d+$/.test(key);
}

app.post('/api/upload-image', requireAdmin, (req, res) => {
  try {
    const { key, image } = req.body;
    if (!isValidImgKey(key) || !image) {
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
  if (!isValidImgKey(key)) return res.status(404).end();
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
    const { clientName, orderType, items, total, printCopies } = req.body;
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
      paymentStatus: 'pendiente',
      items,
      total:         Number(total) || 0,
      printCopies:   Math.min(Math.max(parseInt(printCopies) || 1, 1), 10),
      paymentMethod: null,
      createdBy:     req.session.user || 'caja'
    };

    all.push(order);
    writeJSON(ORDERS_FILE, all);
    console.log(`[${new Date().toISOString()}] Orden #${num} ${order.id} | ${order.clientName} | ${order.orderType} | $${order.total} | ${order.printCopies} copias`);
    res.json({ ok: true, order });
  } catch (e) {
    console.error('Error orden:', e);
    res.status(500).json({ error: 'No se pudo crear la orden' });
  }
});

// ── Cola de impresión de tickets de cobro ─────────────────────
let printQueue = []; // tickets de venta pendientes de imprimir

app.post('/api/print-ticket', requireAnyAuth, (req, res) => {
  const ticket = req.body;
  ticket.printedAt = null;
  ticket.createdAt = new Date().toISOString();
  printQueue.push(ticket);
  // Mantener solo los últimos 50
  if (printQueue.length > 50) printQueue = printQueue.slice(-50);
  res.json({ ok: true });
});

app.get('/api/print-queue', (req, res) => {
  // Devuelve tickets NO impresos
  const pending = printQueue.filter(t => !t.printedAt);
  res.json({ pending });
});

app.patch('/api/print-queue/ack', (req, res) => {
  // Marca tickets como impresos
  const { ids } = req.body || {};
  if (Array.isArray(ids)) {
    printQueue.forEach(t => {
      if (ids.includes(t.orderId)) t.printedAt = new Date().toISOString();
    });
  }
  res.json({ ok: true });
});

// ── Cola de impresión de comandas adicionales ─────────────────
let comandaQueue = [];

app.post('/api/print-comanda', requireAnyAuth, (req, res) => {
  const comanda = req.body;
  comanda.printedAt = null;
  comanda.createdAt = new Date().toISOString();
  comandaQueue.push(comanda);
  if (comandaQueue.length > 50) comandaQueue = comandaQueue.slice(-50);
  console.log(`[PRINT] Comanda adicional #${comanda.num} — ${comanda.items?.length || 0} items`);
  res.json({ ok: true });
});

app.get('/api/print-comanda-queue', (req, res) => {
  const pending = comandaQueue.filter(c => !c.printedAt);
  res.json({ pending });
});

app.patch('/api/print-comanda-queue/ack', (req, res) => {
  const { ids } = req.body || {};
  if (Array.isArray(ids)) {
    comandaQueue.forEach(c => {
      if (ids.includes(c.createdAt)) c.printedAt = new Date().toISOString();
    });
  }
  res.json({ ok: true });
});

/**
 * PATCH /api/orders/:id/items
 * Edita los ítems de una orden que aún no ha sido cobrada.
 * Body: { items: [...], total: number }
 */
app.patch('/api/orders/:id/items', requireAnyAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { items, total } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'La orden debe tener al menos un ítem' });
    }
    const all = readJSON(ORDERS_FILE) || [];
    const idx = all.findIndex(o => o.id === id);
    if (idx < 0) return res.status(404).json({ error: 'Orden no encontrada' });
    if (all[idx].paymentStatus === 'cobrado') {
      return res.status(409).json({ error: 'No se puede editar una orden ya cobrada' });
    }
    all[idx].items = items;
    all[idx].total = Number(total) || 0;
    all[idx].editedAt = new Date().toISOString();
    writeJSON(ORDERS_FILE, all);
    res.json({ ok: true, order: all[idx] });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo actualizar la orden' });
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
      hour:          Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Mexico_City' }).format(new Date())),
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

// ── Tótem / Pantalla interactiva (requiere cuenta totem) ─────
function requireTotemAccess(req, res, next) {
  if (req.session?.authenticated && (req.session.role === 'totem' || req.session.role === 'admin')) return next();
  res.redirect('/login');
}
app.get('/totem', requireTotemAccess, (req, res) => { noCache(res); sendFile(res, 'totem.html'); });
app.get('/totem.html', requireTotemAccess, (req, res) => { noCache(res); sendFile(res, 'totem.html'); });
app.get('/totem.js', (req, res) => sendFile(res, 'totem.js'));

/**
 * Recalcula los ítems del tótem con los precios ACTUALES del admin.
 * El tótem es público: nunca se confía en el precio que manda el navegador.
 */
function priceTotemItems(items) {
  const cfg  = readJSON(CONFIG_FILE) || {};
  const prod = k => ({ ...(SHARED.DEFAULT_STORE_DATA.products[k] || {}), ...((cfg.products || {})[k] || {}) });
  return items.map(it => {
    const key = String(it.key || '');
    const qty = Math.max(1, Math.min(99, parseInt(it.qty) || 1));
    if (key.startsWith('birria_kilo_')) {
      const p = prod('birria');
      const priceKg = Number(p.price) || 0;
      const amount  = Math.round(Number(it.price) || 0);
      if (p.enabled === false || !priceKg) throw new Error('La barbacoa por kilo no está disponible');
      if (amount < SHARED.KILO_RULES.minAmount) throw new Error(`El mínimo de barbacoa es $${SHARED.KILO_RULES.minAmount}`);
      const grams = SHARED.kiloGramsFor(amount, priceKg);
      return { key, title: `${p.title} (${grams}g)`, emoji: p.emoji || '🥩', qty, price: amount, subtotal: amount * qty, grams };
    }
    if (key.startsWith('extra_')) {
      const ep = (cfg.extraProducts || []).find(x => 'extra_' + x.id === key);
      if (!ep || ep.enabled === false) throw new Error(`"${it.title || key}" ya no está disponible`);
      const price = Number(ep.price) || 0;
      return { key, title: ep.title, emoji: ep.emoji || '🍽️', qty, price, subtotal: price * qty };
    }
    const p = prod(key);
    if (!SHARED.DEFAULT_STORE_DATA.products[key] || p.enabled === false || p.calcMode === 'kilo') {
      throw new Error(`"${it.title || key}" ya no está disponible`);
    }
    const price = Number(p.price) || 0;
    return { key, title: p.title, emoji: p.emoji || '', qty, price, priceNote: p.priceNote || '', subtotal: price * qty };
  });
}

/**
 * POST /api/totem-order
 * Crea una orden desde el tótem/pantalla interactiva (cuenta rol totem).
 * Body: { clientName, orderType, items }  — los precios se recalculan aquí.
 */
app.post('/api/totem-order', requireTotemAccess, (req, res) => {
  try {
    const { clientName, orderType, items: rawItems } = req.body;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(400).json({ error: 'La orden debe tener al menos un ítem' });
    }
    let items;
    try { items = priceTotemItems(rawItems); }
    catch (err) { return res.status(400).json({ error: err.message, code: 'STALE_MENU' }); }
    const total = items.reduce((s, i) => s + i.subtotal, 0);

    const all = readJSON(ORDERS_FILE) || [];

    const today = new Date().toISOString().slice(0, 10);
    const todayOrders = all.filter(o => o.date === today);
    const num = todayOrders.length + 1;

    const order = {
      id:            'ord_' + Date.now(),
      num,
      clientName:    (clientName || '').trim().slice(0, 40) || `Cliente #${num}`,
      orderType:     orderType === 'llevar' ? 'llevar' : 'aqui',
      timestamp:     new Date().toISOString(),
      date:          today,
      status:        'pendiente',
      paymentStatus: 'pendiente',
      items,
      total,
      printCopies:   1,
      paymentMethod: null,
      createdBy:     'totem'
    };

    all.push(order);
    writeJSON(ORDERS_FILE, all);
    console.log(`[${new Date().toISOString()}] TOTEM Orden #${num} ${order.id} | ${order.clientName} | ${order.orderType} | $${order.total}`);
    res.json({ ok: true, order });
  } catch (e) {
    console.error('Error totem-order:', e);
    res.status(500).json({ error: 'No se pudo crear la orden' });
  }
});

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
const server = app.listen(PORT, () => {
  let userCount = '?';
  try { userCount = loadUsers().length; } catch (e) { console.error(e.message); }
  console.log('══════════════════════════════════════════');
  console.log(`  🔥  Menú Digital v2.3 en :${PORT}`);
  console.log(`  👤  Admin: ${ADMIN_USER}`);
  console.log(`  👥  Usuarios cajero en BD: ${userCount}`);
  console.log(`  📁  Config: ${CONFIG_FILE}`);
  console.log(`  🧾  Transacciones: ${TRANSACTIONS_FILE}`);
  console.log(`  🍳  Órdenes cocina: ${ORDERS_FILE}`);
  console.log(`  🔑  Usuarios: ${USERS_FILE}`);
  console.log('══════════════════════════════════════════');
  backupData();
  setInterval(backupData, 6 * 60 * 60 * 1000); // revisa cada 6 h (una carpeta por día)
});

// ── Apagado ordenado (docker stop / deploy) ──────────────────
// Node como PID 1 ignora SIGTERM si no hay handler → Docker esperaría 10 s y lo mataría.
function shutdown(signal) {
  console.log(`[${new Date().toISOString()}] ${signal}: guardando sesiones y cerrando…`);
  sessionStore.flush();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref(); // conexiones keep-alive (polling) no bloquean
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
