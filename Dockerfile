FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/ ./apps/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build all apps
RUN pnpm build

# Expose ports (Railway will override with $PORT)
EXPOSE 3000 3001 3002 3003 8787

# Default: start web app (Railway specifies which app via environment)
CMD ["sh", "-c", "if [ \"$APP_TYPE\" = \"pos\" ]; then pnpm --filter @seul/pos start; elif [ \"$APP_TYPE\" = \"cerebro\" ]; then pnpm --filter @seul/cerebro start; elif [ \"$APP_TYPE\" = \"repartidor\" ]; then pnpm --filter @seul/repartidor start; else pnpm --filter @seul/web start; fi"]
