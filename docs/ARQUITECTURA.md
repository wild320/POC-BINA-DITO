# Documento de Arquitectura - POC Integración Meta WhatsApp ↔ Bina IA

## 1. Modelo de Comunicación de Meta

Meta WhatsApp Business Cloud API utiliza un modelo de **comunicación mediada**. Esto significa que los mensajes entre usuarios y negocios **no fluyen directamente** entre ambas partes, sino que pasan siempre a través de los servidores de Meta.

```
┌──────────┐          ┌──────────────────┐          ┌──────────────────┐
│  Usuario │◄────────►│  Meta Servers    │◄────────►│  Tu Backend      │
│          │ WhatsApp │  (graph.facebook │  HTTPS   │  (Webhook +      │
│          │          │   .com/v21.0)    │          │   API Client)    │
└──────────┘          └──────────────────┘          └──────────────────┘
```

### Características clave:
- **Solo HTTPS:** Toda comunicación debe ser por HTTPS con certificado válido
- **Webhook obligatorio:** Meta notifica los mensajes entrantes mediante POST a tu servidor
- **Respuestas vía API:** Para responder, tu backend hace POST a la Graph API de Meta
- **Asimetría:** El mismo endpoint recibe mensajes pero para enviar se usa un endpoint diferente

---

## 2. Diagrama de Arquitectura Completo

```
                          ╔══════════════════════════════════════════════════════╗
                          ║                 NUESTRO BACKEND                     ║
                          ║                                                      ║
┌──────────┐  WhatsApp   ┌╫──────────────┐   ┌──────────────┐   ┌────────────┐ ║
│ Usuario  │────────────►║│  Webhook     │──►│  Message     │──►│   Bina     │ ║
│ WhatsApp │             ║│  Receiver    │   │  Processor   │   │ Connector  │ ║
│          │             ┌╫──────────────┐   └──────┬───────┘   └─────┬──────┘ ║
└──────────┘             ║│  Signature   │          │                  │        ║
      ▲                  ║│  Validator   │          ▼                  ▼        ║
      │                  └╫──────────────┘   ┌──────────────┐   ┌────────────┐ ║
      │                  ║                   │  Inbound     │   │  Bina IA   │ ║
      │                  ║                   │ Transformer  │   │ (remoto)   │ ║
      │                  ║                   └──────┬───────┘   └─────┬──────┘ ║
      │                  ║                          │                  │        ║
      │                  ║                          ▼                  ▼        ║
      │                  ║                   ┌──────────────┐   ┌────────────┐ ║
      │                  ║                   │  Session     │   │ Outbound   │ ║
      │                  ║                   │  Manager     │   │Transformer │ ║
      │                  ║                   └──────────────┘   └─────┬──────┘ ║
      │                  ║                                             │        ║
      │  Meta API        ║                   ┌──────────────┐         │        ║
      └──────────────────╫───────────────────│  Response    │◄────────┘        ║
                         ║                   │  Dispatcher  │                  ║
                         ║                   └──────┬───────┘                  ║
                         ║                          │                          ║
                         ║                   ┌──────▼───────┐                  ║
                         ║                   │  Meta API    │                  ║
                         ║                   │  Service     │                  ║
                         ║                   └──────────────┘                  ║
                         ╚══════════════════════════════════════════════════════╝
                                  │ HTTPS POST
                                  ▼
                         ┌────────────────────┐
                         │  Meta Cloud API    │
                         │  graph.facebook    │
                         │  .com/v21.0/       │
                         │  {phoneId}/        │
                         │  messages          │
                         └────────────────────┘
```

---

## 3. Mapa de Servicios

El backend está compuesto por **7 servicios** especializados:

