const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

const dbPath = path.join(__dirname, 'data', 'tienda.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS vendedores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    telefono TEXT,
    zona TEXT,
    usuario TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    comision REAL DEFAULT 10,
    activo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS productos (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    location TEXT,
    priceUSD REAL DEFAULT 0,
    priceMN REAL DEFAULT 0,
    stock INTEGER DEFAULT 0,
    image TEXT,
    descripcion TEXT,
    garantia TEXT,
    pagos TEXT,
    tipoEntrega TEXT,
    mapa TEXT,
    vendedor_id INTEGER,
    activo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vendedor_id) REFERENCES vendedores(id)
  );

  CREATE TABLE IF NOT EXISTS sesiones (
    token TEXT PRIMARY KEY,
    vendedor_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Crear admin por defecto
const adminExiste = db.prepare('SELECT id FROM vendedores WHERE usuario = ?').get('admin');
if (!adminExiste) {
  const hash = crypto.createHash('sha256').update('limonar2026').digest('hex');
  db.prepare(`
    INSERT INTO vendedores (nombre, telefono, zona, usuario, password, comision)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('Administrador', '5358956989', 'Limonar', 'admin', hash, 0);
  console.log('Usuario admin creado → usuario: admin | contraseña: limonar2026');
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function hashPassword(pass) {
  return crypto.createHash('sha256').update(pass).digest('hex');
}

function generarToken() {
  return crypto.randomBytes(32).toString('hex');
}

function obtenerVendedorDesdeToken(req) {
  const token = req.headers['authorization']?.replace('Bearer ', '') || req.query.token;
  if (!token) return null;
  const sesion = db.prepare('SELECT * FROM sesiones WHERE token = ?').get(token);
  if (!sesion) return null;
  return db.prepare('SELECT * FROM vendedores WHERE id = ? AND activo = 1').get(sesion.vendedor_id);
}

// ========== AUTH ==========
app.post('/api/login', (req, res) => {
  const { usuario, password } = req.body;
  if (!usuario || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });

  const vendedor = db.prepare('SELECT * FROM vendedores WHERE usuario = ? AND activo = 1').get(usuario);
  if (!vendedor || vendedor.password !== hashPassword(password)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  db.prepare('DELETE FROM sesiones WHERE vendedor_id = ?').run(vendedor.id);
  const token = generarToken();
  db.prepare('INSERT INTO sesiones (token, vendedor_id) VALUES (?, ?)').run(token, vendedor.id);

  res.json({
    token,
    vendedor: {
      id: vendedor.id,
      nombre: vendedor.nombre,
      zona: vendedor.zona,
      comision: vendedor.comision,
      esAdmin: vendedor.usuario === 'admin'
    }
  });
});

app.post('/api/logout', (req, res) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (token) db.prepare('DELETE FROM sesiones WHERE token = ?').run(token);
  res.json({ mensaje: 'Sesión cerrada' });
});

// ========== VENDEDORES (solo admin) ==========
app.get('/api/vendedores', (req, res) => {
  const yo = obtenerVendedorDesdeToken(req);
  if (!yo || yo.usuario !== 'admin') return res.status(403).json({ error: 'No autorizado' });
  const lista = db.prepare('SELECT id, nombre, telefono, zona, usuario, comision, activo FROM vendedores').all();
  res.json(lista);
});

app.post('/api/vendedores', (req, res) => {
  const yo = obtenerVendedorDesdeToken(req);
  if (!yo || yo.usuario !== 'admin') return res.status(403).json({ error: 'No autorizado' });

  const { nombre, telefono, zona, usuario, password, comision } = req.body;
  if (!nombre || !usuario || !password) return res.status(400).json({ error: 'Faltan datos obligatorios' });

  try {
    const result = db.prepare(`
      INSERT INTO vendedores (nombre, telefono, zona, usuario, password, comision)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(nombre, telefono || '', zona || 'Limonar', usuario, hashPassword(password), parseFloat(comision) || 10);
    res.json({ id: result.lastInsertRowid, mensaje: 'Vendedor creado' });
  } catch (err) {
    res.status(400).json({ error: 'Usuario ya existe o error' });
  }
});

