const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_FILE = path.join(__dirname, 'data/finanzas.sqlite');
const db = new sqlite3.Database(DB_FILE);

db.serialize(() => {
    console.log('🚀 Iniciando purga selectiva de base de datos...');

    // 1. Borrar transacciones
    db.run("DELETE FROM transacciones", function (err) {
        if (err) console.error('❌ Error en transacciones:', err.message);
        else console.log(`✅ ${this.changes} transacciones eliminadas.`);
    });

    // 2. Borrar sobres
    db.run("DELETE FROM sobres", function (err) {
        if (err) console.error('❌ Error en sobres:', err.message);
        else console.log(`✅ ${this.changes} sobres eliminados.`);
    });

    // 3. Reiniciar contadores de ID (opcional pero limpio)
    db.run("DELETE FROM sqlite_sequence WHERE name IN ('transacciones', 'sobres')");

    console.log('📌 Categorías y Presupuestos se han mantenido intactos.');
});

db.close((err) => {
    if (err) console.error(err.message);
    else console.log('🏁 Proceso finalizado.');
});