| # | Servicio | Archivo | Responsabilidad |
|---|----------|---------|-----------------|
| 1 | **Webhook Receiver** | `routes/webhookRoutes.js` + `controllers/webhookController.js` | Recibe y enruta los eventos de Meta |
| 2 | **Message Processor** | `controllers/webhookController.js` | Orquesta el flujo completo de procesamiento |
| 3 | **Bina Connector** | `services/binaService.js` | Comunica con el agente Bina IA |
| 4 | **Media Handler** | `services/mediaService.js` | Descarga y sube archivos multimedia |
| 5 | **Response Dispatcher** | `controllers/webhookController.js` (sendResponse) | Envía la respuesta de Bina al usuario |
| 6 | **Session Manager** | `services/sessionService.js` | Gestiona sesiones y ventana de 24h |
| 7 | **Signature Validator** | `services/signatureService.js` + `middleware/signatureValidator.js` | Valida autenticidad de los webhooks |

---

## 4. Tipos de Conversación

### 4.1 User-Initiated (iniciada por el usuario)
- El usuario escribe primero al número de WhatsApp Business
- **Abre una ventana de 24 horas** durante la cual se puede responder con cualquier tipo de mensaje
- **Costo:** Sin cargo adicional (incluido en la tarifa de conversación de servicio al cliente)

### 4.2 Business-Initiated (iniciada por el negocio)
- El negocio envía el primer mensaje o escribe **fuera de la ventana de 24h**
- **Requiere templates aprobados** por Meta previamente
- **Costo:** Se cobra según el tipo de conversación (marketing, utilidad, autenticación)

---

## 5. Tipos de Mensajes Soportados

### Entrantes (Meta → Nuestro Backend)

| Tipo | Descripción | Contenido Principal |
|------|-------------|---------------------|
| `text` | Mensaje de texto plano | `text.body` |
| `image` | Imagen JPG, PNG, WebP | `image.id`, `image.mime_type`, `image.sha256` |
| `document` | PDF, DOCX, XLSX, etc. | `document.id`, `document.filename`, `document.mime_type` |
| `audio` | MP3, OGG, AMR (nota de voz) | `audio.id`, `audio.voice` (bool) |
| `video` | MP4, 3GP | `video.id`, `video.mime_type` |
| `location` | Coordenadas GPS | `location.latitude`, `location.longitude`, `location.name` |
| `contacts` | Tarjeta de contacto vCard | `contacts[].name`, `contacts[].phones` |
| `sticker` | Sticker WebP | `sticker.id`, `sticker.animated` |
| `interactive` | Respuesta a botón o lista | `interactive.button_reply` o `interactive.list_reply` |
| `reaction` | Emoji de reacción | `reaction.emoji`, `reaction.message_id` |

### Salientes (Nuestro Backend → Meta)

| Tipo | Descripción | Cuándo Usar |
|------|-------------|-------------|
| `text` | Texto simple con preview opcional | Respuestas generales |
| `interactive` (button) | Hasta 3 botones de respuesta rápida | Opciones simples de Bina |
| `interactive` (list) | Lista de hasta 10 opciones con descripción | Menús con muchas opciones |
| `document` | Documento con caption y nombre | Cuando Bina devuelve un documento |
| `image` | Imagen con caption | Visualizaciones, confirmaciones |
| `template` | Plantilla pre-aprobada con variables | Fuera de ventana de 24h |

---

## 6. Definición de Endpoints

### 6.1 Verificación del Webhook (GET)

**Endpoint:** `GET /webhook/whatsapp`

Meta llama a este endpoint **una única vez** al configurar el webhook en el portal de desarrolladores, para verificar que la URL es válida y que conocemos el token secreto.

**Request de Meta:**
```
GET /webhook/whatsapp?hub.mode=subscribe&hub.verify_token=TU_TOKEN_SECRETO&hub.challenge=1158201444
```

| Parámetro | Valor | Descripción |
|-----------|-------|-------------|
| `hub.mode` | `subscribe` | Siempre "subscribe" |
| `hub.verify_token` | El token definido en .env | Debe coincidir exactamente |
| `hub.challenge` | Número aleatorio | Se debe devolver en la respuesta |

**Response esperado (200 OK):**
```
1158201444
```
*(Se devuelve el valor de `hub.challenge` exactamente)*

**Response de error (403):**
```json
{ "error": "Verificación de webhook fallida" }
```

---

### 6.2 Recepción de Mensajes (POST)

**Endpoint:** `POST /webhook/whatsapp`

