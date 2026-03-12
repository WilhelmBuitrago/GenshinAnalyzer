# ---------- Builder ----------
FROM node:20-alpine AS builder

WORKDIR /app

ARG NEXT_PUBLIC_BACKEND_API
ENV NEXT_PUBLIC_BACKEND_API=$NEXT_PUBLIC_BACKEND_API

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

RUN npm run build


# ---------- Runner ----------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000

# Copiamos solo lo necesario del build standalone
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

CMD ["sh", "-c", "PORT=$PORT node server.js"]