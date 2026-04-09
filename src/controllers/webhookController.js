'use strict';

/**
 * webhookController.js
 * Controlador del webhook de Meta WhatsApp Business.
 * Orquesta el flujo completo de procesamiento de mensajes:
 * recepción → validación → transformación → Bina → respuesta al usuario
 */

const CONFIG = require('../config/environment');
const metaApiService = require('../services/metaApiService');
const binaService = require('../services/binaService');
const sessionService = require('../services/sessionService');
const { extractMessageContent, extractContactInfo } = require('../transformers/inboundTransformer');
const { transformBinaResponse } = require('../transformers/outboundTransformer');
const logger = require('../utils/logger');

/**
 * Maneja el request GET de verificación del webhook.
 * Meta envía este request al configurar el webhook para confirmar que la URL es válida.
 *
 * @param {import('express').Request}  req - Request con query params: hub.mode, hub.verify_token, hub.challenge
 * @param {import('express').Response} res - Response
 */
function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  logger.info('webhookController: Solicitud de verificación recibida', { mode, token: token ? '***' : 'vacío' });

  if (mode === 'subscribe' && token === CONFIG.meta.verifyToken) {
    logger.info('webhookController: Webhook verificado exitosamente');
    // Meta espera recibir el challenge como respuesta para confirmar la URL.
    // Se envía como texto plano para evitar que el navegador interprete HTML
    // en caso de que el valor del challenge contenga caracteres especiales.
    return res.set('Content-Type', 'text/plain').status(200).send(String(challenge));
  }

  logger.warn('webhookController: Verificación fallida - token inválido o modo incorrecto', { mode });
  return res.status(403).json({ error: 'Verificación de webhook fallida' });
}

/**
 * Maneja los requests POST del webhook con mensajes entrantes de WhatsApp.
 * Responde 200 inmediatamente a Meta y procesa el mensaje de forma asíncrona.
 *
 * @param {import('express').Request}  req - Request con el payload del webhook
 * @param {import('express').Response} res - Response
 */
function handleWebhook(req, res) {
  // Responder 200 inmediatamente para evitar que Meta reintente el envío
  // El procesamiento real ocurre de forma asíncrona después
  res.sendStatus(200);

  const body = req.body;

  // Verificar que sea un evento de WhatsApp Business
  if (body.object !== 'whatsapp_business_account') {
    logger.debug('webhookController: Evento ignorado (no es whatsapp_business_account)');
    return;
  }

  // Extraer la estructura del evento
  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  if (!value) {
    logger.debug('webhookController: Evento sin datos de valor');
    return;
  }

  const metadata = value.metadata;
  const contacts = value.contacts;
  const messages = value.messages;
  const statuses = value.statuses;

  // Procesar notificaciones de estado (entregado, leído, fallido)
  if (statuses && statuses.length > 0) {
    statuses.forEach((status) => {
      logger.info(`webhookController: Estado de mensaje`, {
        id: status.id,
        status: status.status,
        recipient: status.recipient_id,
      });
    });
    return;
  }

  // Procesar mensajes entrantes
  if (messages && messages.length > 0) {
    messages.forEach((message) => {
      // Ejecutar procesamiento asíncrono sin bloquear
      processIncomingMessage(message, contacts, metadata).catch((err) => {
        logger.error('webhookController: Error en procesamiento asíncrono', err.message);
      });
    });
  }
}

/**
 * Orquesta el flujo completo de procesamiento de un mensaje entrante:
 * 1. Marcar mensaje como leído
 * 2. Extraer información del contacto
 * 3. Extraer contenido del mensaje
 * 4. Descargar media si es necesario
 * 5. Enviar a Bina para procesamiento
 * 6. Transformar respuesta de Bina a formato Meta
 * 7. Enviar respuesta al usuario
 *
 * @param {Object} message  - Objeto de mensaje de Meta
 * @param {Array}  contacts - Array de contactos del webhook
 * @param {Object} metadata - Metadatos del webhook (phone_number_id, etc.)
 */
async function processIncomingMessage(message, contacts, metadata) {
  const messageId = message.id;
  const from = message.from;
  const messageType = message.type;

  logger.info(`webhookController: Procesando mensaje`, {
    from,
    type: messageType,
    id: messageId,
  });

  try {
    // Paso 1: Marcar el mensaje como leído (doble check azul)
    await metaApiService.markAsRead(messageId).catch((err) => {
      logger.warn('webhookController: No se pudo marcar como leído', err.message);
    });

    // Paso 2: Extraer información del remitente
    const userInfo = extractContactInfo(contacts);
    userInfo.phone = from;

    // Paso 3: Extraer contenido del mensaje según su tipo
    const messageContent = extractMessageContent(message);

    // Paso 4: Actualizar/crear sesión del usuario
    sessionService.updateSession(from, {
      lastMessageType: messageType,
      lastMessageId: messageId,
    });

    // Paso 5: Enviar mensaje a Bina para obtener respuesta
    const binaResponse = await binaService.sendMessage(
      from,        // session_id = número de teléfono del usuario
      userInfo,
      messageContent,
      messageType
    );

    // Paso 6: Transformar respuesta de Bina al formato de Meta
    const metaMessage = transformBinaResponse(binaResponse, from);

    // Paso 7: Enviar la respuesta al usuario vía Meta API
    await sendResponse(from, metaMessage);

    logger.info(`webhookController: Mensaje procesado exitosamente`, { from, type: metaMessage.type });

  } catch (err) {
    logger.error(`webhookController: Error procesando mensaje de ${from}`, err.message);

    // Intento de respuesta de fallback al usuario
    try {
      await metaApiService.sendTextMessage(
        from,
        'Lo siento, ocurrió un error al procesar tu mensaje. Por favor intenta nuevamente.'
      );
    } catch (fallbackErr) {
      logger.error('webhookController: No se pudo enviar respuesta de fallback', fallbackErr.message);
    }
  }
}

/**
 * Envía la respuesta transformada al usuario según el tipo de mensaje.
 *
 * @param {string} to         - Número de destino
 * @param {Object} metaMessage - Mensaje transformado con { type, payload }
 */
async function sendResponse(to, metaMessage) {
  const { type, payload } = metaMessage;

  switch (type) {
    case 'text':
      await metaApiService.sendTextMessage(to, payload.text.body);
      break;

    case 'interactive_buttons':
      await metaApiService.sendInteractiveButtons(
        to,
        payload.interactive.body.text,
        payload.interactive.action.buttons.map((b) => ({ id: b.reply.id, title: b.reply.title }))
      );
      break;

    case 'interactive_list':
      await metaApiService.sendInteractiveList(
        to,
        payload.interactive.body.text,
        payload.interactive.action.button,
        payload.interactive.action.sections
      );
      break;

    case 'document':
      await metaApiService.sendDocument(
        to,
        payload.document.link,
        payload.document.caption,
        payload.document.filename
      );
      break;

    default:
      // Fallback: enviar como texto si el tipo no es reconocido
      logger.warn(`webhookController: Tipo de respuesta no manejado: ${type}, enviando como texto`);
      await metaApiService.sendTextMessage(to, payload.text?.body || 'Respuesta procesada.');
  }
}

module.exports = {
  verifyWebhook,
  handleWebhook,
  processIncomingMessage,
};