Meta envía aquí todos los eventos: mensajes entrantes, estados de entrega, reacciones, etc.

**Headers del request:**
```
Content-Type: application/json
X-Hub-Signature-256: sha256=<HMAC_SHA256_DEL_BODY>
```

#### Ejemplo A: Mensaje de texto

**Request:**
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "123456789",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "573001234567",
          "phone_number_id": "987654321"
        },
        "contacts": [{
          "profile": { "name": "Juan Pérez" },
          "wa_id": "573009876543"
        }],
        "messages": [{
          "from": "573009876543",
          "id": "wamid.ABGGFlA5FpafAgo6tHcNmNjXKSO4g",
          "timestamp": "1712678400",
          "type": "text",
          "text": { "body": "Hola, necesito información" }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

**Response (siempre):**
```
HTTP 200 OK
```

#### Ejemplo B: Imagen recibida

**Request (fragmento de messages):**
```json
{
  "from": "573009876543",
  "id": "wamid.ABC123",
  "timestamp": "1712678500",
  "type": "image",
  "image": {
    "caption": "Esta es mi factura",
    "mime_type": "image/jpeg",
    "sha256": "abc123def456...",
    "id": "MEDIA_ID_12345"
  }
}
```

#### Ejemplo C: Respuesta a botón interactivo

```json
{
  "from": "573009876543",
  "id": "wamid.XYZ789",
  "timestamp": "1712678600",
  "type": "interactive",
  "interactive": {
    "type": "button_reply",
    "button_reply": {
      "id": "btn_ver_facturas",
      "title": "Ver facturas"
    }
  }
}
```

#### Ejemplo D: Notificación de estado

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": { "phone_number_id": "987654321", "display_phone_number": "573001234567" },
        "statuses": [{
          "id": "wamid.ABGGFlA5...",
          "status": "read",
          "timestamp": "1712678700",
          "recipient_id": "573009876543"
        }]
      },
      "field": "messages"
    }]
  }]
}
```

---

### 6.3 Envío de Mensajes (POST a Meta)

**Endpoint de Meta:** `POST https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages`

**Headers:**
```
Authorization: Bearer {ACCESS_TOKEN}
Content-Type: application/json
```

#### Ejemplo A: Texto simple

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "573009876543",
  "type": "text",
  "text": {
    "preview_url": false,
    "body": "Hola Juan, ¿en qué puedo ayudarte hoy?"
  }
}
```

**Response de Meta:**
```json
{
  "messaging_product": "whatsapp",
  "contacts": [{ "input": "573009876543", "wa_id": "573009876543" }],
  "messages": [{ "id": "wamid.HBgLNTczMDA5..." }]
}
```