// ========== PRODUCTOS ==========
app.get('/api/productos', (req, res) => {
  try {
    const productos = db.prepare(`
      SELECT p.*, v.nombre as vendedor_nombre 
      FROM productos p
      LEFT JOIN vendedores v ON p.vendedor_id = v.id
      WHERE p.activo = 1 
      ORDER BY p.created_at DESC
    `).all();
    res.json(productos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/productos/:id', (req, res) => {
  const producto = db.prepare(`
    SELECT p.*, v.nombre as vendedor_nombre 
    FROM productos p
    LEFT JOIN vendedores v ON p.vendedor_id = v.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(producto);
});

app.post('/api/productos', (req, res) => {
  const yo = obtenerVendedorDesdeToken(req);
  if (!yo) return res.status(401).json({ error: 'Debes iniciar sesión' });

  try {
    const { name, category, location, priceUSD, priceMN, stock, image, descripcion, garantia, pagos, tipoEntrega, mapa } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });

    const id = Date.now().toString();
    db.prepare(`
      INSERT INTO productos 
      (id, name, category, location, priceUSD, priceMN, stock, image, descripcion, garantia, pagos, tipoEntrega, mapa, vendedor_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, name, category || 'Otros', location || yo.zona || 'Limonar',
      parseFloat(priceUSD) || 0, parseFloat(priceMN) || 0, parseInt(stock) || 0,
      image || '', descripcion || '', garantia || '', pagos || '',
      tipoEntrega || 'Domicilio', mapa || '', yo.id
    );
    res.json({ id, mensaje: 'Producto creado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/productos/:id', (req, res) => {
  const yo = obtenerVendedorDesdeToken(req);
  if (!yo) return res.status(401).json({ error: 'Debes iniciar sesión' });

  const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
  if (!producto) return res.status(404).json({ error: 'No encontrado' });
  if (producto.vendedor_id !== yo.id && yo.usuario !== 'admin') {
    return res.status(403).json({ error: 'No puedes editar este producto' });
  }

  const f = req.body;
  db.prepare(`
    UPDATE productos SET
      name = ?, category = ?, location = ?, priceUSD = ?, priceMN = ?,
      stock = ?, image = ?, descripcion = ?, garantia = ?, pagos = ?,
      tipoEntrega = ?, mapa = ?
    WHERE id = ?
  `).run(
    f.name ?? producto.name, f.category ?? producto.category, f.location ?? producto.location,
    f.priceUSD ?? producto.priceUSD, f.priceMN ?? producto.priceMN, f.stock ?? producto.stock,
    f.image ?? producto.image, f.descripcion ?? producto.descripcion, f.garantia ?? producto.garantia,
    f.pagos ?? producto.pagos, f.tipoEntrega ?? producto.tipoEntrega, f.mapa ?? producto.mapa,
    req.params.id
  );
  res.json({ mensaje: 'Producto actualizado' });
});

app.delete('/api/productos/:id', (req, res) => {
  const yo = obtenerVendedorDesdeToken(req);
  if (!yo) return res.status(401).json({ error: 'Debes iniciar sesión' });

  const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
  if (!producto) return res.status(404).json({ error: 'No encontrado' });
  if (producto.vendedor_id !== yo.id && yo.usuario !== 'admin') {
    return res.status(403).json({ error: 'No puedes borrar este producto' });
  }

  db.prepare('UPDATE productos SET activo = 0 WHERE id = ?').run(req.params.id);
  res.json({ mensaje: 'Producto eliminado' });
});

app.get('/api/mis-productos', (req, res) => {
  const yo = obtenerVendedorDesdeToken(req);
  if (!yo) return res.status(401).json({ error: 'Debes iniciar sesión' });

  let productos;
  if (yo.usuario === 'admin') {
    productos = db.prepare('SELECT * FROM productos WHERE activo = 1 ORDER BY created_at DESC').all();
  } else {
    productos = db.prepare('SELECT * FROM productos WHERE vendedor_id = ? AND activo = 1 ORDER BY created_at DESC').all(yo.id);
  }
  res.json(productos);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Limonar Express corriendo en puerto ${PORT}`);
});
