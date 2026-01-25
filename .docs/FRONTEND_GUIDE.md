# Guía de Frontend: Saul-Finanzas

Esta guía explica la estructura y lógica de `app.js`, el cerebro del cliente.

## 1. Módulos Lógicos en `app.js`

Aunque es un solo archivo (patrón Monolito Cliente), el código está organizado en bloques lógicos claros:

### 1.1 `initApp()` (Bootstrapping)
- Verifica sesión (`API.get('me')`).
- Si falla -> Redirige a `/login.html`.
- Si éxito -> Carga Dashboard, Menús y Eventos Globales.

### 1.2 Navegación (`showView(viewName)`)
- **Sistema SPA**: Usa clases CSS `.active` para mostrar/ocultar secciones `<section id="view-X">`.
- **Ventaja**: No recarga la página, estado persistente.

### 1.3 Dashboard (`loadDashboard`)
- Carga paralela de Estadísticas (`updateStats`) y Gráficos (`updateCharts`).
- Usa `Promise.all` para eficiencia.

### 1.4 API Client Wrapper
- Objeto `API` al inicio del archivo.
- Encapsula `fetch` con manejo de errores centralizado.
- **Regla**: Nunca usar `fetch` directo, siempre usar `API.get`, `API.post`, etc.

## 2. Gestión de Eventos y Modales

### 2.1 Modales
- **HTML**: Definidos al final de `index.html`.
- **Apertura**: Por ID (`document.getElementById('modal').style.display = 'block'`).
- **Cierre**: Función `closeModal()` global que cierra todos los modales.

### 2.2 Confirmaciones (`showConfirm`)
- **Problema Histórico**: Conflictos con `confirm()` nativo y "event bubbling".
- **Solución Actual**:
    - Modal personalizado `#confirmModal`.
    - **Clonación de Nodos**: `btn.cloneNode(true)` para borrar listeners viejos antes de asignar nuevos.
    - **Uso**:
    ```javascript
    showConfirm('Título', 'Mensaje', async () => {
        // Callback si el usuario dice SÍ
    });
    ```

### 2.3 Notificaciones (`showToast`)
- Reemplazo de `alert()`.
- Crea elementos DOM flotantes que se autodestruyen en 4 segundos.
- Tipos: `success` (verde), `error` (rojo), `warning` (amarillo), `info` (azul).

## 3. UI Kit & Estilos (`styles.css`)

### Variables CSS (Theming)
- Definidas en `:root`.
- Colores semánticos: `--income`, `--expense`, `--primary`.

### Clases Utilitarias
- `.btn`: Base para botones.
- `.btn-primary`, `.btn-secondary`, `.btn-danger`: Variantes.
- `.card`: Contenedor con fondo semitransparente.

### Responsive
- Mobile First.
- Media Queries ajustan el grid del dashboard y ocultan el sidebar (menú hamburguesa).
