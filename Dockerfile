# Dockerfile para Saul-Finanzas (Nivel 2 - Producción)
FROM node:20-alpine

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

# Copiar e instalar dependencias
COPY package.json ./
RUN apk add --no-cache python3 make g++ && \
    npm install --production && \
    apk del python3 make g++

# Copiar código fuente
COPY --chown=nodejs:nodejs . .

# Crear directorio de datos con permisos correctos
RUN mkdir -p /app/data && chown -R nodejs:nodejs /app/data

# Cambiar a usuario no-root
USER nodejs

EXPOSE 3000

# Health check para orquestadores (Docker Swarm, Kubernetes, etc.)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/me', (r) => process.exit(r.statusCode === 401 ? 0 : 1))" || exit 1

CMD ["node", "server.js"]