#### Ejemplo B: Botones interactivos (≤3 opciones)

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
        { "type": "reply", "reply": { "id": "opt_facturas", "title": "Ver facturas" } },
        { "type": "reply", "reply": { "id": "opt_soporte", "title": "Soporte técnico" } },
        { "type": "reply", "reply": { "id": "opt_agente", "title": "Hablar con agente" } }
      ]
    }
  }
}
```

#### Ejemplo C: Lista interactiva (4-10 opciones)

```json
{
  "messaging_product": "whatsapp",
  "to": "573009876543",
  "type": "interactive",
  "interactive": {
    "type": "list",
    "body": { "text": "Selecciona el módulo con el que necesitas ayuda:" },
    "action": {
      "button": "Ver opciones",
      "sections": [{
        "title": "Módulos disponibles",
        "rows": [
          { "id": "mod_facturacion", "title": "Facturación", "description": "Facturas y pagos" },
          { "id": "mod_inventario", "title": "Inventario", "description": "Control de stock" },
          { "id": "mod_nomina", "title": "Nómina", "description": "Liquidaciones y pagos" },
          { "id": "mod_contabilidad", "title": "Contabilidad", "description": "Cuentas y balances" }
        ]
      }]
    }
  }
}
```

#### Ejemplo D: Template (fuera de ventana 24h)

```json
{
  "messaging_product": "whatsapp",
  "to": "573009876543",
  "type": "template",
  "template": {
    "name": "bienvenida_abako",
    "language": { "code": "es" },
    "components": [{
      "type": "body",
      "parameters": [
        { "type": "text", "text": "Juan Pérez" }
      ]
    }]
  }
}
```

#### Ejemplo E: Documento

```json
{
  "messaging_product": "whatsapp",
  "to": "573009876543",
  "type": "document",
  "document": {
    "link": "https://tu-servidor.com/documentos/factura_001.pdf",
    "caption": "Aquí está tu factura pendiente",
    "filename": "Factura_001.pdf"
  }
}
```

#### Ejemplo F: Marcar como leído

```json
{
  "messaging_product": "whatsapp",
  "status": "read",
  "message_id": "wamid.ABGGFlA5FpafAgo6tHcNmNjXKSO4g"
}
```

---

### 6.4 Descarga de Media (2 pasos)

#### Paso 1: Obtener URL de descarga

**Request:**
```
GET https://graph.facebook.com/v21.0/{MEDIA_ID}
Authorization: Bearer {ACCESS_TOKEN}
```

**Response:**
```json
{
  "url": "https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=MEDIA_ID&ext=...",
  "mime_type": "image/jpeg",
  "sha256": "abc123...",
  "file_size": 45321,
  "id": "MEDIA_ID"
}
```

#### Paso 2: Descargar el archivo

```
GET {url_del_paso_anterior}
Authorization: Bearer {ACCESS_TOKEN}
```
*(Responde con el contenido binario del archivo)*

---

### 6.5 Integración con Bina IA

**Endpoint:** `POST https://clouderp.abakoerp.com:9619/apiagenteia`

#### Request propuesto a Bina:

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
    "content": {
      "text": "Necesito ver mis facturas pendientes",
      "message_id": "wamid.ABGGFlA5FpafAgo6tHcNmNjXKSO4g"
    },
    "timestamp": "2026-04-09T19:00:00.000Z",
    "message_id": "wamid.ABGGFlA5FpafAgo6tHcNmNjXKSO4g"
  },
  "context": {
    "business_phone": "987654321",
    "display_phone": "573001234567",
    "platform": "whatsapp_cloud_api"
  }
}
```

#### Response esperado de Bina:

```json
{
  "session_id": "573009876543",
  "response": {
    "type": "text",
    "text": "Hola Juan, encontré 3 facturas pendientes por un valor total de $450.000. ¿Deseas verlas?"
  },
  "suggestions": [
    { "id": "ver_detalle", "title": "Ver detalle" },
    { "id": "pagar_total", "title": "Pagar total" },
    { "id": "hablar_asesor", "title": "Hablar con asesor" }
  ],
  "metadata": {
    "intent": "consulta_facturas",
    "confidence": 0.97,
    "entities": { "tipo": "facturas", "estado": "pendiente" }
  }
}
```

---

## 7. Flujo Completo Paso a Paso

```
PASO 1: El usuario escribe "Hola, necesito ayuda" en WhatsApp

PASO 2: Meta recibe el mensaje y hace POST a nuestro webhook
        POST /webhook/whatsapp
        Header: X-Hub-Signature-256: sha256=HMAC_HASH

PASO 3: Nuestro backend responde HTTP 200 de inmediato
        (Evita que Meta reintente el envío)

PASO 4: El signatureValidator verifica la firma HMAC-SHA256
        crypto.timingSafeEqual(expectedHash, receivedHash)

PASO 5: El webhookController extrae el mensaje y el contacto
        from = "573009876543"
        name = "Juan Pérez"
        type = "text"
        body = "Hola, necesito ayuda"

PASO 6: Se marca el mensaje como leído
        POST /messages { status: "read", message_id: "wamid.XXX" }
        → Aparece el doble check azul en WhatsApp del usuario

PASO 7: Se envía el mensaje a Bina IA
        POST https://clouderp.abakoerp.com:9619/apiagenteia
        { session_id, channel, user, message, context }

PASO 8: Bina procesa y responde
        { response: { text: "Hola Juan, ¿en qué puedo ayudarte?" },
          suggestions: [{...}, {...}] }

