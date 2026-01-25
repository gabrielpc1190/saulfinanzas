# Referencia de API: Saul-Finanzas

Documentación de los endpoints disponibles en `server.js`. Todas las respuestas son JSON.

**Base URL**: `/api/`

---

## 🔐 Autenticación

### Login
**POST** `/api/login`
Inicia sesión y establece cookie `auth_token`.
*   **Body**: `{ "username": "admin", "password": "..." }`
*   **Response 200**: `{ "success": true }`
*   **Response 401**: `{ "error": "Invalid credentials" }`

### Logout
**GET** `/api/logout`
Destruye la sesión y limpia la cookie.
*   **Response 200**: `{ "success": true }`

### Get Me
**GET** `/api/me`
Obtiene información del usuario actual.
*   **Response 200**: `{ "username": "admin" }`
*   **Response 401**: `{ "error": "Unauthorized" }`

---

## 💸 Transacciones

### Listar Transacciones
**GET** `/api/transactions`
Devuelve todas las transacciones ordenadas por fecha descendente.
*   **Response 200**: `[ { "id": 1, "fecha": "2023-10-01", "tipo": "ingreso", "monto": 5000, ... }, ... ]`

### Crear Transacción
**POST** `/api/transactions`
*   **Body**:
    ```json
    {
      "fecha": "YYYY-MM-DD",
      "tipo": "ingreso" | "gasto",
      "categoria": "Comida",
      "monto": 1500.50,
      "descripcion": "Almuerzo"
    }
    ```
*   **Response 200**: `{ "id": 123, "success": true }`

### Eliminar Transacción
**DELETE** `/api/transactions/:id`
*   **Response 200**: `{ "success": true }`

---

## 💰 Ahorros (Sobres)

### Listar Sobres
**GET** `/api/savings`
*   **Response 200**: `[ { "id": 1, "nombre": "Vacaciones", "saldo": 0, "icono": "💰" }, ... ]`

### Crear Sobre
**POST** `/api/savings`
*   **Body**: `{ "nombre": "Emergencias", "icono": "🚑" }`
*   **Response 200**: `{ "id": 5, "success": true }`
*   **Nota**: El saldo inicial siempre es 0 por integridad contable.

### Eliminar Sobre
**DELETE** `/api/savings/:id`
Solo permite eliminar si `saldo === 0`.
*   **Response 200**: `{ "success": true }`
*   **Response 400**: `{ "error": "No se puede eliminar un sobre con saldo..." }`

### Depositar Fondos
**PUT** `/api/savings/:id/deposit`
Mueve dinero del balance general al sobre. Crea una transacción de "Gasto" (Salida de disponibilidad).
*   **Body**: `{ "monto": 5000 }`
*   **Response 200**: `{ "success": true, "transactionId": 88 }`

### Retirar Fondos
**PUT** `/api/savings/:id/withdraw`
Mueve dinero del sobre al balance general. Crea una transacción de "Ingreso" (Entrada a disponibilidad).
*   **Body**: `{ "monto": 2000 }`
*   **Response 200**: `{ "success": true, "transactionId": 89 }`

---

## 📊 Sistema

### Estadísticas
**GET** `/api/stats`
Calcula totales al vuelo.
*   **Response 200**:
    ```json
    {
      "income": 100000,
      "expense": 45000,
      "balance": 55000
    }
    ```

### Categorías
**GET** `/api/categories`
*   **Response 200**: `[ { "id": 1, "nombre": "Comida", "tipo": "gasto" }, ... ]`
