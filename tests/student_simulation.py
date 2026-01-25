"""
STUDENT LIFE SIMULATION
=======================
Escenario: Estudiante con Beca.
Duración: 1 Semana.
Objetivos: 
- Ingreso Beca (250k)
- Sobre Alquiler (70k)
- Presupuestos varios
- Gastos diarios (Comida, Transporte)
- Validación Contable

Uso: python3 tests/student_simulation.py
"""

import http.client
import json
import sys
import time
from datetime import date, timedelta
import random

CONFIG = {
    'host': 'localhost',
    'port': 3000,
    'user': 'admin',
    'pass': 'Saul123!',
    'cookie': None
}

class Colors:
    PASS = '\033[92m'
    FAIL = '\033[91m'
    INFO = '\033[96m'
    WARN = '\033[93m'
    HEADER = '\033[95m'
    ENDC = '\033[0m'

def log(msg, color=Colors.INFO): print(f"{color}{msg}{Colors.ENDC}")

def request(method, path, body=None):
    conn = http.client.HTTPConnection(CONFIG['host'], CONFIG['port'])
    headers = {'Content-Type': 'application/json'}
    if CONFIG['cookie']: headers['Cookie'] = CONFIG['cookie']
    
    try:
        conn.request(method, '/api' + path, body=json.dumps(body) if body else None, headers=headers)
        res = conn.getresponse()
        data = res.read().decode('utf-8')
        if path == '/login' and res.getheader('Set-Cookie'):
            CONFIG['cookie'] = res.getheader('Set-Cookie').split(';')[0]
        try: return {'status': res.status, 'data': json.loads(data)}
        except: return {'status': res.status, 'data': data}
    except Exception as e:
        log(f"Connection Error: {e}", Colors.FAIL)
        sys.exit(1)
    finally:
        conn.close()

def setup_scenario():
    # 0. Login
    if request('POST', '/login', {'username': CONFIG['user'], 'password': CONFIG['pass']})['status'] != 200:
        log("Login failed", Colors.FAIL); sys.exit(1)
        
    # Limpieza inicial (Opcional, para que la simulación sea limpia, pero server.js no tiene endpoint de reset)
    # Asumimos que corremos sobre lo que hay. Calcularemos deltas.
    return request('GET', '/stats')['data']['balance']

