#!/bin/bash
# SEUL KING OS v1.0 — Deploy de Apps Restantes (POS, CEREBRO, REPARTIDOR)
# Ejecutar DESPUÉS de que web esté deployado exitosamente

set -e

REPO_ROOT="/Users/vertice/vertice_productions/seul-kims-os"
cd "$REPO_ROOT"

echo "🇰🇷 SEUL KING OS — Deploy de Apps Restantes"
echo "=========================================="
echo ""

# Deploy POS
echo "📦 [1/3] Desplegando SEUL POS..."
cd "$REPO_ROOT"
cat > vercel.json <<'EOF'
{
  "buildCommand": "pnpm install --frozen-lockfile && pnpm build --filter @seul/pos",
  "installCommand": "corepack enable pnpm && pnpm install --frozen-lockfile",
  "outputDirectory": "apps/pos/.next",
  "framework": "nextjs"
}
EOF
cd apps/pos
VERCEL_POS_URL=$(vercel deploy --prod --skip-domain 2>&1 | grep "Production:" | awk '{print $NF}')
echo "✅ POS desplegado: $VERCEL_POS_URL"
if [ ! -z "$VERCEL_POS_URL" ]; then
  vercel alias set "$VERCEL_POS_URL" pos.seoulshop.cl 2>/dev/null || echo "⚠️  Alias manual: vercel alias set $VERCEL_POS_URL pos.seoulshop.cl"
fi
echo ""

# Deploy CEREBRO
echo "📦 [2/3] Desplegando SEUL KING OS (CEREBRO)..."
cd "$REPO_ROOT"
cat > vercel.json <<'EOF'
{
  "buildCommand": "pnpm install --frozen-lockfile && pnpm build --filter @seul/cerebro",
  "installCommand": "corepack enable pnpm && pnpm install --frozen-lockfile",
  "outputDirectory": "apps/cerebro/.next",
  "framework": "nextjs"
}
EOF
cd apps/cerebro
VERCEL_CEREBRO_URL=$(vercel deploy --prod --skip-domain 2>&1 | grep "Production:" | awk '{print $NF}')
echo "✅ CEREBRO desplegado: $VERCEL_CEREBRO_URL"
if [ ! -z "$VERCEL_CEREBRO_URL" ]; then
  vercel alias set "$VERCEL_CEREBRO_URL" cmr.seoulshop.cl 2>/dev/null || echo "⚠️  Alias manual: vercel alias set $VERCEL_CEREBRO_URL cmr.seoulshop.cl"
fi
echo ""

# Deploy REPARTIDOR
echo "📦 [3/3] Desplegando SEUL DRIVE (REPARTIDOR)..."
cd "$REPO_ROOT"
cat > vercel.json <<'EOF'
{
  "buildCommand": "pnpm install --frozen-lockfile && pnpm build --filter @seul/repartidor",
  "installCommand": "corepack enable pnpm && pnpm install --frozen-lockfile",
  "outputDirectory": "apps/repartidor/.next",
  "framework": "nextjs"
}
EOF
cd apps/repartidor
VERCEL_REPARTIDOR_URL=$(vercel deploy --prod --skip-domain 2>&1 | grep "Production:" | awk '{print $NF}')
echo "✅ REPARTIDOR desplegado: $VERCEL_REPARTIDOR_URL"
if [ ! -z "$VERCEL_REPARTIDOR_URL" ]; then
  vercel alias set "$VERCEL_REPARTIDOR_URL" drive.seoulshop.cl 2>/dev/null || echo "⚠️  Alias manual: vercel alias set $VERCEL_REPARTIDOR_URL drive.seoulshop.cl"
fi
echo ""

echo "✅ Todos los deploys completados"
echo ""
echo "🔗 URLs de producción:"
echo "   - SEUL SHOP:   https://seoulshop.cl"
echo "   - SEUL POS:    https://pos.seoulshop.cl"
echo "   - SEUL KING OS: https://cmr.seoulshop.cl"
echo "   - SEUL DRIVE:  https://drive.seoulshop.cl"
echo ""
echo "📝 Próximo paso: Desplegar API en Cloudflare Workers"
echo "   cd packages/api && wrangler deploy"
echo ""
