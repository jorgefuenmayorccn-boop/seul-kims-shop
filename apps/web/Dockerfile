FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy root package files
COPY package.json pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build only web app
RUN pnpm --filter @seul/web build

# Start web app
EXPOSE 3000
CMD ["pnpm", "--filter", "@seul/web", "start"]