def run_simulation():
    initial_balance = setup_scenario()
    log(f"--- INICIO SIMULACIÓN (Balance Inicial: {initial_balance}) ---", Colors.HEADER)
    
    start_date = date.today()
    running_balance = initial_balance
    
    # --- DIA 1: Configuración Financiera ---
    log("\n[DÍA 1] Recibiendo Beca y Organizando...", Colors.HEADER)
    
    # 1. Ingreso Beca
    beca = 250000
    request('POST', '/transactions', {
        'fecha': start_date.isoformat(),
        'tipo': 'ingreso',
        'categoria': 'Beca',
        'monto': beca,
        'descripcion': 'Beca Universitaria'
    })
    running_balance += beca
    log(f" + Ingreso: ₡{beca} (Beca)")

    # 2. Categorías
    categories = ['Comida', 'Transporte', 'Libros', 'Telefono', 'Internet', 'Alquiler']
    current_cats = [c['nombre'] for c in request('GET', '/categories')['data']]
    for cat in categories:
        if cat not in current_cats:
            request('POST', '/categories', {'nombre': cat, 'tipo': 'gasto'})
            log(f" > Categoría creada: {cat}")

    # 3. Presupuestos
    budgets = [
        {'categoria': 'Alquiler', 'limite': 70000},
        {'categoria': 'Comida', 'limite': 60000},
        {'categoria': 'Transporte', 'limite': 20000},
        {'categoria': 'Libros', 'limite': 30000},
        {'categoria': 'Telefono', 'limite': 10000},
        {'categoria': 'Internet', 'limite': 15000}
    ]
    request('POST', '/category-budgets', budgets)
    log(" > Presupuestos definidos")

    # 4. Sobre Alquiler
    env_name = "Alquiler_Mes"
    # Borrar si existe para prueba limpia
    envs = request('GET', '/savings')['data']
    existing = next((e for e in envs if e['nombre'] == env_name), None)
    if existing:
        if existing['saldo'] > 0:
            request('PUT', f"/savings/{existing['id']}/withdraw", {'monto': existing['saldo']})
            running_balance += existing['saldo'] # Devolvemos al balance para reiniciar
            log("   (Limpiando sobre anterior...)")
        request('DELETE', f"/savings/{existing['id']}")
    
    new_env = request('POST', '/savings', {'nombre': env_name, 'icono': '🏠'})
    env_id = new_env['data']['id']
    log(f" > Sobre '{env_name}' creado")

    # 5. Mover Alquiler al Sobre
    rent_amount = 70000
    request('PUT', f'/savings/{env_id}/deposit', {'monto': rent_amount})
    running_balance -= rent_amount # Sale del disponible
    log(f" - Transferencia a Sobre: ₡{rent_amount} para Alquiler")

    # ERROR POTENCIAL: ¿Se afecta el presupuesto de 'Alquiler'?
    # En server.js el depósito se guarda como categoría 'Ahorro'.
    # Verificaremos esto al final.

    # --- SEMANA 1 (Simulación de Gastos) ---
    total_comida = 0
    total_transporte = 0
    total_libros = 0
    
    current_date = start_date
    for i in range(7):
        day_str = f"[DÍA {i+1}] {current_date.isoformat()}"
        log(f"\n{day_str}")
        
        # Desayuno (1500 - 2500)
        cost = random.randint(1500, 2500)
        request('POST', '/transactions', {'fecha': current_date.isoformat(), 'tipo': 'gasto', 'categoria': 'Comida', 'monto': cost, 'descripcion': 'Desayuno'})
        running_balance -= cost
        total_comida += cost
        log(f" - Gasto: ₡{cost} (Desayuno)")
        
        # Transporte Ida (350 - 500)
        cost = random.randint(350, 500)
        request('POST', '/transactions', {'fecha': current_date.isoformat(), 'tipo': 'gasto', 'categoria': 'Transporte', 'monto': cost, 'descripcion': 'Bus U'})
        running_balance -= cost
        total_transporte += cost
        
        # Almuerzo (3000 - 4500)
        cost = random.randint(3000, 4500)
        request('POST', '/transactions', {'fecha': current_date.isoformat(), 'tipo': 'gasto', 'categoria': 'Comida', 'monto': cost, 'descripcion': 'Almuerzo Soda'})
        running_balance -= cost
        total_comida += cost
        log(f" - Gasto: ₡{cost} (Almuerzo)")

        # Transporte Vuelta
        cost = random.randint(350, 500)
        request('POST', '/transactions', {'fecha': current_date.isoformat(), 'tipo': 'gasto', 'categoria': 'Transporte', 'monto': cost, 'descripcion': 'Bus Casa'})
        running_balance -= cost
        total_transporte += cost

        # Cena (2000 - 3000)
        cost = random.randint(2000, 3000)
        request('POST', '/transactions', {'fecha': current_date.isoformat(), 'tipo': 'gasto', 'categoria': 'Comida', 'monto': cost, 'descripcion': 'Cena'})
        running_balance -= cost
        total_comida += cost
        
        # Dia 3: Compra Libro
        if i == 2:
            cost = 18000
            request('POST', '/transactions', {'fecha': current_date.isoformat(), 'tipo': 'gasto', 'categoria': 'Libros', 'monto': cost, 'descripcion': 'Libro Física'})
            running_balance -= cost
            total_libros += cost
            log(f" - Gasto: ₡{cost} (Libro Física)!!!")

        current_date += timedelta(days=1)


    # --- INFORME FINAL ---
    log("\n=== VALIDACIÓN Y RESULTADOS ===", Colors.HEADER)
    
    server_stats = request('GET', '/stats')['data']
    server_balance = server_stats['balance']
    
    log(f"Balance Calculado (Simulación): ₡{running_balance}")
    log(f"Balance Servidor (Real):        ₡{server_balance}")
    
    if abs(running_balance - server_balance) < 1.0:
        log("✅ INTEGRIDAD CONTABLE: CORRECTA", Colors.PASS)
    else:
        log("❌ INTEGRIDAD CONTABLE: FALLO", Colors.FAIL)
        log(f"Diferencia: {server_balance - running_balance}")

    # Revisión de Presupuestos
    log("\nANÁLISIS DE PRESUPUESTOS vs REALIDAD:", Colors.WARN)
    txs = request('GET', '/transactions')['data']
    
    def get_spent(cat):
        return sum(t['monto'] for t in txs if t['tipo'] == 'gasto' and t['categoria'] == cat and t['fecha'] >= start_date.isoformat())

    spent_comida = get_spent('Comida')
    # Validar Comida
    log(f"Comida: Gastado ₡{spent_comida} / Presupuesto ₡60000")
    if spent_comida != total_comida:
         log(f"⚠️ Discrepancia en tracking local vs server para Comida ({total_comida} vs {spent_comida})", Colors.FAIL)
    
    # Validar Alquiler (El BUG esperado)
    spent_alquiler = get_spent('Alquiler')
    spent_ahorro = get_spent('Ahorro')
    
    log(f"Alquiler (Categoría): Gastado ₡{spent_alquiler} / Presupuesto ₡70000")
    log(f"Ahorro (Categoría):   Gastado ₡{spent_ahorro}")
    
    if spent_alquiler == 0 and spent_ahorro >= 70000:
        log("\n🚩 HALLAZGO IMPORTANTE (BUG DE LÓGICA):", Colors.FAIL)
        log("   El usuario creó un presupuesto para 'Alquiler' y depositó 70k en un sobre llamado 'Alquiler'.")
        log("   Sin embargo, el sistema registra el depósito bajo la categoría 'Ahorro'.")
        log("   RESULTADO: El presupuesto de 'Alquiler' aparece intacto (0% uso), dando una falsa sensación de disponibilidad.")
        log("   El dinero se descontó, pero no se reflejó en la barra de progreso correcta.")

if __name__ == "__main__":
    run_simulation()
