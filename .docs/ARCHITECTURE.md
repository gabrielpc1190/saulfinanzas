# Arquitectura del Sistema: Saul-Finanzas

## 1. Visión Global
**Saul-Finanzas** es una aplicación web de gestión financiera personal diseñada para ser ligera, rápida y fácil de desplegar. Sigue una arquitectura cliente-servidor clásica (Monolito Modular) optimizada para entornos de baja latencia.

### Diagrama de Flujo de Datos
```mermaid
graph TD
    User[Usuario (Navegador)] <-->|HTTPS / JSON| API[Server Node.js]
    API <-->|SQL Query| DB[(SQLite Database)]
    API <-->|File System| Static[Static Assets (HTML/CSS/JS)]
    API <-->|Session Store| SessionFile[sessions.json]
```

## 2. Stack Tecnológico

### Frontend (Cliente)
*   **Lenguaje**: Vanilla JavaScript (ES6+). Sin frameworks pesados (React/Vue/Angular) para maximizar rendimiento y mantenibilidad a largo plazo.
*   **Estilos**: CSS3 Puro con Variables CSS (Custom Properties). Diseño responsivo "Mobile-First".
*   **UI**: Sistema de Modales personalizados y Notificaciones Toast (sin dependencias externas salvo Chart.js).
*   **Gráficos**: Chart.js v4 (vía CDN) para visualización de datos.

### Backend (Servidor)
*   **Runtime**: Node.js.
*   **Módulo HTTP**: Nativo `http` (sin Express) para control total y cero dependencias innecesarias.
*   **Base de Datos**: SQLite3 (`sqlite3` driver).
    *   **Por qué SQLite**: Base de datos serverless, cero configuración, un solo archivo, ideal para aplicaciones monopersonales.
*   **Seguridad**: `bcryptjs` para hashing de contraseñas, `cookie` para sesiones httpOnly.

## 3. Estructura de Directorios

| Ruta | Propósito |
|------|-----------|
| `/` | Raíz del proyecto. Contiene entrypoints y configuración. |
| `/data/` | **Persistencia**. Contiene `finanzas.sqlite`, `users.json`, y `sessions.json`. **Backupear esta carpeta**. |
| `/node_modules/` | Dependencias de Node.js. |
| `.docs/` | Documentación técnica del proyecto. |
| `server.js` | **Core Backend**. Lógica de API, Auth, Router y DB. |
| `app.js` | **Core Frontend**. Lógica de UI, Fetch API, Validaciones, Navegación SPA. |
| `styles.css` | Hoja de estilos global. Tema oscuro, responsive design. |
| `index.html` | SPA Shell. Contiene todas las vistas y modales. |
| `login.html` | Página de acceso independiente. |

## 4. Decisiones de Diseño Clave

1.  **SPA Manual (Single Page Application)**:
    *   En lugar de un router complejo, usamos un sistema simple de visibilidad CSS (`.view.active`).
    *   **Ventaja**: Carga inicial única, transiciones instantáneas, código muy simple.

2.  **API RESTful Nivel 2**:
    *   Uso correcto de verbos HTTP (`GET`, `POST`, `PUT`, `DELETE`).
    *   Respuestas en JSON estándar `{ success: true, data: ... }` o `{ error: "msg" }`.

3.  **Seguridad por Diseño**:
    *   Las sesiones no se guardan en el navegador (localStorage), sino en Cookies `httpOnly` para mitigar XSS.
    *   Las contraseñas nunca se guardan en texto plano.
