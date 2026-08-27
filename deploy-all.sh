#!/bin/bash
# SEUL KING OS v1.0 — Deploy a Vercel (todas las apps)

set -e

REPO_ROOT="/Users/vertice/vertice_productions/seul-kims-os"
cd "$REPO_ROOT"

echo "🇰🇷 SEUL KING OS v1.0 — Deploy a Vercel"
echo "=========================================="
echo ""

# Función para desplegar una app
deploy_app() {
    local APP_NAME=$1
    local APP_PATH=$2
    local DOMAIN=$3

    echo "📦 Desplegando: $APP_NAME → $DOMAIN"
    echo "─────────────────────────────────────"

    cd "$REPO_ROOT"

    # Crear vercel.json específico para cada app
    cat > vercel.json <<EOF
{
  "buildCommand": "pnpm build --filter @seul/$APP_NAME",
  "installCommand": "pnpm install --frozen-lockfile",
  "outputDirectory": "apps/$APP_PATH/.next",
  "framework": "nextjs"
}
EOF

    # Deploy
    vercel deploy --prod

    echo "✅ $APP_NAME desplegado"
    echo ""
}

# Deploy cada app
deploy_app "web" "web" "seoulshop.cl"
deploy_app "pos" "pos" "pos.seoulshop.cl"
deploy_app "cerebro" "cerebro" "cmr.seoulshop.cl"
deploy_app "repartidor" "repartidor" "drive.seoulshop.cl"

echo "✅ Todos los deploys completados"
echo ""
echo "🔗 URLs de producción:"
echo "   - SEUL SHOP:   https://seoulshop.cl"
echo "   - SEUL POS:    https://pos.seoulshop.cl"
echo "   - SEUL KING OS: https://cmr.seoulshop.cl"
echo "   - SEUL DRIVE:  https://drive.seoulshop.cl"
echo ""
