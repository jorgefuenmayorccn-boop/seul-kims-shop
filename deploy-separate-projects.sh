#!/bin/bash
# SEUL KING OS v1.0 — Plan B: Deploy Individual Apps as Separate Vercel Projects
# Use this if monorepo deployment fails repeatedly

set -e

REPO_ROOT="/Users/vertice/vertice_productions/seul-kims-os"
TEMP_DIR="/tmp/seul-vercel-deploys"

echo "🇰🇷 SEUL KING OS — Plan B: Separate Vercel Projects"
echo "===================================================="
echo ""
echo "⚠️  This approach deploys each app as a separate Vercel project"
echo "    instead of trying to use the monorepo."
echo ""

# Create temp directory
mkdir -p "$TEMP_DIR"

# Function to deploy individual app
deploy_individual_app() {
    local APP_NAME=$1
    local APP_PATH=$2
    local DOMAIN=$3
    local PROJECT_DIR="$TEMP_DIR/$APP_NAME"

    echo ""
    echo "📦 [$APP_NAME] Preparing deployment..."

    # Create project directory
    rm -rf "$PROJECT_DIR"
    mkdir -p "$PROJECT_DIR"

    # Copy monorepo files needed for pnpm
    cp "$REPO_ROOT/.npmrc" "$PROJECT_DIR/"
    cp "$REPO_ROOT/.nvmrc" "$PROJECT_DIR/"
    cp "$REPO_ROOT/pnpm-lock.yaml" "$PROJECT_DIR/"
    cp "$REPO_ROOT/pnpm-workspace.yaml" "$PROJECT_DIR/"
    cp "$REPO_ROOT/package.json" "$PROJECT_DIR/"
    cp "$REPO_ROOT/turbo.json" "$PROJECT_DIR/"
    cp "$REPO_ROOT/tsconfig.json" "$PROJECT_DIR/"

    # Copy full apps and packages structure
    cp -r "$REPO_ROOT/apps/$APP_PATH" "$PROJECT_DIR/app"
    cp -r "$REPO_ROOT/packages" "$PROJECT_DIR/"

    # Create minimal vercel.json for this app
    cat > "$PROJECT_DIR/vercel.json" <<EOF
{
  "buildCommand": "npm install -g pnpm@9.15.0 && pnpm install --frozen-lockfile && pnpm build --filter @seul/$APP_NAME",
  "installCommand": "npm install -g pnpm@9.15.0 && pnpm install --frozen-lockfile",
  "outputDirectory": "app/.next"
}
EOF

    # Deploy
    echo "   Deploying to Vercel..."
    cd "$PROJECT_DIR"

    VERCEL_URL=$(vercel deploy --prod --skip-domain 2>&1 | grep "Production:" | awk '{print $NF}')

    if [ ! -z "$VERCEL_URL" ]; then
        echo "   ✅ Deployed: $VERCEL_URL"
        echo "   Assigning domain: $DOMAIN"

        # Try to assign domain
        vercel alias set "$VERCEL_URL" "$DOMAIN" 2>/dev/null || echo "   ⚠️  Manual alias: vercel alias set $VERCEL_URL $DOMAIN"
    else
        echo "   ❌ Deploy failed - check logs above"
    fi

    echo ""
}

# Deploy each app
echo "🔍 Deploying apps individually..."

deploy_individual_app "web" "web" "seoulshop.cl"
deploy_individual_app "pos" "pos" "pos.seoulshop.cl"
deploy_individual_app "cerebro" "cerebro" "cmr.seoulshop.cl"
deploy_individual_app "repartidor" "repartidor" "drive.seoulshop.cl"

echo ""
echo "✅ Individual app deployments complete"
echo ""
echo "📝 Next steps:"
echo "   1. Wait for DNS to propagate (5-30 min)"
echo "   2. Deploy API in Cloudflare Workers"
echo "   3. Run seed: npx tsx packages/db/src/seed-production.ts"
echo "   4. Validate login at https://cmr.seoulshop.cl/login"
echo ""
echo "🧹 Cleanup: rm -rf $TEMP_DIR"
echo ""

