#!/bin/bash
# SEUL KING OS v1.0 — Deploy API en Cloudflare Workers

set -e

REPO_ROOT="/Users/vertice/vertice_productions/seul-kims-os"
cd "$REPO_ROOT/packages/api"

echo "🇰🇷 SEUL KING OS — Deploy API en Cloudflare Workers"
echo "===================================================="
echo ""

echo "⚠️  NOTA: Necesitas configurar los secrets de Cloudflare ANTES de desplegar"
echo ""

# Solicitar confirmación
read -p "¿Has configurado todos los secrets? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancele. Primero configura los secrets:"
    echo ""
    echo "Ejecuta estos comandos:"
    echo "  wrangler secret put DATABASE_URL"
    echo "  wrangler secret put DTE_API_KEY"
    echo "  wrangler secret put DTE_RUT_EMPRESA"
    echo "  wrangler secret put UPSTASH_REDIS_URL"
    echo "  wrangler secret put UPSTASH_REDIS_TOKEN"
    echo "  wrangler secret put SENTRY_DSN (opcional)"
    echo ""
    exit 1
fi

echo "✅ Procediendo con deploy..."
echo ""

# Deploy
echo "📦 Desplegando @seul/api en Cloudflare Workers..."
wrangler deploy

echo ""
echo "✅ API desplegada"
echo ""
echo "🔗 Verificar que esté online:"
echo "   curl https://api.seoulshop.cl/health"
echo ""
echo "📝 Próximos pasos:"
echo "   1. Esperar propagación de DNS (5-30 min)"
echo "   2. Ejecutar seed: npx tsx packages/db/src/seed-production.ts"
echo "   3. Validar login en https://cmr.seoulshop.cl/login"
echo ""