PASO 9: El outboundTransformer transforma la respuesta
        Como hay 2 sugerencias (≤3) → mensaje interactivo con botones

PASO 10: Nuestro backend envía el mensaje al usuario
         POST graph.facebook.com/v21.0/987654321/messages
         { type: "interactive", interactive: { type: "button", ... } }

PASO 11: Meta entrega el mensaje de botones al usuario
         El usuario lo recibe y puede hacer clic en una de las opciones
```

---

## 8. Diagrama de Secuencia

```
Usuario      Meta Cloud API       Nuestro Backend        Bina IA
  │                │                     │                    │
  │──Hola──────────►                     │                    │
  │                │──POST /webhook/wh──►│                    │
  │                │                     │──200 OK──────────► │ (inmediato)
  │                │                     │                    │
  │                │                     │──Valida firma──    │
  │                │                     │──Extrae msg───     │
  │                │                     │                    │
  │                │◄──mark as read──────│                    │
  │◄──✓✓ azul──────│                     │                    │
  │                │                     │                    │
  │                │                     │──POST /apiagenteia►│
  │                │                     │                    │──Procesa──
  │                │                     │◄──Respuesta Bina───│
  │                │                     │                    │
  │                │◄──POST /messages────│                    │
  │◄──Respuesta────│                     │                    │
  │                │                     │                    │
```

---

## 9. Validación de Seguridad (HMAC-SHA256)

Meta firma cada POST al webhook usando HMAC-SHA256 con el App Secret:

```javascript
// Cómo Meta genera la firma (para referencia):
const signature = 'sha256=' + crypto
  .createHmac('sha256', APP_SECRET)
  .update(rawBody)
  .digest('hex');

// Header enviado por Meta:
// X-Hub-Signature-256: sha256=abc123def456...

