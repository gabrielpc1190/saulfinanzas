/**
 * Servidor API REST Nivel 2 (SQLite Server-Side)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const cookie = require('cookie');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();

const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'finanzas.sqlite');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// --- Asegurar directorio data ---
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// --- Inicializar DB SQLite ---
const db = new sqlite3.Database(DB_FILE);

function initDB() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS transacciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha TEXT, tipo TEXT, categoria TEXT, monto REAL, descripcion TEXT
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS configuracion (clave TEXT PRIMARY KEY, valor TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS categorias (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT, tipo TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS presupuestos_categoria (id INTEGER PRIMARY KEY AUTOINCREMENT, categoria TEXT UNIQUE, limite REAL DEFAULT 0)`);
        db.run(`CREATE TABLE IF NOT EXISTS sobres (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT UNIQUE, saldo REAL DEFAULT 0, icono TEXT)`);

        // Datos iniciales si está vacía
        db.get("SELECT count(*) as count FROM categorias", (err, row) => {
            if (!row || row.count === 0) {
                const stmt = db.prepare("INSERT INTO categorias (nombre, tipo) VALUES (?, ?)");
                const cats = [['Comida', 'gasto'], ['Transporte', 'gasto'], ['Salario', 'ingreso'], ['Otros', 'gasto']];
                cats.forEach(c => stmt.run(c));
                stmt.finalize();
            }
        });
    });
    console.log('[DB] Base de datos SQLite inicializada en servidor');
}
initDB();

// --- Auth System (Users & Sessions) ---
const DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';
let users = {};
let sessions = {};

if (fs.existsSync(USERS_FILE)) users = JSON.parse(fs.readFileSync(USERS_FILE));
else {
    users = { admin: { username: 'admin', passwordHash: bcrypt.hashSync(DEFAULT_PASSWORD, 10) } };
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

if (fs.existsSync(SESSIONS_FILE)) sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE));

function saveSessions() { fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2)); }

function getSession(req) {
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies.auth_token;
    return (token && sessions[token]) ? sessions[token] : null;
}

// --- Helpers ---
const MIME_TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

function parseJSON(req) {
    return new Promise(resolve => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try { resolve(JSON.parse(body)); } catch { resolve({}); }
        });
    });
}

function sendJSON(res, data, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

// --- Servidor HTTP ---
const server = http.createServer(async (req, res) => {
    // Security Headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // 1. Validar Sesión para API (excepto login)
    const url = req.url.split('?')[0];
    const method = req.method;

    // Rutas públicas de API
    if (url === '/api/login' && method === 'POST') return handleLogin(req, res);

    // Rutas protegidas de API
    if (url.startsWith('/api/')) {
        const session = getSession(req);
        if (!session) return sendJSON(res, { error: 'Unauthorized' }, 401);

        // API Router
        if (url === '/api/me') return sendJSON(res, { username: session.username });
        if (url === '/api/logout') return handleLogout(req, res);

        // --- TRANSACTIONS ---
        if (url === '/api/transactions') {
            if (method === 'GET') {
                // Filtros mes/año
                db.all("SELECT * FROM transacciones ORDER BY fecha DESC, id DESC", (err, rows) => {
                    if (err) return sendJSON(res, { error: err.message }, 500);
                    sendJSON(res, rows);
                });
                return;
            }
            if (method === 'POST') {
                const data = await parseJSON(req);
                const { fecha, tipo, categoria, monto, descripcion } = data;
                db.run("INSERT INTO transacciones (fecha, tipo, categoria, monto, descripcion) VALUES (?,?,?,?,?)",
                    [fecha, tipo, categoria, monto, descripcion],
                    function (err) {
                        if (err) return sendJSON(res, { error: err.message }, 500);
                        sendJSON(res, { id: this.lastID, success: true });
                    }
                );
                return;
            }
        }

        if (url.startsWith('/api/transactions/') && method === 'DELETE') {
            const id = url.split('/').pop();
            db.run("DELETE FROM transacciones WHERE id = ?", [id], (err) => {
                if (err) return sendJSON(res, { error: err.message }, 500);
                sendJSON(res, { success: true });
            });
            return;
        }

        // --- STATS / DASHBOARD ---
        if (url === '/api/stats') {
            db.all("SELECT tipo, SUM(monto) as total FROM transacciones GROUP BY tipo", (err, rows) => {
                let income = 0, expense = 0;
                rows.forEach(r => {
                    if (r.tipo === 'ingreso') income = r.total;
                    if (r.tipo === 'gasto') expense = r.total;
                });
                sendJSON(res, { income, expense, balance: income - expense });
            });
            return;
        }

        // --- CATEGORIES ---
        if (url === '/api/categories') {
            db.all("SELECT * FROM categorias ORDER BY nombre", (err, rows) => {
                if (err) return sendJSON(res, { error: err.message }, 500);
                sendJSON(res, rows);
            });
            return;
        }

        // --- SAVINGS (SOBRES) ---
        if (url === '/api/savings') {
            if (method === 'GET') {
                db.all("SELECT * FROM sobres ORDER BY nombre", (err, rows) => {
                    if (err) return sendJSON(res, { error: err.message }, 500);
                    sendJSON(res, rows || []);
                });
                return;
            }
            if (method === 'POST') {
                const data = await parseJSON(req);
                const { nombre, icono } = data;
                if (!nombre) return sendJSON(res, { error: 'Nombre requerido' }, 400);

                // Crear sobre con saldo 0 (no se permite saldo inicial para mantener integridad contable)
                db.run("INSERT INTO sobres (nombre, saldo, icono) VALUES (?, 0, ?)",
                    [nombre, icono || '💰'],
                    function (err) {
                        if (err) {
                            if (err.message.includes('UNIQUE')) {
                                return sendJSON(res, { error: 'Ya existe un sobre con ese nombre' }, 400);
                            }
                            return sendJSON(res, { error: err.message }, 500);
                        }
                        sendJSON(res, { id: this.lastID, success: true });
                    }
                );
                return;
            }
        }

        // Operaciones en un sobre específico
        const savingsMatch = url.match(/^\/api\/savings\/(\d+)(\/(\w+))?$/);
        if (savingsMatch) {
            const envelopeId = savingsMatch[1];
            const action = savingsMatch[3]; // deposit, withdraw, o undefined

            if (method === 'DELETE' && !action) {
                // Eliminar sobre (solo si saldo es 0)
                db.get("SELECT saldo FROM sobres WHERE id = ?", [envelopeId], (err, row) => {
                    if (err) return sendJSON(res, { error: err.message }, 500);
                    if (!row) return sendJSON(res, { error: 'Sobre no encontrado' }, 404);
                    if (row.saldo > 0) return sendJSON(res, { error: 'No se puede eliminar un sobre con saldo. Retira el dinero primero.' }, 400);

                    db.run("DELETE FROM sobres WHERE id = ?", [envelopeId], (err) => {
                        if (err) return sendJSON(res, { error: err.message }, 500);
                        sendJSON(res, { success: true });
                    });
                });
                return;
            }

            if (method === 'PUT' && action === 'deposit') {
                const data = await parseJSON(req);
                const monto = parseFloat(data.monto);
                if (!monto || monto <= 0) return sendJSON(res, { error: 'Monto inválido' }, 400);

                // 1. Validar fondos suficientes en Balance General
                db.get("SELECT SUM(CASE WHEN tipo = 'ingreso' THEN monto WHEN tipo = 'gasto' THEN -monto ELSE 0 END) as total FROM transacciones", (err, row) => {
                    if (err) return sendJSON(res, { error: err.message }, 500);

                    const balanceGeneral = row ? row.total : 0;
                    if (balanceGeneral < monto) {
                        return sendJSON(res, { error: `Fondos insuficientes. Disponible: ₡${balanceGeneral.toLocaleString('es-CR')}` }, 400);
                    }

                    // 2. Obtener nombre del sobre
                    db.get("SELECT nombre FROM sobres WHERE id = ?", [envelopeId], (err, envelope) => {
                        if (err) return sendJSON(res, { error: err.message }, 500);
                        if (!envelope) return sendJSON(res, { error: 'Sobre no encontrado' }, 404);

                        // 3. Actualizar saldo del sobre
                        db.run("UPDATE sobres SET saldo = saldo + ? WHERE id = ?", [monto, envelopeId], function (err) {
                            if (err) return sendJSON(res, { error: err.message }, 500);

                            // 4. Registrar como GASTO (dinero sale del balance disponible al ahorro)
                            const fecha = new Date().toISOString().split('T')[0];
                            db.run(
                                "INSERT INTO transacciones (fecha, tipo, categoria, monto, descripcion) VALUES (?, ?, ?, ?, ?)",
                                [fecha, 'gasto', 'Ahorro', monto, `Depósito a sobre: ${envelope.nombre}`],
                                function (err) {
                                    if (err) return sendJSON(res, { error: err.message }, 500);
                                    sendJSON(res, { success: true, transactionId: this.lastID });
                                }
                            );
                        });
                    });
                });
                return;
            }

            if (method === 'PUT' && action === 'withdraw') {
                const data = await parseJSON(req);
                const monto = parseFloat(data.monto);
                if (!monto || monto <= 0) return sendJSON(res, { error: 'Monto inválido' }, 400);

                // 1. Verificar saldo suficiente
                db.get("SELECT nombre, saldo FROM sobres WHERE id = ?", [envelopeId], (err, envelope) => {
                    if (err) return sendJSON(res, { error: err.message }, 500);
                    if (!envelope) return sendJSON(res, { error: 'Sobre no encontrado' }, 404);
                    if (envelope.saldo < monto) return sendJSON(res, { error: 'Saldo insuficiente en el sobre' }, 400);

                    // 2. Actualizar saldo del sobre
                    db.run("UPDATE sobres SET saldo = saldo - ? WHERE id = ?", [monto, envelopeId], function (err) {
                        if (err) return sendJSON(res, { error: err.message }, 500);

                        // 3. Registrar como INGRESO (dinero vuelve al balance disponible)
                        const fecha = new Date().toISOString().split('T')[0];
                        db.run(
                            "INSERT INTO transacciones (fecha, tipo, categoria, monto, descripcion) VALUES (?, ?, ?, ?, ?)",
                            [fecha, 'ingreso', 'Retiro Ahorro', monto, `Retiro de sobre: ${envelope.nombre}`],
                            function (err) {
                                if (err) return sendJSON(res, { error: err.message }, 500);
                                sendJSON(res, { success: true, transactionId: this.lastID });
                            }
                        );
                    });
                });
                return;
            }
        }

        return sendJSON(res, { error: 'Not Found' }, 404);
    }

    // 2. Archivos Estáticos
    let filePath = url === '/' ? '/index.html' : url;
    if ((filePath === '/index.html' || filePath === '/') && !getSession(req)) {
        filePath = '/login.html';
    }

    // Cache busting para app.js y styles.css: servir el archivo real ignorando query params
    // (ya se maneja porque url.split('?')[0] arriba limpia la ruta)

    const realPath = path.join(__dirname, filePath);
    if (!realPath.startsWith(__dirname)) return (res.writeHead(403), res.end());

    fs.readFile(realPath, (err, content) => {
        if (err) return (res.writeHead(404), res.end('Not Found'));
        const ext = path.extname(realPath);
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(content);
    });
});

// --- Handlers Auth ---
async function handleLogin(req, res) {
    const { username, password } = await parseJSON(req);
    const user = users[username];
    if (user && bcrypt.compareSync(password, user.passwordHash)) {
        const token = crypto.randomUUID();
        sessions[token] = { username, created: Date.now() };
        saveSessions();
        res.setHeader('Set-Cookie', cookie.serialize('auth_token', token, { httpOnly: true, path: '/' }));
        sendJSON(res, { success: true });
    } else {
        sendJSON(res, { error: 'Invalid credentials' }, 401);
    }
}

function handleLogout(req, res) {
    const cookies = cookie.parse(req.headers.cookie || '');
    if (cookies.auth_token) {
        delete sessions[cookies.auth_token];
        saveSessions();
    }
    res.setHeader('Set-Cookie', cookie.serialize('auth_token', '', { maxAge: 0, path: '/' }));
    sendJSON(res, { success: true });
}

server.listen(PORT, '0.0.0.0', () => console.log(`Server API Nivel 2 running on port ${PORT}`));
