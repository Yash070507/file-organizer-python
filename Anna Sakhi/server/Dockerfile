# ── Stage 1: deps ──────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ── Stage 2: runtime ────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# Copy installed deps and source
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Cloud Run injects PORT automatically (default 8080)
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "index.js"]
