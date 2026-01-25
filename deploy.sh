#!/bin/bash

# --- Script de Despliegue Saul-Finanzas ---
# Uso: ./deploy.sh
# ------------------------------------------

echo "🚀 Iniciando actualización desde GitHub (rama main)..."

# 1. Sincronizar código remoto
if git pull origin main; then
    echo "✅ Código sincronizado correctamente."
else
    echo "❌ Error al sincronizar con Git. Verifica tu conexión o conflictos."
    exit 1
fi

# 2. Reconstruir y reiniciar contenedores
echo "📦 Reconstruyendo imágenes y reiniciando contenedores Docker..."
if docker compose up --build -d; then
    echo "✅ ¡Servidor actualizado y en línea!"
    echo "🌐 Visita tu aplicación para ver los cambios."
else
    echo "❌ Error al levantar Docker Compose."
    exit 1
fi
