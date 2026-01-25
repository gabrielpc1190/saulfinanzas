"""
USER STORY TEST - End-to-End Simulation
=======================================
Simula un flujo completo de usuario:
1. Ingreso
2. Sobres (Crear, Depositar, Retirar)
3. Gastos
4. Presupuestos y Verificación Visual

Uso: python3 tests/user_story_test.py
"""

import http.client
import json
import sys
import time
from datetime import date

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
    HEADER = '\033[95m'
    ENDC = '\033[0m'

def log_header(msg): print(f"\n{Colors.HEADER}=== {msg} ==={Colors.ENDC}")
def log_pass(msg): print(f"{Colors.PASS}[PASS]{Colors.ENDC} {msg}")
def log_fail(msg, detail=None):
    print(f"{Colors.FAIL}[FAIL]{Colors.ENDC} {msg}")
    if detail: print(detail)
    sys.exit(1)
def log_info(msg): print(f"{Colors.INFO} ->{Colors.ENDC} {msg}")

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
        log_fail("Connection Error", str(e))
    finally:
        conn.close()

def get_balance():
    res = request('GET', '/stats')
    return res['data']['balance']

def run_story():
    log_header("INICIANDO PRUEBA DE HISTORIA DE USUARIO")
    today = date.today().isoformat()

    # 1. LOGIN
    log_info("Autenticando...")
    if request('POST', '/login', {'username': CONFIG['user'], 'password': CONFIG['pass']})['status'] != 200:
        log_fail("Login fallido")
    
    initial_balance = get_balance()
    log_info(f"Balance Inicial: {initial_balance}")

    # 2. CREAR INGRESO
    log_header("PASO 1: CREAR INGRESO")
    income_amount = 100000
    res = request('POST', '/transactions', {
        'fecha': today,
        'tipo': 'ingreso',
        'categoria': 'Salario',
        'monto': income_amount,
        'descripcion': 'Bono Test'
    })
    if res['status'] == 200:
        log_pass(f"Ingreso creado: +{income_amount}")
        new_balance = get_balance()
        if new_balance == initial_balance + income_amount:
            log_pass(f"Balance actualizado correctamente: {new_balance}")
        else:
            log_fail(f"Balance incorrecto. Esperado: {initial_balance + income_amount}, Actual: {new_balance}")
    else:
        log_fail("Error creando ingreso", res['data'])

    # 3. CREAR SOBRE
    log_header("PASO 2: CREAR SOBRE")
    envelope_name = f"Vacaciones_{int(time.time())}"
    res = request('POST', '/savings', {'nombre': envelope_name, 'icono': '🏖️'})
    if res['status'] == 200:
        env_id = res['data']['id']
        log_pass(f"Sobre '{envelope_name}' creado (ID: {env_id})")
    else:
        log_fail("Error creando sobre", res['data'])

    # 4. DEPOSITAR EN SOBRE
    log_header("PASO 3: DEPOSITAR EN SOBRE")
    deposit_amount = 20000
    res = request('PUT', f'/savings/{env_id}/deposit', {'monto': deposit_amount})
    if res['status'] == 200:
        log_pass(f"Depósito de {deposit_amount} realizado")
        
        # Verificar saldo sobre
        envs = request('GET', '/savings')['data']
        env = next(e for e in envs if e['id'] == env_id)
        if env['saldo'] == deposit_amount:
            log_pass("Saldo del sobre correcto")
        else:
            log_fail(f"Saldo sobre incorrecto: {env['saldo']}")
            
        # Verificar impacto en balance general (debe bajar porque "salió" a ahorro)
        # Nota: En este sistema, depositar a ahorro crea un GASTO 'Ahorro', reduciendo el disponible.
        current_balance = get_balance()
        expected_balance = initial_balance + income_amount - deposit_amount
        # Tolerancia float pequeña
        if abs(current_balance - expected_balance) < 0.1:
            log_pass(f"Balance general reducido correctamente (Dinero movido a sobre)")
        else:
            log_fail(f"Balance general no cuadra. Esperado: {expected_balance}, Actual: {current_balance}")
            
    else:
        log_fail("Error depositando", res['data'])

    # 5. RETIRAR DEL SOBRE
    log_header("PASO 4: RETIRAR DEL SOBRE")
    withdraw_amount = 5000
    res = request('PUT', f'/savings/{env_id}/withdraw', {'monto': withdraw_amount})
    if res['status'] == 200:
        log_pass(f"Retiro de {withdraw_amount} realizado")
        
        envs = request('GET', '/savings')['data']
        env = next(e for e in envs if e['id'] == env_id)
        expected_env_saldo = deposit_amount - withdraw_amount
        if env['saldo'] == expected_env_saldo:
            log_pass(f"Saldo del sobre actualizado: {env['saldo']}")
        else:
            log_fail(f"Saldo sobre incorrecto: {env['saldo']}")

    else:
        log_fail("Error retirando", res['data'])

    # 6. CREAR GASTO
    log_header("PASO 5: CREAR GASTO")
    expense_category = "Comida"
    expense_amount = 10000
    res = request('POST', '/transactions', {
        'fecha': today,
        'tipo': 'gasto',
        'categoria': expense_category,
        'monto': expense_amount,
        'descripcion': 'Cena Test'
    })
    if res['status'] == 200:
        log_pass(f"Gasto de {expense_amount} en {expense_category} creado")
    else:
        log_fail("Error creando gasto", res['data'])

    # 7. AJUSTAR PRESUPUESTO Y VERIFICAR
    log_header("PASO 6: AJUSTAR Y VERIFICAR PRESUPUESTO")
    budget_limit = 15000
    res = request('POST', '/category-budgets', [{'categoria': expense_category, 'limite': budget_limit}])
    
    if res['status'] == 200:
        log_pass(f"Presupuesto de {budget_limit} asignado a {expense_category}")
        
        # Verificar lógica de UI (simulada)
        # Obtenemos presupuestos y gastos para calcular porcentaje
        budgets = request('GET', '/category-budgets')['data']
        txs = request('GET', '/transactions')['data']
        
        # Filtrar gastos del mes actual para esa categoría
        current_month = today[:7] # YYYY-MM
        cat_expenses = sum(t['monto'] for t in txs 
                          if t['tipo'] == 'gasto' 
                          and t['categoria'] == expense_category 
                          and t['fecha'].startswith(current_month))
        
        log_info(f"Gasto total detectado en {expense_category} para {current_month}: {cat_expenses}")
        
        # Debería ser al menos expense_amount (10000)
        if cat_expenses >= expense_amount:
            usage_pct = (cat_expenses / budget_limit) * 100
            log_pass(f"Cálculo de presupuesto correcto: {cat_expenses}/{budget_limit} = {usage_pct:.1f}%")
            log_info(f"Visualmente la barra debería estar al {usage_pct:.1f}%")
        else:
            log_fail("El gasto registrado no se refleja en la suma total mensaul")

    else:
        log_fail("Error asignando presupuesto", res['data'])

    # CLEANUP (Opcional - borramos lo creado para no ensuciar demasiado)
    # Por ahora lo dejamos para que el usuario pueda verlo en la UI si quiere.
    log_header("PRUEBA FINALIZADA EXITOSAMENTE")

if __name__ == "__main__":
    run_story()
