#!/usr/bin/env bash
# ============================================================================
# test-all-emails.sh — SESSION 20
# ============================================================================
# Herramienta QA INTERNA de VÉRTICE — NO se entrega al cliente.
# Levanta el servidor local, dispara los 27 emails de prueba (packages/api/src/
# test-harness.ts + run-test-harness.ts), hace polling real contra email_queue
# en Neon, imprime tabla final y apaga el servidor.
#
# Uso:
#   TEST_EMAIL=jsfuenmayorproduction@gmail.com bash packages/api/test-all-emails.sh
#
# Exit 0 si los 27 quedaron 'sent'; exit 1 si hubo failed/pending/timeout.
# ============================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export TEST_EMAIL="${TEST_EMAIL:-jsfuenmayorproduction@gmail.com}"
export API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"

SERVER_LOG="/tmp/seul-api-test-$$.log"
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "🛑 Deteniendo servidor local (PID $SERVER_PID)..."
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "🚀 Iniciando servidor local (tsx src/server.ts)..."
npx tsx --env-file=.dev.vars src/server.ts > "$SERVER_LOG" 2>&1 &
SERVER_PID=$!

echo "⏳ Esperando health check en $API_BASE_URL/health..."
READY=0
for i in $(seq 1 20); do
  if curl -s -f "$API_BASE_URL/health" > /dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 0.5
done

if [ "$READY" -ne 1 ]; then
  echo "❌ El servidor no respondió a tiempo. Log:"
  cat "$SERVER_LOG"
  exit 1
fi
echo "✅ Servidor listo."

echo "🧪 Ejecutando arnés de prueba (27 emails) contra $TEST_EMAIL..."
npx tsx --env-file=.dev.vars src/run-test-harness.ts
EXIT_CODE=$?

echo ""
echo "📋 Log del servidor: $SERVER_LOG"

exit $EXIT_CODE
