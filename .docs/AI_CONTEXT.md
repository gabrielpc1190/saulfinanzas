# Contexto para IA: Saul-Finanzas

👋 **Hola, Agente de IA.**
Si estás leyendo esto, es porque vas a modificar el código de "Saul-Finanzas". Esta guía es para ti.

## 🧠 Meta-Reglas (Consérvalas o romperás el sistema)

1.  **NO uses `onclick` en HTML**:
    *   **Prohibido**: `<button onclick="borrar()">`
    *   **Correcto**: Asignar via `addEventListener` o propiedades `.onclick` en `app.js`.
    *   **Razón**: El `onclick` inline causa problemas de alcance y seguridad CSP.

2.  **Respeto al `API` Wrapper**:
    *   No uses `fetch()` directamente. Usa `API.get()`, `API.post()`.
    *   Este wrapper maneja headers JSON y errores HTTP automáticamente.

3.  **Confirmaciones**:
    *   **NUNCA** uses `window.confirm()` o `window.alert()`.
    *   Usa `showConfirm()` para diálogos SI/NO.
    *   Usa `showToast()` para mensajes de éxito/error.

4.  **Integridad de Base de Datos**:
    *   Los sobres (`sobres`) inician con saldo 0.
    *   El dinero entra/sale de sobres SOLAMENTE mediante transacciones (`transactions`).
    *   **Invariante**: `Saldo Sobre = Suma(Depósitos) - Suma(Retiros)`. Nunca editar el saldo directamente sin registrar la transacción.

## 📍 Puntos Calientes (Zones of Danger)

*   **`initModalHandlers` en `app.js`**:
    *   Aquí se asignan los eventos de cierre global. **Cuidado** al editar; si rompes la propagación, los modales no cerrarán o cerrarán solos.

*   **`updateCharts`**:
    *   Si Chart.js no tiene datos, falla feo. Siempre hay un check `if (Object.keys(catTotals).length === 0)` para mostrar un gráfico vacío por defecto.

*   **Autenticación**:
    *   Basada en Cookies (`httpOnly`). No busques tokens en `localStorage`.

## 🛠️ Cómo agregar una nueva funcionalidad

1.  **Backend**: Agrega el endpoint en `server.js` dentro del bloque `/api/`.
2.  **Frontend**: Agrega la función en `app.js` usando `API.call`.
3.  **UI**: Agrega el HTML en `index.html` (dentro de una `<section>` view o un nuevo modal).
4.  **Wiring**: Conecta el botón en `initApp` o `initModalHandlers`.
