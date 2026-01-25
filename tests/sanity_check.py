"""
SANITY CHECK - Regression Testing Script (Python Version)
=========================================================
Valida funcionalidades críticas del sistema.
Reemplaza a la versión JS por falta de runtime node en el entorno de shell.

Uso: python3 tests/sanity_check.py
"""

import http.client
import json
import sys
import time as import_time

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
    ENDC = '\033[0m'

def log_pass(msg):
    print(f"{Colors.PASS}[PASS]{Colors.ENDC} {msg}")

def log_fail(msg, detail=None):
    print(f"{Colors.FAIL}[FAIL]{Colors.ENDC} {msg}")
    if detail:
        print(detail)
    sys.exit(1)

def log_info(msg):
    print(f"{Colors.INFO}[INFO]{Colors.ENDC} {msg}")

def request(method, path, body=None):
    conn = http.client.HTTPConnection(CONFIG['host'], CONFIG['port'])
    headers = {'Content-Type': 'application/json'}
    
    if CONFIG['cookie']:
        headers['Cookie'] = CONFIG['cookie']
    
    json_body = json.dumps(body) if body else None
    
    try:
        conn.request(method, '/api' + path, body=json_body, headers=headers)
        res = conn.getresponse()
        data = res.read().decode('utf-8')
        
        # Capturar cookie en login
        if path == '/login':
            cookie_header = res.getheader('Set-Cookie')
            if cookie_header:
                CONFIG['cookie'] = cookie_header.split(';')[0]
                
        try:
            parsed = json.loads(data)
        except:
            parsed = data
            
        return {'status': res.status, 'data': parsed}
    except Exception as e:
        log_fail("Error de conexión", str(e))
    finally:
        conn.close()

def run_tests():
    print("--- INICIANDO SANITY CHECK (PYTHON) ---\n")
    
    # 1. LOGIN
    log_info("1. Probando Autenticación...")
    login = request('POST', '/login', {'username': CONFIG['user'], 'password': CONFIG['pass']})
    if login['status'] == 200 and login['data'].get('success'):
        log_pass("Login exitoso")
    else:
        log_fail("Falló el login", login['data'])

    # 2. GET ME
    me = request('GET', '/me')
    if me['status'] == 200 and me['data'].get('username') == CONFIG['user']:
        log_pass("Sesión validada (/api/me)")
    else:
        log_fail("Falló validación de sesión", me['data'])

    # 3. TRANSACTIONS
    txs = request('GET', '/transactions')
    if txs['status'] == 200 and isinstance(txs['data'], list):
        log_pass(f"Listado de transacciones OK ({len(txs['data'])} items)")
    else:
        log_fail("Falló listado de transacciones", txs['data'])
        
    # 4. SAVINGS
    savings = request('GET', '/savings')
    if savings['status'] == 200 and isinstance(savings['data'], list):
        log_pass(f"Listado de sobres OK ({len(savings['data'])} sobres)")
    else:
        log_fail("Falló listado de sobres", savings['data'])

    # 5. STATS
    stats = request('GET', '/stats')
    if stats['status'] == 200 and 'balance' in stats['data']:
        bal = stats['data']['balance']
        log_pass(f"Estadísticas OK (Balance: {bal})")
        
        # Integridad
        inc = stats['data'].get('income', 0)
        exp = stats['data'].get('expense', 0)
        if abs((inc - exp) - bal) < 0.01:
            log_pass("Integridad contable OK")
        else:
            log_fail("Discrepancia en contabilidad", f"{inc} - {exp} != {bal}")
    else:
        log_fail("Falló statistics", stats['data'])

    # 6. CATEGORIES (NEW FEATURE TEST)
    log_info("6. Probando Gestión de Categorías...")
    # Crear
    cat_name = f"TestCat_{int(import_time.time())}"
    new_cat = request('POST', '/categories', {'nombre': cat_name, 'tipo': 'gasto'})
    if new_cat['status'] == 200 and new_cat['data'].get('success'):
        cat_id = new_cat['data']['id']
        log_pass(f"Categoría creada: {cat_name} (ID: {cat_id})")
        
        # Listar y verificar
        cats = request('GET', '/categories')
        found = any(c['nombre'] == cat_name for c in cats['data'])
        if found:
            log_pass("Categoría verificada en lista")
        else:
            log_fail("Categoría creada no aparece en lista")
            
        # Eliminar
        bs = request('DELETE', f'/categories/{cat_id}')
        if bs['status'] == 200:
            log_pass("Categoría eliminada correctamente")
        else:
            log_fail(f"Fallo al eliminar categoría {cat_id}")
    else:
        log_fail("Fallo al crear categoría", new_cat['data'])

    # 7. BUDGETS (NEW FEATURE TEST)
    log_info("7. Probando Presupuestos...")
    budgets_update = request('POST', '/category-budgets', [{'categoria': 'Comida', 'limite': 50000}])
    if budgets_update['status'] == 200:
        log_pass("Presupuesto actualizado")
        
        budgets = request('GET', '/category-budgets')
        b_chk = next((b for b in budgets['data'] if b['categoria'] == 'Comida'), None)
        if b_chk and b_chk['limite'] == 50000:
             log_pass(f"Presupuesto verificado: {b_chk['limite']}")
        else:
             log_fail("Presupuesto no persistió correctamente")
    else:
        log_fail("Fallo al actualizar presupuesto", budgets_update['data'])

    print(f"\n{Colors.PASS}--- TODAS LAS PRUEBAS PASARON EXITOSAMENTE ---{Colors.ENDC}")

if __name__ == "__main__":
    run_tests()
