'use strict';

/**
 * outboundTransformer.js
 * Transforma las respuestas del agente Bina al formato de mensajes de Meta WhatsApp.
 * Selecciona automáticamente el tipo de mensaje de Meta más adecuado
 * según el contenido de la respuesta de Bina.
 */

const { MAX_BUTTONS, MAX_LIST_ROWS } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * Transforma la respuesta completa de Bina en uno o más mensajes de Meta.
 * Lógica de selección de tipo de mensaje:
 *  - suggestions/buttons ≤ 3 → mensaje interactivo con botones
 *  - suggestions/buttons entre 4 y 10 → mensaje interactivo con lista
 *  - document_url presente → mensaje de documento
 *  - Por defecto → mensaje de texto simple
 *
 * @param {Object} binaResponse - Respuesta del agente Bina
 * @param {string} to           - Número de destino del usuario
 * @returns {Object} Mensaje formateado para enviar a Meta
 */
function transformBinaResponse(binaResponse, to) {
  if (!binaResponse || !binaResponse.response) {
    logger.warn('outboundTransformer: Respuesta de Bina vacía o sin campo response');
    return buildMetaTextMessage(to, 'Lo siento, no pude procesar tu solicitud en este momento.');
  }

  const { response, suggestions } = binaResponse;
  const text = response.text || response.message || 'Procesando...';
  const buttons = suggestions || response.buttons || [];

  // Caso 1: Hay documento adjunto → mensaje de documento
  if (response.document_url) {
    return {
      type: 'document',
      payload: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'document',
        document: {
          link: response.document_url,
          caption: text,
          filename: response.document_name || 'documento.pdf',
        },
      },
    };
  }

  // Caso 2: Hay entre 1 y MAX_BUTTONS sugerencias → botones interactivos
  if (buttons.length >= 1 && buttons.length <= MAX_BUTTONS) {
    return {
      type: 'interactive_buttons',
      payload: buildMetaButtonMessage(to, text, buttons),
    };
  }

  // Caso 3: Hay entre MAX_BUTTONS+1 y MAX_LIST_ROWS sugerencias → lista interactiva
  if (buttons.length > MAX_BUTTONS && buttons.length <= MAX_LIST_ROWS) {
    return {
      type: 'interactive_list',
      payload: buildMetaListMessage(to, text, buttons),
    };
  }

  // Caso por defecto: mensaje de texto simple
  return {
    type: 'text',
    payload: buildMetaTextMessage(to, text),
  };
}

/**
 * Construye un mensaje de texto simple para Meta.
 *
 * @param {string} to   - Número de destino
 * @param {string} text - Texto del mensaje
 * @returns {Object} Payload para la API de Meta
 */
function buildMetaTextMessage(to, text) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: {
      preview_url: false,
      body: text,
    },
  };
}

/**
 * Construye un mensaje interactivo con botones de respuesta rápida para Meta.
 *
 * @param {string} to      - Número de destino
 * @param {string} text    - Texto principal del mensaje
 * @param {Array}  buttons - Sugerencias de Bina: [{ id, title } | string]
 * @returns {Object} Payload de mensaje interactivo con botones
 */
function buildMetaButtonMessage(to, text, buttons) {
  const formattedButtons = buttons.slice(0, MAX_BUTTONS).map((btn, index) => {
    const title = typeof btn === 'string' ? btn : (btn.title || btn.label || `Opción ${index + 1}`);
    const id = typeof btn === 'string' ? `opt_${index}` : (btn.id || `opt_${index}`);
    return {
      type: 'reply',
      reply: {
        id: id.substring(0, 256),
        title: title.substring(0, 20), // Meta limita el título del botón a 20 caracteres
      },
    };
  });

  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text },
      action: { buttons: formattedButtons },
    },
  };
}

/**
 * Construye un mensaje interactivo de lista para Meta.
 *
 * @param {string} to      - Número de destino
 * @param {string} text    - Texto principal del mensaje
 * @param {Array}  options - Opciones de la lista: [{ id, title, description } | string]
 * @returns {Object} Payload de mensaje interactivo de lista
 */
function buildMetaListMessage(to, text, options) {
  const rows = options.slice(0, MAX_LIST_ROWS).map((opt, index) => {
    const title = typeof opt === 'string' ? opt : (opt.title || opt.label || `Opción ${index + 1}`);
    const id = typeof opt === 'string' ? `opt_${index}` : (opt.id || `opt_${index}`);
    const description = typeof opt === 'object' ? (opt.description || '') : '';
    return { id, title: title.substring(0, 24), description: description.substring(0, 72) };
  });

  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text },
      action: {
        button: 'Ver opciones',
        sections: [{ title: 'Opciones disponibles', rows }],
      },
    },
  };
}

module.exports = {
  transformBinaResponse,
  buildMetaTextMessage,
  buildMetaButtonMessage,
};
