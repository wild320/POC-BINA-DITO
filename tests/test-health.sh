#!/usr/bin/env bash
# =============================================================================
# test-health.sh
# Script para verificar el estado del servicio mediante el endpoint /health
# =============================================================================

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║         POC Bina-Dito - Health Check             ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "→ URL: ${BASE_URL}/health"
echo ""

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/health")
BODY=$(curl -s "${BASE_URL}/health")

if [ "$RESPONSE" = "200" ]; then
  echo "✅ Servicio disponible (HTTP $RESPONSE)"
else
  echo "❌ Servicio no disponible (HTTP $RESPONSE)"
fi

echo ""
echo "Respuesta completa:"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
echo ""
