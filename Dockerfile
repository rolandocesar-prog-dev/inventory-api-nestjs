# syntax=docker/dockerfile:1

# 1) Dependencias completas (incluye las de desarrollo para compilar)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2) Compilación (genera el cliente de Prisma). Esta etapa también aplica las migraciones
#    en docker compose (servicio `migrate`), porque tiene la CLI de Prisma.
FROM deps AS build
COPY . .
RUN npm run build

# 3) Poda de dependencias de desarrollo para la imagen final
FROM build AS prune
RUN npm prune --omit=dev

# 4) Imagen final mínima, sin herramientas de compilación y sin root
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prune --chown=node:node /app/package.json ./
COPY --from=prune --chown=node:node /app/node_modules ./node_modules
COPY --from=prune --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "dist/main.js"]
