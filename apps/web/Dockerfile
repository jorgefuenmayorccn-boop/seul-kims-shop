FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm@9

# Copy monorepo root files
COPY package.json pnpm-lock.yaml ./

# Copy packages directory
COPY packages/ ./packages/

# Copy only this app
COPY apps/web/ ./apps/web/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build only this app
RUN pnpm --filter @seul/web build

EXPOSE 3000

ENV NODE_ENV=production
CMD ["/app/node_modules/.bin/next", "start", "-p", "3000"]
