# POC - Integración WhatsApp Business (Meta) ↔ Bina IA

## Resumen Ejecutivo

Este repositorio contiene la **Prueba de Concepto (PoC)** para la integración del canal **Meta WhatsApp Business Cloud API** con el agente de inteligencia artificial **Bina** de Abako ERP.

La solución implementa un servidor intermediario (middleware) en Node.js que actúa como puente entre la plataforma de mensajería de Meta y el motor de IA Bina, permitiendo que los usuarios de WhatsApp interactúen directamente con el agente de IA a través de su aplicación de mensajería habitual.

---

## Arquitectura General

```
┌─────────────┐      HTTPS/TLS      ┌───────────────────┐      HTTPS/TLS     ┌──────────────────┐
│   Usuario   │◄───────────────────►│   Meta Cloud API  │◄──────────────────►│  Nuestro Backend │
│  WhatsApp   │                     │  (graph.facebook  │                     │  (Node.js/       │
│             │                     │    .com/v21.0)    │                     │   Express)       │
└─────────────┘                     └───────────────────┘                     └────────┬─────────┘
                                                                                        │
                                                                                        │ HTTPS/TLS
                                                                                        │ POST
                                                                                        ▼
                                                                              ┌──────────────────┐
                                                                              │    Bina IA       │
                                                                              │ clouderp.abako   │
                                                                              │ erp.com:9619/    │
                                                                              │ apiagenteia      │
                                                                              └──────────────────┘
```

### Flujo simplificado:

```
[Mensaje entrante]
Usuario → WhatsApp → Meta Cloud API → POST /webhook/whatsapp → Nuestro Backend → Bina IA

[Respuesta saliente]
Bina IA → Nuestro Backend → POST graph.facebook.com/.../messages → Meta → WhatsApp → Usuario
```

---

## Requisitos Previos

