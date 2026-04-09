'use strict';

/**
 * constants.js
 * Constantes globales de la aplicación.
 * Centraliza valores que no cambian durante la ejecución.
 */

/**
 * Tipos de mensajes soportados por la API de WhatsApp Business.
 */
const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  DOCUMENT: 'document',
  AUDIO: 'audio',
  VIDEO: 'video',
  LOCATION: 'location',
  CONTACTS: 'contacts',
  STICKER: 'sticker',
  INTERACTIVE: 'interactive',
  TEMPLATE: 'template',
  REACTION: 'reaction',
};

/**
 * Estados de entrega de los mensajes enviados.
 */
const STATUS_TYPES = {
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
};

/**
 * Campos del webhook a los que nos suscribimos en Meta.
 */
const WEBHOOK_FIELDS = ['messages'];

/**
 * Versión de la API de Meta Graph a usar.
 */
const META_API_VERSION = 'v21.0';

/**
 * Límites de la API de mensajes interactivos.
 */
const MAX_BUTTONS = 3;       // Máximo de botones en mensaje interactivo tipo "button"
const MAX_LIST_ROWS = 10;    // Máximo de filas en mensaje interactivo tipo "list"

/**
 * Ventana de sesión en horas (política de Meta).
 * Después de este período se requieren templates para iniciar conversación.
 */
const SESSION_WINDOW_HOURS = 24;

module.exports = {
  MESSAGE_TYPES,
  STATUS_TYPES,
  WEBHOOK_FIELDS,
  META_API_VERSION,
  MAX_BUTTONS,
  MAX_LIST_ROWS,
  SESSION_WINDOW_HOURS,
};
