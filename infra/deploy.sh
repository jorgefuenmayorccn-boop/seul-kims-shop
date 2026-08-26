#!/bin/bash
# SEUL KING OS v1.0 — Script de deploy
# Ejecutar desde la raíz del monorepo

set -e

echo "🇰🇷 SEUL KING OS — Deploy iniciado"
echo "========================================"

# 1. Instalar dependencias
echo "[1/5] Instalando dependencias..."
pnpm install --frozen-lockfile

# 2. Build
echo "[2/5] Build completo..."
pnpm build

# 3. Deploy API (Cloudflare Workers)
echo "[3/5] Desplegando @seul/api → Cloudflare Workers..."
cd packages/api
pnpm deploy
cd ../..

# 4. Deploy Web (Cloudflare Pages)
echo "[4/5] Desplegando @seul/web → Cloudflare Pages..."
cd apps/web
npx wrangler pages deploy .next --project-name seul-kims-web
cd ../..

# 5. Deploy POS (Cloudflare Pages)
echo "[5/5] Desplegando @seul/pos → Cloudflare Pages..."
cd apps/pos
npx wrangler pages deploy .next --project-name seul-kims-pos
cd ../..

echo ""
echo "✅ Deploy completado"
echo ""
echo "URLs de producción:"
echo "  API:  https://api.seoulkims.cl (Worker)"
echo "  Web:  https://seoulkims.cl (Pages)"
echo "  POS:  https://pos.seoulkims.cl (Pages)"
echo ""
echo "⚠️  Verificar en el dashboard Cloudflare:"
echo "  - KV namespaces SESSIONS y CARTS creados"
echo "  - R2 bucket seul-kims-pdfs creado"
echo "  - Queue seul-kims-dte creada"
echo "  - Secrets configurados (wrangler secret put <KEY>)"