| Requisito | Versión/Detalle |
|-----------|----------------|
| **Node.js** | 20 o superior |
| **npm** | 10 o superior |
| **Cuenta Meta Business** | Con app tipo "Business" en developers.facebook.com |
| **WhatsApp Business API** | Producto habilitado en la app de Meta |
| **Acceso a Bina** | Endpoint: `https://clouderp.abakoerp.com:9619/apiagenteia` |
| **HTTPS** | URL pública con SSL (ngrok, Let's Encrypt, Cloudflare, etc.) |

---

## Instalación y Configuración

### 1. Clonar el repositorio

```bash
git clone https://github.com/wild320/POC-BINA-DITO.git
cd POC-BINA-DITO
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
# Copiar el archivo de ejemplo
cp .env.example .env

# Editar con tus credenciales
nano .env   # o el editor de tu preferencia
```

### 4. Iniciar el servidor

```bash
# Modo desarrollo (con recarga automática)
npm run dev

# Modo producción
npm start
```

### 5. Exponer el servidor con ngrok (para desarrollo)

```bash
# En otra terminal
npm run tunnel
# → Copiar la URL HTTPS generada (ej: https://abc123.ngrok.io)
# → Configurar esa URL + /webhook/whatsapp en Meta Developers
```

---

## Variables de Entorno

| Variable | Requerida | Descripción | Ejemplo |
|----------|-----------|-------------|---------|
| `META_APP_ID` | No | ID de la app en Meta Developers | `123456789` |
| `META_APP_SECRET` | **Sí** | Secreto de la app (para validar firmas HMAC) | `abc123def456...` |
| `META_ACCESS_TOKEN` | **Sí** | Token de acceso permanente (System User Token) | `EAAxxxxxxx...` |
| `META_PHONE_NUMBER_ID` | **Sí** | ID del número de teléfono registrado en Meta | `987654321` |
| `META_WEBHOOK_VERIFY_TOKEN` | **Sí** | Token secreto para verificar el webhook | `BINA_WHATSAPP_VERIFY_2026_S3CR3T` |
| `META_API_VERSION` | No | Versión de la Graph API | `v21.0` |
| `BINA_API_URL` | No | Endpoint de Bina IA | `https://clouderp.abakoerp.com:9619/apiagenteia` |
| `BINA_API_KEY` | No | Clave de API de Bina (si requiere autenticación) | `bina_key_xxx` |
| `BINA_TIMEOUT_MS` | No | Timeout para requests a Bina (ms) | `10000` |
| `PORT` | No | Puerto del servidor | `3000` |
| `NODE_ENV` | No | Entorno de ejecución | `development` / `production` |

---

## Endpoints del Sistema

| Método | Endpoint | Descripción | Autenticación |
|--------|----------|-------------|---------------|
| `GET` | `/webhook/whatsapp` | Verificación del webhook por Meta | Ninguna (parámetros de query) |
| `POST` | `/webhook/whatsapp` | Recepción de mensajes entrantes de WhatsApp | Firma HMAC-SHA256 (X-Hub-Signature-256) |
| `GET` | `/health` | Health check del servicio | Ninguna |

### GET /webhook/whatsapp

Meta llama a este endpoint al configurar el webhook. Responde con el `hub.challenge` para confirmar la URL.

**Request de Meta:**
```
GET /webhook/whatsapp?hub.mode=subscribe&hub.verify_token=TU_TOKEN&hub.challenge=1158201444
```

**Response esperado:**
```
HTTP 200 OK
1158201444
```

### POST /webhook/whatsapp

Meta llama a este endpoint cuando un usuario envía un mensaje o cuando cambia el estado de un mensaje enviado.

**Request de Meta:**
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "WABA_ID",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "573001234567",
          "phone_number_id": "PHONE_NUMBER_ID"
        },
        "contacts": [{ "profile": { "name": "Juan" }, "wa_id": "573009876543" }],
        "messages": [{
          "from": "573009876543",
          "id": "wamid.ABGGFlA5...",
          "timestamp": "1712678400",
          "type": "text",
          "text": { "body": "Hola" }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

**Response:**
```
HTTP 200 OK
```
*(Meta requiere un 200 inmediato; el procesamiento es asíncrono)*

### GET /health

```json
{
  "status": "ok",
  "service": "poc-bina-dito",
  "timestamp": "2026-04-09T19:00:00.000Z",
  "environment": "development",
  "config": {
    "metaApiVersion": "v21.0",
    "metaPhoneNumberId": "***configurado***",
    "binaApiUrl": "https://clouderp.abakoerp.com:9619/apiagenteia",
    "binaTimeout": "10000ms"
  },
  "sessions": {
    "activeSessions": 3,
    "storageType": "in-memory (Map)"
  }
}
```

---

## Flujo de Comunicación Completo

```
Usuario (WhatsApp)
       │
       │ 1. Envía mensaje
       ▼
Meta Cloud API
       │
       │ 2. POST /webhook/whatsapp
       │    (X-Hub-Signature-256: sha256=HMAC_HASH)
       ▼
Nuestro Backend (Node.js/Express)
       │
       ├─ 3. Responde HTTP 200 (inmediato)
       │
       ├─ 4. Valida firma HMAC-SHA256
       │
       ├─ 5. Extrae mensaje y contacto
       │
       ├─ 6. Marca mensaje como leído
       │    (POST /messages con status: read)
       │
       ├─ 7. Descarga media si es necesario
       │    (GET /{mediaId} → GET URL_archivo)
       │
       │ 8. POST https://clouderp.abakoerp.com:9619/apiagenteia
       ▼
Bina IA (Motor de IA)
       │
       │ 9. Respuesta con texto + opciones
       ▼
Nuestro Backend
       │
       │ 10. POST graph.facebook.com/v21.0/{id}/messages
       ▼
Meta Cloud API
       │
       │ 11. Entrega el mensaje
       ▼
Usuario (WhatsApp) ← Recibe la respuesta de Bina
```

---

## Tipos de Mensajes Soportados

### Mensajes Entrantes (usuario → sistema)

| Tipo | Descripción | Campos Principales |
|------|-------------|-------------------|
| `text` | Mensaje de texto | `text.body` |
| `image` | Imagen (JPG, PNG) | `image.id`, `image.caption`, `image.mime_type` |
| `document` | Documento (PDF, DOCX, etc.) | `document.id`, `document.filename` |
| `audio` | Archivo de audio o nota de voz | `audio.id`, `audio.voice` |
| `video` | Video | `video.id`, `video.caption` |
| `location` | Ubicación GPS | `location.latitude`, `location.longitude` |
| `interactive` (button_reply) | Respuesta a botón | `interactive.button_reply.id`, `.title` |
| `interactive` (list_reply) | Selección de lista | `interactive.list_reply.id`, `.title` |
| `reaction` | Reacción a mensaje | `reaction.emoji`, `reaction.message_id` |

### Mensajes Salientes (sistema → usuario)

| Tipo | Descripción | Cuándo usarlo |
|------|-------------|---------------|
| `text` | Texto simple | Respuestas generales de Bina |
| `interactive` (buttons) | Hasta 3 botones | Cuando Bina sugiere ≤3 opciones |
| `interactive` (list) | Lista hasta 10 opciones | Cuando Bina sugiere 4-10 opciones |
| `document` | Envío de documento | Cuando Bina devuelve un URL de documento |
| `image` | Envío de imagen | Cuando se requiere mostrar imagen |
| `template` | Plantilla aprobada | Para iniciar conversaciones >24h |

---

## Ejemplos de Request/Response

### Envío de mensaje de texto (nuestro backend → Meta)

**Request:**
```bash
curl -X POST https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages \
  -H "Authorization: Bearer {ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "573009876543",
    "type": "text",
    "text": { "body": "Hola Juan, ¿en qué puedo ayudarte?" }
  }'
```

**Response exitoso:**
```json
{
  "messaging_product": "whatsapp",
  "contacts": [{ "input": "573009876543", "wa_id": "573009876543" }],
  "messages": [{ "id": "wamid.HBgLNTczMDA5..." }]
}
```

### Envío de botones interactivos

```json
{
  "messaging_product": "whatsapp",
  "to": "573009876543",
  "type": "interactive",
  "interactive": {
    "type": "button",
    "body": { "text": "¿Cómo puedo ayudarte?" },
    "action": {
      "buttons": [
        { "type": "reply", "reply": { "id": "btn_facturas", "title": "Ver facturas" } },
        { "type": "reply", "reply": { "id": "btn_soporte", "title": "Soporte técnico" } },
        { "type": "reply", "reply": { "id": "btn_agente", "title": "Hablar con agente" } }
      ]
    }
  }
}
```

### Request a Bina IA

```json
{
  "session_id": "573009876543",
  "channel": "whatsapp",
  "user": {
    "phone": "573009876543",
    "name": "Juan Pérez",
    "wa_id": "573009876543"
  },
  "message": {
    "type": "text",
    "content": { "text": "Necesito ver mis facturas pendientes", "message_id": "wamid.XXX" },
    "timestamp": "2026-04-09T19:00:00.000Z",
    "message_id": "wamid.XXX"
  },
  "context": {
    "business_phone": "PHONE_NUMBER_ID",
    "platform": "whatsapp_cloud_api",
    "api_version": "v21.0"
  }
}
```

### Response esperado de Bina IA

```json
{
  "session_id": "573009876543",
  "response": {
    "type": "text",
    "text": "Hola Juan, encontré 3 facturas pendientes de pago. ¿Deseas verlas?"
  },
  "suggestions": [
    { "id": "ver_facturas", "title": "Ver facturas" },
    { "id": "pagar_ahora", "title": "Pagar ahora" },
    { "id": "mas_info", "title": "Más información" }
  ],
  "metadata": {
    "intent": "consulta_facturas",
    "confidence": 0.95
  }
}
```

---

## Manejo de Errores

### Códigos de Error Comunes de Meta

| Código | Mensaje | Causa | Acción |
|--------|---------|-------|--------|
| `100` | Invalid parameter | Parámetro inválido en el request | Revisar estructura del payload |
| `131000` | Something went wrong | Error genérico de Meta | Reintentar después de un momento |
| `131005` | Access denied | Token sin permisos suficientes | Verificar permisos del token |
| `131008` | Required parameter is missing | Falta un campo obligatorio | Revisar campos del mensaje |
| `131009` | Parameter value is not valid | Valor de parámetro inválido | Revisar formato del número de teléfono |
| `131026` | Message Undeliverable | El número no tiene WhatsApp | Verificar el número destino |
| `131047` | Re-engagement message | Fuera de ventana de 24h | Usar template aprobado |
| `131056` | Business account is locked | Cuenta bloqueada | Contactar soporte de Meta |

---

## Ventana de 24 Horas

Meta implementa una **política de ventana de conversación** de 24 horas:

- **Dentro de la ventana (24h):** Se puede enviar cualquier tipo de mensaje (texto, botones, listas, imágenes, etc.)
- **Fuera de la ventana:** **Solo se pueden enviar templates** (plantillas pre-aprobadas por Meta)

Esta ventana se **reinicia** cada vez que el usuario envía un mensaje.

```
Tiempo 0:00 → Usuario escribe → Abre ventana de 24h
Tiempo 0:01 → Bina responde texto libre ✅
Tiempo 12:00 → Negocio envía recordatorio ✅
Tiempo 23:59 → Negocio envía resumen ✅
Tiempo 24:01 → Solo templates ⚠️
Tiempo 24:05 → Usuario vuelve a escribir → Reabre ventana ✅
```

---

## Requisitos de Meta para la Integración

| Requisito | Descripción | Estado Actual |
|-----------|-------------|---------------|
| Cuenta Meta Business | Cuenta verificada de empresa | Pendiente |
| App en Meta Developers | App tipo "Business" | Pendiente de acceso |
| Producto WhatsApp | Habilitado en la app | Pendiente |
| Número de teléfono | Provisional (sandbox) → Certificado (producción) | Provisional |
| Token de acceso | System User Token con permisos `whatsapp_business_messaging` | Pendiente |
| URL de webhook | HTTPS con certificado válido | ngrok en desarrollo |
| Verify Token | Token secreto personalizado | Configurado en .env |
| Suscripciones | `messages`, `message_deliveries`, `message_reads` | Pendiente configurar |

---

## Plan de Pruebas

| # | Escenario | Tipo | Estado |
|---|-----------|------|--------|
| 1 | Verificación del webhook (GET) | Funcional | Pendiente |
| 2 | Recepción de mensaje de texto | Funcional | Pendiente |
| 3 | Recepción de imagen | Funcional | Pendiente |
| 4 | Recepción de documento PDF | Funcional | Pendiente |
| 5 | Respuesta a botón interactivo | Funcional | Pendiente |
| 6 | Selección de lista interactiva | Funcional | Pendiente |
| 7 | Firma HMAC inválida (debe rechazar) | Seguridad | Pendiente |
| 8 | Envío fuera de ventana de 24h | Límites | Pendiente |
| 9 | Bina no disponible (fallback) | Resiliencia | Pendiente |
| 10 | Carga concurrente (5+ usuarios) | Rendimiento | Pendiente |

---

## Cronograma Estimado

| Día | Actividad |
|-----|-----------|
| Día 1 | Configuración del entorno, obtención de credenciales Meta, despliegue del webhook |
| Día 2 | Pruebas de recepción de mensajes y validación de firma |
| Día 3 | Integración con Bina IA y transformación de mensajes |
| Día 4 | Pruebas de tipos de mensajes (texto, imagen, documento, botones) |
| Día 5 | Manejo de errores, fallback, pruebas de carga básica |
| Día 6 | Documentación final, limpieza de código, presentación de resultados |

---

## Próximos Pasos

- [ ] Obtener acceso al portal de Meta Developers
- [ ] Configurar credenciales en el archivo `.env`
- [ ] Desplegar servidor con URL pública (ngrok para desarrollo)
- [ ] Configurar webhook en Meta Developers
- [ ] Validar el formato esperado por Bina IA y ajustar el `binaService.js`
- [ ] Probar flujo completo con número provisional de Meta
- [ ] Evaluar necesidad de Redis para gestión de sesiones en producción
- [ ] Definir templates para conversaciones fuera de la ventana de 24h
- [ ] Gestionar aprobación del número certificado para producción

---

## Estructura del Proyecto

```
POC-BINA-DITO/
├── README.md                          # Este documento
├── docs/
│   └── ARQUITECTURA.md                # Documento de arquitectura detallado
├── src/
│   ├── app.js                         # Entry point del servidor Express
│   ├── config/
│   │   ├── environment.js             # Carga y validación de variables de entorno
│   │   └── constants.js               # Constantes de la aplicación
│   ├── controllers/
│   │   └── webhookController.js       # Controlador del webhook de Meta
│   ├── services/
│   │   ├── metaApiService.js          # Cliente HTTP para la API de Meta
│   │   ├── binaService.js             # Cliente HTTP para Bina IA
│   │   ├── mediaService.js            # Manejo de archivos multimedia
│   │   ├── sessionService.js          # Gestión de sesiones y ventana de 24h
│   │   └── signatureService.js        # Validación de firmas HMAC-SHA256
│   ├── transformers/
│   │   ├── inboundTransformer.js      # Meta → Bina
│   │   └── outboundTransformer.js     # Bina → Meta
│   ├── middleware/
│   │   ├── signatureValidator.js      # Validación X-Hub-Signature-256
│   │   └── errorHandler.js            # Manejo centralizado de errores
│   ├── utils/
│   │   └── logger.js                  # Logging con timestamps y colores
│   └── routes/
│       └── webhookRoutes.js           # Rutas Express del webhook
├── tests/
│   ├── simulate-webhook.sh            # Simula webhooks de Meta (curl)
│   └── test-health.sh                 # Verifica el health check
├── .env.example                       # Plantilla de variables de entorno
├── .gitignore
├── package.json
└── Dockerfile
```

---

## Licencia

ISC © Abako ERP