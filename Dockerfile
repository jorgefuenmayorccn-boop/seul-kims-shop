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
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/package.json ./

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

ENV NODE_ENV=production
ENV PORT=8080

CMD ["pnpm", "--filter", "@seul/api", "start"]
