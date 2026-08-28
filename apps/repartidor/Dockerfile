FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm@9

COPY ../../package.json ../../pnpm-lock.yaml ./
COPY ../../packages/ ./packages/
COPY . ./apps/repartidor/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @seul/repartidor build

EXPOSE 3002

ENV NODE_ENV=production
CMD ["sh", "-c", "cd /app/apps/repartidor && /app/node_modules/.bin/next start -p ${PORT:-3002}"]
