# Multi-stage build for SEUL API (Production)
FROM node:24-alpine AS base
WORKDIR /app
RUN npm install -g pnpm@9

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile

FROM base AS builder
RUN pnpm --filter @seul/api build

FROM node:24-alpine AS runtime
WORKDIR /app
RUN npm install -g pnpm@9

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/api ./packages/api
COPY --from=builder /app/packages/db ./packages/db
# @seul/dte + @seul/pdf-templates (SEUL_SESSION_boletas-80mm): @seul/api ahora
# los importa (emitDte del MockDTEProvider + STORE_INFO) — sin esto, node_modules
# tiene el symlink de pnpm pero el destino no existe en esta imagen y el
# arranque revienta con ERR_MODULE_NOT_FOUND. Cualquier package nuevo del que
# @seul/api pase a depender debe agregarse acá también.
COPY --from=builder /app/packages/dte ./packages/dte
COPY --from=builder /app/packages/pdf-templates ./packages/pdf-templates
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/package.json ./

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

ENV NODE_ENV=production
ENV PORT=8080

CMD ["pnpm", "--filter", "@seul/api", "start"]
