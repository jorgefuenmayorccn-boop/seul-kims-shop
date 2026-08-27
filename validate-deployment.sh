#!/bin/bash
# SEUL KING OS v1.0 — Script de Validación Post-Deploy

echo "🇰🇷 SEUL KING OS v1.0 — Validación de Deployment"
echo "=================================================="
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_url() {
    local url=$1
    local name=$2

    echo -n "🔍 Verificando $name... "

    status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url")

    if [ "$status" = "200" ] || [ "$status" = "308" ] || [ "$status" = "301" ]; then
        echo -e "${GREEN}✅ ($status)${NC}"
        return 0
    else
        echo -e "${RED}❌ ($status)${NC}"
        return 1
    fi
}

echo "📝 Verificando URLs de producción..."
echo ""

# Verificar DNS
echo "🌐 DNS Resolution:"
for domain in seoulshop.cl pos.seoulshop.cl cmr.seoulshop.cl drive.seoulshop.cl; do
    echo -n "  $domain → "
    ip=$(dig +short $domain @8.8.8.8 | head -1)
    if [ ! -z "$ip" ]; then
        echo -e "${GREEN}$ip${NC}"
    else
        echo -e "${RED}No resuelve${NC}"
    fi
done

echo ""
echo "🌐 HTTP Verificación:"

# Verificar SEUL SHOP
check_url "https://seoulshop.cl" "SEUL SHOP (https://seoulshop.cl)"

# Verificar SEUL POS
check_url "https://pos.seoulshop.cl/login" "SEUL POS (https://pos.seoulshop.cl)"

# Verificar SEUL KING OS / CEREBRO
check_url "https://cmr.seoulshop.cl/login" "SEUL KING OS (https://cmr.seoulshop.cl)"

# Verificar SEUL DRIVE
check_url "https://drive.seoulshop.cl/login" "SEUL DRIVE (https://drive.seoulshop.cl)"

# Verificar API
check_url "https://api.seoulshop.cl/health" "API Gateway (https://api.seoulshop.cl/health)"

echo ""
echo "📊 Resultados:"
echo ""

# Resum
echo "✅ Si todas las URLs están en verde, el deployment fue exitoso"
echo "❌ Si hay URLs en rojo, revisar:"
echo "   - DNS propagación (puede tardar 5-30 min)"
echo "   - Vercel build logs"
echo "   - Cloudflare DNS records"
echo ""

echo "📱 Próximas verificaciones manuales:"
echo ""
echo "1. Acceder a https://cmr.seoulshop.cl/login"
echo "   - Email: founder@seoulkims.cl"
echo "   - Contraseña: (ver CREDENCIALES_PRODUCCION.md)"
echo "   - ¿Sistema pide cambiar contraseña?"
echo ""
echo "2. Acceder a https://seoulshop.cl"
echo "   - ¿Se ven productos en el catálogo?"
echo ""
echo "3. Verificar API:"
echo "   curl https://api.seoulshop.cl/health"
echo "   - Debe retornar JSON: {\"status\":\"ok\"}"
echo ""

