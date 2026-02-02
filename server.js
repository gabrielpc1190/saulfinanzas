/**
 * Servidor API REST Multi-Usuario Nivel 3 (SQLite Server-Side)
 * Soporte para aislamiento de datos por usuario (Row-Level Security)
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
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// --- Asegurar directorio data ---
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// --- Inicializar DB SQLite ---
const db = new sqlite3.Database(DB_FILE);

/**
 * Define las categorías por defecto para nuevos usuarios.
 */
const DEFAULT_CATEGORIES = [
    { nombre: 'Comida', tipo: 'gasto' },
    { nombre: 'Transporte', tipo: 'gasto' },
    { nombre: 'Salario', tipo: 'ingreso' },
    { nombre: 'Otros', tipo: 'gasto' }
];

/**
 * Inicializa y migra la estructura de la base de datos.
 */
function initDB() {
    db.serialize(() => {
        // 1. Tabla de Usuarios
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);

        // 2. Tablas de Negocio con user_id
        db.run(`CREATE TABLE IF NOT EXISTS transacciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 1,
            fecha TEXT, tipo TEXT, categoria TEXT, monto REAL, descripcion TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 1,
            nombre TEXT, tipo TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS presupuestos_categoria (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 1,
            categoria TEXT, 
            limite REAL DEFAULT 0,
            UNIQUE(user_id, categoria)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS sobres (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 1,
            nombre TEXT, 
            saldo REAL DEFAULT 0, 
            icono TEXT,
            UNIQUE(user_id, nombre)
        )`);

        // Migración: Asegurar columnas user_id en tablas existentes (si vienen de v2)
        const tables = ['transacciones', 'categorias', 'presupuestos_categoria', 'sobres'];
        tables.forEach(table => {
            db.all(`PRAGMA table_info(${table})`, (err, columns) => {
                if (!columns.some(c => c.name === 'user_id')) {
                    console.log(`[DB] Migrando tabla ${table} a multi-usuario...`);
                    db.run(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1`);
                }
            });
        });

        // Crear usuario admin default si no existe (Migración de users.json si es necesario)
        // Nota: Si ya existía lógica auth anterior, asumimos que ID 1 es admin.
        const adminPass = process.env.ADMIN_PASSWORD || 'Saul123!';
        const hash = bcrypt.hashSync(adminPass, 10);
        db.run(`INSERT OR IGNORE INTO users (id, username, password_hash) VALUES (1, 'admin', ?)`, [hash]);
    });
    console.log('[DB] Base de datos Multi-Usuario inicializada');
}
initDB();

// --- Auth System (Sessions Memory) ---
let sessions = {};
if (fs.existsSync(SESSIONS_FILE)) {
    try { sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE)); } catch (e) { sessions = {}; }
}
function saveSessions() { fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2)); }

/**
 * Recupera la sesión activa.
 * @returns {Object|null} { userId, username, created }
 */
function getSession(req) {
    const cookies = cookie.parse(req.headers.cookie || '');
    const token = cookies.auth_token;
    return (token && sessions[token]) ? sessions[token] : null;
}

// --- Helpers HTTP ---
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

    const url = req.url.split('?')[0];
    const method = req.method;

    // --- PUBLIC ENDPOINTS ---
    if (url === '/api/login' && method === 'POST') return handleLogin(req, res);

    // Registro público deshabilitado por seguridad (Usar CLI: node create_user.js)
    if (url === '/api/register') {
        return sendJSON(res, { error: 'Registro público deshabilitado. Contacte al administrador.' }, 403);
    }

    // --- PROTECTED ENDPOINTS ---
    if (url.startsWith('/api/')) {
        const session = getSession(req);
        if (!session) return sendJSON(res, { error: 'Unauthorized' }, 401);
        const userId = session.userId;

        if (url === '/api/me') return sendJSON(res, { username: session.username, id: userId });
        if (url === '/api/logout') return handleLogout(req, res);

        // --- TRANSACTIONS ---
        if (url === '/api/transactions') {
            if (method === 'GET') {
                db.all("SELECT * FROM transacciones WHERE user_id = ? ORDER BY fecha DESC, id DESC", [userId], (err, rows) => {
                    if (err) return sendJSON(res, { error: err.message }, 500);
                    sendJSON(res, rows);
                });
                return;
            }
            if (method === 'POST') {
                const data = await parseJSON(req);
                const { fecha, tipo, categoria, monto, descripcion } = data;
                db.run("INSERT INTO transacciones (user_id, fecha, tipo, categoria, monto, descripcion) VALUES (?,?,?,?,?,?)",
                    [userId, fecha, tipo, categoria, monto, descripcion],
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
            db.run("DELETE FROM transacciones WHERE id = ? AND user_id = ?", [id, userId], (err) => {
                if (err) return sendJSON(res, { error: err.message }, 500);
                sendJSON(res, { success: true });
            });
            return;
        }

        // --- STATS / DASHBOARD ---
        if (url === '/api/stats') {
            db.all("SELECT tipo, SUM(monto) as total FROM transacciones WHERE user_id = ? GROUP BY tipo", [userId], (err, rows) => {
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
            if (method === 'GET') {
                db.all("SELECT * FROM categorias WHERE user_id = ? ORDER BY nombre", [userId], (err, rows) => {
                    if (err) return sendJSON(res, { error: err.message }, 500);
                    sendJSON(res, rows);
                });
                return;
            }
            if (method === 'POST') {
                const data = await parseJSON(req);
                db.run("INSERT INTO categorias (user_id, nombre, tipo) VALUES (?, ?, ?)",
                    [userId, data.nombre, data.tipo], function (err) {
                        if (err) return sendJSON(res, { error: err.message }, 500);
                        sendJSON(res, { id: this.lastID, success: true });
                    });
                return;
            }
        }
        if (url.startsWith('/api/categories/') && method === 'DELETE') {
            const id = url.split('/').pop();
            db.run("DELETE FROM categorias WHERE id = ? AND user_id = ?", [id, userId], function (err) {
                if (err) return sendJSON(res, { error: err.message }, 500);
                sendJSON(res, { success: true });
            });
            return;
        }

        // --- CATEGORY BUDGETS ---
        if (url === '/api/category-budgets') {
            if (method === 'GET') {
                db.all("SELECT * FROM presupuestos_categoria WHERE user_id = ?", [userId], (err, rows) => {
                    if (err) return sendJSON(res, { error: err.message }, 500);
                    sendJSON(res, rows || []);
                });
                return;
            }
            if (method === 'POST') {
                const data = await parseJSON(req);
                const stmt = db.prepare("INSERT OR REPLACE INTO presupuestos_categoria (user_id, categoria, limite) VALUES (?, ?, ?)");
                for (const item of data) {
                    if (item.categoria && typeof item.limite === 'number') {
                        stmt.run([userId, item.categoria, item.limite]);
                    }
                }
                stmt.finalize((err) => {
                    if (err) return sendJSON(res, { error: err.message }, 500);
                    sendJSON(res, { success: true });
                });
                return;
            }
        }

        // --- SAVINGS (SOBRES) ---
        if (url === '/api/savings') {
            if (method === 'GET') {
                db.all("SELECT * FROM sobres WHERE user_id = ? ORDER BY nombre", [userId], (err, rows) => {
                    if (err) return sendJSON(res, { error: err.message }, 500);
                    sendJSON(res, rows || []);
                });
                return;
            }
            if (method === 'POST') {
                const data = await parseJSON(req);
                db.run("INSERT INTO sobres (user_id, nombre, saldo, icono) VALUES (?, ?, 0, ?)",
                    [userId, data.nombre, data.icono || '💰'],
                    function (err) {
                        if (err) {
                            if (err.message.includes('UNIQUE')) return sendJSON(res, { error: 'Ya existe un sobre con ese nombre' }, 400);
                            return sendJSON(res, { error: err.message }, 500);
                        }
                        sendJSON(res, { id: this.lastID, success: true });
                    }
                );
                return;
            }
        }

        // Operaciones Sobre Específico
        const savingsMatch = url.match(/^\/api\/savings\/(\d+)(\/(\w+))?$/);
        if (savingsMatch) {
            const envelopeId = savingsMatch[1];
            const action = savingsMatch[3];

            if (method === 'DELETE' && !action) {
                db.get("SELECT saldo FROM sobres WHERE id = ? AND user_id = ?", [envelopeId, userId], (err, row) => {
                    if (!row) return sendJSON(res, { error: 'Sobre no encontrado' }, 404);
                    if (row.saldo > 0) return sendJSON(res, { error: 'No se puede eliminar un sobre con saldo' }, 400);

                    db.run("DELETE FROM sobres WHERE id = ? AND user_id = ?", [envelopeId, userId], (err) => {
                        if (err) return sendJSON(res, { error: err.message }, 500);
                        sendJSON(res, { success: true });
                    });
                });
                return;
            }

            if (method === 'PUT' && (action === 'deposit' || action === 'withdraw')) {
                const data = await parseJSON(req);
                const monto = parseFloat(data.monto);
                if (!monto || monto <= 0) return sendJSON(res, { error: 'Monto inválido' }, 400);

                // Validar propiedad del sobre
                db.get("SELECT * FROM sobres WHERE id = ? AND user_id = ?", [envelopeId, userId], (err, envelope) => {
                    if (!envelope) return sendJSON(res, { error: 'Sobre no encontrado' }, 404);

                    if (action === 'deposit') {
                        // Verificar fondos globales
                        db.get("SELECT SUM(CASE WHEN tipo='ingreso' THEN monto ELSE -monto END) as total FROM transacciones WHERE user_id = ?", [userId], (err, row) => {
                            const balance = (row && row.total) || 0;
                            if (balance < monto) return sendJSON(res, { error: 'Fondos insuficientes' }, 400);

                            // Ejecutar movimiento
                            executeEnvelopeTransaction(userId, envelope, monto, 'deposit', res);
                        });
                    } else { // withdraw
                        if (envelope.saldo < monto) return sendJSON(res, { error: 'Saldo insuficiente en sobre' }, 400);
                        executeEnvelopeTransaction(userId, envelope, monto, 'withdraw', res);
                    }
                });
                return;
            }
        }

        return sendJSON(res, { error: 'Not Found' }, 404);
    }

    // --- STATIC FILES ---
    let filePath = url === '/' ? '/index.html' : url;
    if ((filePath === '/index.html' || filePath === '/') && !getSession(req)) {
        filePath = '/login.html';
    }

    const realPath = path.join(__dirname, filePath);
    if (!realPath.startsWith(__dirname)) return (res.writeHead(403), res.end());

    fs.readFile(realPath, (err, content) => {
        if (err) return (res.writeHead(404), res.end('Not Found'));
        const ext = path.extname(realPath);
        const headers = { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' };
        if (ext === '.js' || ext === '.css') headers['Cache-Control'] = 'no-cache, must-revalidate';
        res.writeHead(200, headers);
        res.end(content);
    });
});

function executeEnvelopeTransaction(userId, envelope, monto, type, res) {
    const isDeposit = type === 'deposit';
    const sqlUpdate = `UPDATE sobres SET saldo = saldo ${isDeposit ? '+' : '-'} ? WHERE id = ?`;

    db.run(sqlUpdate, [monto, envelope.id], function (err) {
        if (err) return sendJSON(res, { error: err.message }, 500);

        const fecha = new Date().toISOString().split('T')[0];
        const txType = isDeposit ? 'gasto' : 'ingreso'; // Depósito al sobre es gasto del balance disponible
        const cat = isDeposit ? 'Ahorro' : 'Retiro Ahorro';
        const desc = isDeposit ? `Depósito a sobre: ${envelope.nombre}` : `Retiro de sobre: ${envelope.nombre}`;

        db.run("INSERT INTO transacciones (user_id, fecha, tipo, categoria, monto, descripcion) VALUES (?,?,?,?,?,?)",
            [userId, fecha, txType, cat, monto, desc],
            function (err) {
                if (err) return sendJSON(res, { error: err.message }, 500);
                sendJSON(res, { success: true });
            }
        );
    });
}

// --- Auth Handler (DB Based) ---
async function handleLogin(req, res) {
    const { username, password } = await parseJSON(req);
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (err) return sendJSON(res, { error: err.message }, 500);

        if (user && bcrypt.compareSync(password, user.password_hash)) {
            const token = crypto.randomUUID();
            sessions[token] = { userId: user.id, username: user.username, created: Date.now() }; // Store userId
            saveSessions();
            res.setHeader('Set-Cookie', cookie.serialize('auth_token', token, { httpOnly: true, path: '/' }));
            sendJSON(res, { success: true });
        } else {
            sendJSON(res, { error: 'Credenciales inválidas' }, 401);
        }
    });
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

server.listen(PORT, '0.0.0.0', () => console.log(`Server Multi-User running on port ${PORT}`));
