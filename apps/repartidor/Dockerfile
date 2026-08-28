FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy root package files
COPY package.json pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/repartidor/ ./apps/repartidor/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build only repartidor app
RUN pnpm --filter @seul/repartidor build

# Start repartidor app
EXPOSE 3002
CMD ["pnpm", "--filter", "@seul/repartidor", "start"]
