'use strict';

/**
 * inboundTransformer.js
 * Transforma los mensajes entrantes del formato de Meta WhatsApp
 * al formato esperado por el agente de IA Bina.
 */

const { MESSAGE_TYPES } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * Extrae el contenido relevante de un mensaje según su tipo.
 * Meta envía diferentes estructuras dependiendo del tipo de mensaje.
 *
 * @param {Object} message - Objeto de mensaje de Meta
 * @returns {Object} Contenido normalizado del mensaje
 */
function extractMessageContent(message) {
  const type = message.type;

  switch (type) {
    case MESSAGE_TYPES.TEXT:
      return {
        text: message.text?.body || '',
        message_id: message.id,
      };

    case MESSAGE_TYPES.IMAGE:
      return {
        media_id: message.image?.id,
        mime_type: message.image?.mime_type,
        sha256: message.image?.sha256,
        caption: message.image?.caption || '',
        message_id: message.id,
      };

    case MESSAGE_TYPES.DOCUMENT:
      return {
        media_id: message.document?.id,
        mime_type: message.document?.mime_type,
        sha256: message.document?.sha256,
        filename: message.document?.filename || 'archivo',
        caption: message.document?.caption || '',
        message_id: message.id,
      };

    case MESSAGE_TYPES.AUDIO:
      return {
        media_id: message.audio?.id,
        mime_type: message.audio?.mime_type,
        sha256: message.audio?.sha256,
        voice: message.audio?.voice || false,
        message_id: message.id,
      };

    case MESSAGE_TYPES.VIDEO:
      return {
        media_id: message.video?.id,
        mime_type: message.video?.mime_type,
        sha256: message.video?.sha256,
        caption: message.video?.caption || '',
        message_id: message.id,
      };

    case MESSAGE_TYPES.LOCATION:
      return {
        latitude: message.location?.latitude,
        longitude: message.location?.longitude,
        name: message.location?.name || '',
        address: message.location?.address || '',
        message_id: message.id,
      };

    case MESSAGE_TYPES.INTERACTIVE:
      // Manejo de respuestas a botones y listas
      if (message.interactive?.type === 'button_reply') {
        return {
          button_id: message.interactive.button_reply.id,
          button_title: message.interactive.button_reply.title,
          message_id: message.id,
        };
      }
      if (message.interactive?.type === 'list_reply') {
        return {
          list_id: message.interactive.list_reply.id,
          list_title: message.interactive.list_reply.title,
          list_description: message.interactive.list_reply.description || '',
          message_id: message.id,
        };
      }
      return { raw: message.interactive, message_id: message.id };

    case MESSAGE_TYPES.REACTION:
      return {
        emoji: message.reaction?.emoji,
        message_id_reacted: message.reaction?.message_id,
        message_id: message.id,
      };

    default:
      logger.warn(`inboundTransformer: Tipo de mensaje no manejado: ${type}`);
      return { raw: message, message_id: message.id };
  }
}

/**
 * Extrae la información del contacto (remitente) del array de contactos de Meta.
 *
 * @param {Array} contacts - Array de contactos del webhook de Meta
 * @returns {Object} Información del contacto { name, wa_id, phone }
 */
function extractContactInfo(contacts) {
  if (!contacts || contacts.length === 0) {
    return { name: 'Usuario', wa_id: '', phone: '' };
  }

  const contact = contacts[0];
  return {
    name: contact.profile?.name || 'Usuario',
    wa_id: contact.wa_id || '',
    phone: contact.wa_id || '',
  };
}

/**
 * Construye el objeto de request completo para enviar al agente Bina.
 *
 * @param {string} sessionId   - ID de la sesión del usuario
 * @param {Object} userInfo    - Información del usuario { name, wa_id, phone }
 * @param {Object} messageData - Contenido del mensaje extraído
 * @param {Object} metadata    - Metadatos del webhook { phone_number_id, display_phone_number }
 * @returns {Object} Payload completo para Bina
 */
function buildBinaRequest(sessionId, userInfo, messageData, metadata) {
  return {
    session_id: sessionId,
    channel: 'whatsapp',
    user: {
      phone: userInfo.phone,
      name: userInfo.name,
      wa_id: userInfo.wa_id,
    },
    message: {
      type: messageData.type,
      content: messageData.content,
      timestamp: new Date().toISOString(),
      message_id: messageData.content?.message_id || null,
    },
    context: {
      business_phone: metadata?.phone_number_id || '',
      display_phone: metadata?.display_phone_number || '',
      platform: 'whatsapp_cloud_api',
    },
  };
}

module.exports = {
  extractMessageContent,
  extractContactInfo,
  buildBinaRequest,
};
