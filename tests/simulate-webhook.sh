#!/usr/bin/env bash
# =============================================================================
# simulate-webhook.sh
# Script para simular los diferentes tipos de eventos de webhook de Meta
# Útil para probar el servidor localmente sin necesidad de Meta Developers
#
# USO:
#   bash tests/simulate-webhook.sh
#   BASE_URL=https://tu-ngrok-url.ngrok.io bash tests/simulate-webhook.sh
# =============================================================================

BASE_URL="${BASE_URL:-http://localhost:3000}"
WEBHOOK_URL="${BASE_URL}/webhook/whatsapp"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # Sin color

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║    POC Bina-Dito - Simulador de Webhooks         ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# Función auxiliar para imprimir resultados de cada prueba
print_result() {
  local test_name="$1"
  local http_code="$2"
  local response_body="$3"

  echo -e "${YELLOW}─────────────────────────────────────────────────${NC}"
  echo -e "${CYAN}Prueba: ${test_name}${NC}"
  if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✅ HTTP $http_code${NC}"
  else
    echo -e "${RED}❌ HTTP $http_code${NC}"
  fi
  if [ -n "$response_body" ]; then
    echo "Respuesta: $response_body"
  fi
  echo ""
}

# =============================================================================
# PRUEBA 1: Verificación del webhook (GET)
# Meta hace este request para validar la URL del webhook
# =============================================================================
echo -e "${CYAN}[1/5] Verificación del webhook (GET)${NC}"
echo "Simula la validación inicial que hace Meta al configurar el webhook."
echo ""

VERIFY_TOKEN="${META_WEBHOOK_VERIFY_TOKEN:-BINA_WHATSAPP_VERIFY_2026_S3CR3T}"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  "${WEBHOOK_URL}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=TEST_CHALLENGE_12345")
BODY=$(curl -s \
  "${WEBHOOK_URL}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=TEST_CHALLENGE_12345")

print_result "Verificación webhook (token correcto)" "$HTTP_CODE" "$BODY"

# Prueba con token incorrecto (debe devolver 403)
HTTP_CODE_WRONG=$(curl -s -o /dev/null -w "%{http_code}" \
  "${WEBHOOK_URL}?hub.mode=subscribe&hub.verify_token=TOKEN_INCORRECTO&hub.challenge=ABC")
print_result "Verificación webhook (token incorrecto - espera 403)" "$HTTP_CODE_WRONG" ""

# =============================================================================
# PRUEBA 2: Mensaje de texto entrante (POST)
# Simula un usuario que envía "Hola, necesito información"
# =============================================================================
echo -e "${CYAN}[2/5] Mensaje de texto entrante (POST)${NC}"
echo "Simula un mensaje de texto de un usuario de WhatsApp."
echo ""

TEXT_PAYLOAD='{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "TEST_WABA_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "573001234567",
          "phone_number_id": "TEST_PHONE_NUMBER_ID"
        },
        "contacts": [{
          "profile": { "name": "Juan Pérez" },
          "wa_id": "573009876543"
        }],
        "messages": [{
          "from": "573009876543",
          "id": "wamid.TEST001ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij",
          "timestamp": "1712678400",
          "type": "text",
          "text": { "body": "Hola, necesito información sobre mis facturas" }
        }]
      },
      "field": "messages"
    }]
  }]
}'

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -d "$TEXT_PAYLOAD")

print_result "Mensaje de texto entrante" "$HTTP_CODE" ""

# =============================================================================
# PRUEBA 3: Mensaje con imagen (POST)
# Simula un usuario que envía una imagen
# =============================================================================
echo -e "${CYAN}[3/5] Mensaje con imagen (POST)${NC}"
echo "Simula el envío de una imagen por parte del usuario."
echo ""

IMAGE_PAYLOAD='{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "TEST_WABA_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "573001234567",
          "phone_number_id": "TEST_PHONE_NUMBER_ID"
        },
        "contacts": [{
          "profile": { "name": "María García" },
          "wa_id": "573001112222"
        }],
        "messages": [{
          "from": "573001112222",
          "id": "wamid.TEST002IMAGE",
          "timestamp": "1712678500",
          "type": "image",
          "image": {
            "caption": "Esta es la factura",
            "mime_type": "image/jpeg",
            "sha256": "ABCDEF1234567890",
            "id": "MEDIA_ID_TEST_IMAGE_001"
          }
        }]
      },
      "field": "messages"
    }]
  }]
}'

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -d "$IMAGE_PAYLOAD")

print_result "Mensaje con imagen entrante" "$HTTP_CODE" ""

# =============================================================================
# PRUEBA 4: Respuesta a botón interactivo (POST)
# Simula un usuario que hace clic en uno de los botones enviados
# =============================================================================
echo -e "${CYAN}[4/5] Respuesta a botón interactivo (POST)${NC}"
echo "Simula el clic de un usuario en un botón de respuesta rápida."
echo ""

BUTTON_PAYLOAD='{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "TEST_WABA_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "573001234567",
          "phone_number_id": "TEST_PHONE_NUMBER_ID"
        },
        "contacts": [{
          "profile": { "name": "Carlos López" },
          "wa_id": "573003334444"
        }],
        "messages": [{
          "from": "573003334444",
          "id": "wamid.TEST003BUTTON",
          "timestamp": "1712678600",
          "type": "interactive",
          "interactive": {
            "type": "button_reply",
            "button_reply": {
              "id": "btn_ver_saldo",
              "title": "Ver saldo"
            }
          }
        }]
      },
      "field": "messages"
    }]
  }]
}'

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -d "$BUTTON_PAYLOAD")

print_result "Respuesta a botón interactivo" "$HTTP_CODE" ""

# =============================================================================
# PRUEBA 5: Notificación de estado de mensaje (POST)
# Meta notifica cuando un mensaje es entregado o leído
# =============================================================================
echo -e "${CYAN}[5/5] Notificación de estado de mensaje (POST)${NC}"
echo "Simula la notificación de Meta cuando un mensaje es leído por el usuario."
echo ""

STATUS_PAYLOAD='{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "TEST_WABA_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "573001234567",
          "phone_number_id": "TEST_PHONE_NUMBER_ID"
        },
        "statuses": [{
          "id": "wamid.TEST001ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij",
          "status": "read",
          "timestamp": "1712678700",
          "recipient_id": "573009876543"
        }]
      },
      "field": "messages"
    }]
  }]
}'

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${WEBHOOK_URL}" \
  -H "Content-Type: application/json" \
  -d "$STATUS_PAYLOAD")

print_result "Notificación de estado (leído)" "$HTTP_CODE" ""

# =============================================================================
# Resumen
# =============================================================================
echo -e "${CYAN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║              Simulación completada               ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo "Para ver los logs del servidor en tiempo real:"
echo "  npm run dev"
echo ""
echo "Para probar con una URL pública (ngrok):"
echo "  BASE_URL=https://abc123.ngrok.io bash tests/simulate-webhook.sh"
echo ""
