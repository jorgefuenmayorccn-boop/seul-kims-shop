FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm@9

COPY ../../package.json ../../pnpm-lock.yaml ./
COPY ../../packages/ ./packages/
COPY . ./apps/web/

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @seul/web build

EXPOSE 3000

ENV NODE_ENV=production
CMD ["sh", "-c", "cd /app/apps/web && /app/node_modules/.bin/next start -p ${PORT:-3000}"]
