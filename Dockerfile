# =========================================================================
# Etapa 1: Construcción (Builder) - Instalación y Compilación TypeScript
# =========================================================================
FROM node:20-slim AS builder

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY tsconfig.json ./
COPY src ./src/

RUN npm run prisma:generate && npm run build

# =========================================================================
# Etapa 2: Producción (Runtime) - Imagen ligera optimizada
# =========================================================================
FROM node:20-slim AS production

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL="file:/app/data/prod.db"

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY frontend ./frontend

RUN mkdir -p /app/data

EXPOSE 3000

CMD ["sh", "-c", "npm run prisma:deploy && npm start"]
