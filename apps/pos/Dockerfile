FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy root package files
COPY package.json pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/pos/ ./apps/pos/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build only pos app
RUN pnpm --filter @seul/pos build

# Start pos app
EXPOSE 3001
CMD ["pnpm", "--filter", "@seul/pos", "start"]
