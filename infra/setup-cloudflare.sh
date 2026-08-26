#!/bin/bash
# SEUL KING OS — Setup inicial Cloudflare
# Ejecutar UNA VEZ antes del primer deploy

set -e

echo "🔧 Creando recursos Cloudflare..."

# KV Namespaces
echo "Creando KV: SESSIONS..."
wrangler kv:namespace create SESSIONS
echo "Creando KV: CARTS..."
wrangler kv:namespace create CARTS
echo "Creando KV (dev): SESSIONS..."
wrangler kv:namespace create SESSIONS --env dev
echo "Creando KV (dev): CARTS..."
wrangler kv:namespace create CARTS --env dev

# R2 Buckets
echo "Creando R2: seul-kims-pdfs..."
wrangler r2 bucket create seul-kims-pdfs
echo "Creando R2 (dev): seul-kims-pdfs-dev..."
wrangler r2 bucket create seul-kims-pdfs-dev

# Queues
echo "Creando Queue: seul-kims-dte..."
wrangler queues create seul-kims-dte

echo ""
echo "✅ Recursos creados. Actualiza los IDs en wrangler.toml:"
echo "  packages/api/wrangler.toml → REPLACE_WITH_KV_ID"
echo ""
echo "Luego configura los secrets:"
echo "  cd packages/api"
echo "  wrangler secret put DATABASE_URL"
echo "  wrangler secret put DTE_API_KEY"
echo "  wrangler secret put DTE_RUT_EMPRESA"
echo "  wrangler secret put UPSTASH_REDIS_URL"
echo "  wrangler secret put UPSTASH_REDIS_TOKEN"
echo "  wrangler secret put SENTRY_DSN"
echo "  wrangler secret put ANTHROPIC_API_KEY"
