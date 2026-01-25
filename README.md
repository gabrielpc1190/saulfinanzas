# Saul-Finanzas 💰

Sistema de control financiero personal "self-hosted" optimizado para privacidad y rendimiento.

**Versión**: 2.5 (Producción)
**Stack**: Node.js + SQLite + Vanilla JS.

## 📚 Documentación

La documentación técnica detallada se encuentra en la carpeta `.docs/`:

*   [🏛️ Arquitectura](.docs/ARCHITECTURE.md): Visión global del sistema.
*   [🔌 Referencia de API](.docs/API_REFERENCE.md): Endpoints del backend.
*   [🖥️ Guía Frontend](.docs/FRONTEND_GUIDE.md): Estructura de `app.js` y estilos.
*   [🤖 Contexto para IA](.docs/AI_CONTEXT.md): Guía para agentes inteligentes.
*   [📉 Reporte de Estado](.docs/STATUS_REPORT.md): Roadmap y deuda técnica.

## 🚀 Despliegue Rápido

### Requisitos
*   Docker & Docker Compose

### Instalación
```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd saul-finanzas

# 2. Iniciar el servicio
docker compose up -d

# 3. Acceder en el navegador
# http://localhost:3000
```

### Credenciales por Defecto
*   **Usuario**: `admin`
*   **Contraseña**: `Admin123!` (Se recomienda cambiarla inmediatamente en Ajustes).

## 🛡️ Seguridad
Este sistema utiliza cookies `httpOnly` y hash `bcrypt` para las contraseñas. Asegúrese de correr detrás de un proxy inverso con HTTPS (Nginx/Caddy) si se expone a internet.
