FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy root package files
COPY package.json pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/cerebro/ ./apps/cerebro/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build only cerebro app
RUN pnpm --filter @seul/cerebro build

# Start cerebro app
EXPOSE 3003
CMD ["pnpm", "--filter", "@seul/cerebro", "start"]