// Cómo validamos en nuestro servidor:
function validateSignature(rawBody, signatureHeader, appSecret) {
  const [algo, received] = signatureHeader.split('=');
  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');

  // Comparación de tiempo constante (previene timing attacks)
  return crypto.timingSafeEqual(
    Buffer.from(received, 'hex'),
    Buffer.from(expected, 'hex')
  );
}
```

**⚠️ IMPORTANTE:** Para que la validación funcione, el cuerpo del request debe conservarse **sin parsear** (rawBody). Por eso en `app.js` se configura `express.json()` con la opción `verify`.

---

## 10. Tabla de Errores Comunes de Meta

| Código | Error | Causa Probable | Acción Recomendada |
|--------|-------|----------------|-------------------|
| `100` | Invalid parameter | Payload mal formado | Revisar estructura del JSON |
| `131000` | Something went wrong | Error interno de Meta | Reintentar con backoff exponencial |
| `131005` | Access denied | Token sin permisos | Regenerar token con permisos correctos |
| `131008` | Required parameter missing | Campo obligatorio ausente | Revisar campos del mensaje |
| `131009` | Parameter value not valid | Número de teléfono mal formateado | Formato: país + número sin "+" |
| `131021` | Sender phone number not registered | Número no registrado en WABA | Verificar configuración en Meta |
| `131026` | Message undeliverable | Número sin WhatsApp activo | Verificar con el usuario |
| `131047` | Re-engagement message | Fuera de ventana de 24h | Usar template aprobado |
| `131051` | Unsupported message type | Tipo de mensaje no soportado | Verificar tipo correcto |
| `131056` | Business account locked | Cuenta suspendida | Contactar soporte de Meta |

---

## 11. Requisitos Técnicos y Configuraciones de Meta

| Configuración | Valor/Requisito | Dónde Configurar |
|---------------|-----------------|------------------|
| **Cuenta Meta Business** | Cuenta empresarial verificada | business.facebook.com |
| **App Meta Developers** | Tipo "Business" o "None" | developers.facebook.com/apps |
| **Producto WhatsApp** | Habilitado en la app | App > Add Product > WhatsApp |
| **Número de teléfono** | Registrado en WABA (sandbox o certificado) | App > WhatsApp > Phone Numbers |
| **System User Token** | Token permanente con permisos WhatsApp | Business Settings > System Users |
| **URL del Webhook** | HTTPS con certificado SSL válido | App > WhatsApp > Configuration |
| **Verify Token** | String personalizado (hasta 80 chars) | App > WhatsApp > Configuration |
| **Webhook Fields** | `messages` (mínimo) | App > WhatsApp > Configuration > Webhook Fields |
| **Versión de API** | v21.0 o superior | Configurado en el código |

---

## 12. Permisos de API Requeridos

| Permiso | Descripción | Requerido |
|---------|-------------|-----------|
| `whatsapp_business_messaging` | Enviar y recibir mensajes | **Sí** |
| `whatsapp_business_management` | Gestionar números y configuración | Opcional |
| `business_management` | Gestión de la cuenta Business | Recomendado |

---

## 13. Campos de Webhook a Suscribir

| Campo | Eventos que notifica | Recomendado |
|-------|---------------------|-------------|
| `messages` | Mensajes entrantes, estados, reacciones | **Sí (obligatorio)** |
| `message_echoes` | Copias de mensajes enviados | No (para PoC) |
| `message_reads` | Confirmaciones de lectura | Opcional |
| `message_deliveries` | Confirmaciones de entrega | Opcional |

---

## 14. Infraestructura Mínima

```
┌────────────────────────────────────────────────────────┐
│                  INFRAESTRUCTURA POC                   │
│                                                        │
│  ┌──────────────────┐        ┌─────────────────────┐  │
│  │  Servidor Web    │        │  Herramienta HTTPS  │  │
│  │  (1 instancia)   │        │                     │  │
│  │                  │        │  Desarrollo: ngrok  │  │
│  │  Node.js 20+     │        │  Producción:        │  │
│  │  Express         │        │  - Nginx + certbot  │  │
│  │  1 vCPU / 512MB  │        │  - Cloudflare       │  │
│  │  RAM mínimo      │        │  - AWS ALB          │  │
│  └──────────────────┘        └─────────────────────┘  │
│                                                        │
│  ┌──────────────────┐        ┌─────────────────────┐  │
│  │  Sesiones        │        │  Logs               │  │
│  │                  │        │                     │  │
│  │  PoC: Map en RAM │        │  PoC: console.log   │  │
│  │  Prod: Redis     │        │  Prod: Winston +    │  │
│  │                  │        │  ELK Stack          │  │
│  └──────────────────┘        └─────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### Tabla de recursos estimados (producción):

| Componente | Especificación PoC | Especificación Producción |
|------------|-------------------|--------------------------|
| **Servidor** | 1 vCPU, 512MB RAM | 2 vCPU, 2GB RAM (min) |
| **SO** | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| **Node.js** | v20 LTS | v20 LTS |
| **SSL/TLS** | ngrok (gratuito) | Let's Encrypt o Cloudflare |
| **Sesiones** | In-memory (Map) | Redis 7+ |
| **Logs** | Console stdout | Winston + archivo rotativo |
| **Costo estimado** | $0 (local + ngrok free) | ~$20-50 USD/mes (cloud básico) |

---

## 15. Opción de Desarrollo Rápido con ngrok

Para la fase de desarrollo, se puede usar **ngrok** para exponer el servidor local a internet con HTTPS automático:

```bash
# Paso 1: Instalar ngrok (https://ngrok.com)
# Paso 2: Iniciar el servidor local
npm run dev

# Paso 3: En otra terminal, crear el túnel
npm run tunnel
# Output: https://abc123.ngrok.io -> http://localhost:3000

# Paso 4: Configurar en Meta Developers
# Webhook URL: https://abc123.ngrok.io/webhook/whatsapp
# Verify Token: BINA_WHATSAPP_VERIFY_2026_S3CR3T
```

**⚠️ Nota:** Con la cuenta gratuita de ngrok, la URL cambia cada vez que reinicias el túnel. Para mayor comodidad durante el desarrollo, considera la cuenta pagada de ngrok o usar Cloudflare Tunnel.
