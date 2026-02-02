/**
 * CLI para crear usuarios manualmente (Admin Only)
 * Uso: node create_user.js <usuario> <password>
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_FILE = path.join(__dirname, 'data/finanzas.sqlite');
const db = new sqlite3.Database(DB_FILE);

const args = process.argv.slice(2);
if (args.length !== 2) {
    console.error('❌ Uso: node create_user.js <usuario> <password>');
    process.exit(1);
}

const [username, password] = args;

// Categorías por defecto (Misma lógica que el servidor)
const DEFAULT_CATEGORIES = [
    { nombre: 'Comida', tipo: 'gasto' },
    { nombre: 'Transporte', tipo: 'gasto' },
    { nombre: 'Salario', tipo: 'ingreso' },
    { nombre: 'Otros', tipo: 'gasto' }
];

db.serialize(() => {
    // 1. Verificar si existe
    db.get("SELECT id FROM users WHERE username = ?", [username], (err, row) => {
        if (row) {
            console.error('❌ El usuario ya existe.');
            process.exit(1);
        }

        // 2. Crear usuario
        const hash = bcrypt.hashSync(password, 10);
        db.run("INSERT INTO users (username, password_hash) VALUES (?, ?)", [username, hash], function (err) {
            if (err) {
                console.error('❌ Error DB:', err.message);
                process.exit(1);
            }

            const newUserId = this.lastID;
            console.log(`✅ Usuario '${username}' creado con ID: ${newUserId}`);

            // 3. Crear categorías base
            const stmt = db.prepare("INSERT INTO categorias (user_id, nombre, tipo) VALUES (?, ?, ?)");
            DEFAULT_CATEGORIES.forEach(c => stmt.run([newUserId, c.nombre, c.tipo]));
            stmt.finalize(() => {
                console.log('✅ Categorías por defecto asignadas.');
                console.log('ℹ️ Para desplegar cambios: ./deploy.sh (No necesario si corres esto dentro del docker)');
            });
        });
    });
});
