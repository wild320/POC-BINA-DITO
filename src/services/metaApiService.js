'use strict';

/**
 * metaApiService.js
 * Cliente HTTP para interactuar con la API de Meta WhatsApp Business Cloud.
 * Centraliza todos los llamados salientes hacia graph.facebook.com.
 */

const axios = require('axios');
const CONFIG = require('../config/environment');
const logger = require('../utils/logger');

class MetaApiService {
  constructor() {
    // URL base para los mensajes del número configurado
    this.baseUrl = `${CONFIG.meta.baseUrl}/${CONFIG.meta.apiVersion}/${CONFIG.meta.phoneNumberId}`;

    // Cliente axios con configuración base
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
      headers: {
        'Authorization': `Bearer ${CONFIG.meta.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Realiza un POST a la API de mensajes de Meta con manejo de errores.
   * @private
   * @param {Object} payload - Cuerpo del mensaje a enviar
   * @returns {Promise<Object>} Respuesta de la API de Meta
   */
  async _post(payload) {
    try {
      logger.debug('metaApiService: Enviando request a Meta', { type: payload.type, to: payload.to });
      const response = await this.client.post('/messages', payload);
      logger.debug('metaApiService: Respuesta de Meta', response.data);
      return response.data;
    } catch (err) {
      const errorData = err.response?.data || err.message;
      logger.error('metaApiService: Error en request a Meta', errorData);
      throw err;
    }
  }

  /**
   * Envía un mensaje de texto simple a un usuario.
   *
   * @param {string} to   - Número de destino en formato internacional (ej: 573001234567)
   * @param {string} text - Texto del mensaje
   * @returns {Promise<Object>} Respuesta de Meta con el ID del mensaje enviado
   */
  async sendTextMessage(to, text) {
    return this._post({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body: text,
      },
    });
  }

  /**
   * Envía un mensaje interactivo con botones de respuesta rápida (máximo 3).
   *
   * @param {string}   to       - Número de destino
   * @param {string}   bodyText - Texto principal del mensaje
   * @param {Array}    buttons  - Array de botones: [{ id: 'btn_1', title: 'Opción 1' }]
   * @returns {Promise<Object>} Respuesta de Meta
   */
  async sendInteractiveButtons(to, bodyText, buttons) {
    const formattedButtons = buttons.slice(0, 3).map((btn) => ({
      type: 'reply',
      reply: {
        id: btn.id || btn.title.toLowerCase().replace(/\s+/g, '_'),
        title: btn.title.substring(0, 20), // Meta limita el título a 20 caracteres
      },
    }));

    return this._post({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: { buttons: formattedButtons },
      },
    });
  }

  /**
   * Envía un mensaje interactivo de lista (hasta 10 opciones).
   *
   * @param {string} to          - Número de destino
   * @param {string} bodyText    - Texto principal del mensaje
   * @param {string} buttonLabel - Etiqueta del botón que abre la lista
   * @param {Array}  sections    - Secciones con filas: [{ title: 'Sección', rows: [{ id, title, description }] }]
   * @returns {Promise<Object>} Respuesta de Meta
   */
  async sendInteractiveList(to, bodyText, buttonLabel, sections) {
    return this._post({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: bodyText },
        action: {
          button: buttonLabel.substring(0, 20),
          sections,
        },
      },
    });
  }

  /**
   * Envía un mensaje basado en una plantilla aprobada por Meta.
   * Necesario para iniciar conversaciones fuera de la ventana de 24h.
   *
   * @param {string} to           - Número de destino
   * @param {string} templateName - Nombre del template aprobado
   * @param {string} languageCode - Código de idioma (ej: 'es', 'en_US')
   * @param {Array}  [parameters] - Parámetros para variables del template
   * @returns {Promise<Object>} Respuesta de Meta
   */
  async sendTemplate(to, templateName, languageCode, parameters = []) {
    const components = [];
    if (parameters.length > 0) {
      components.push({
        type: 'body',
        parameters: parameters.map((p) => ({ type: 'text', text: String(p) })),
      });
    }

    return this._post({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    });
  }

  /**
   * Envía un documento (PDF, DOCX, etc.) a un usuario.
   *
   * @param {string} to          - Número de destino
   * @param {string} documentUrl - URL pública del documento
   * @param {string} [caption]   - Texto descriptivo del documento
   * @param {string} [filename]  - Nombre del archivo a mostrar
   * @returns {Promise<Object>} Respuesta de Meta
   */
  async sendDocument(to, documentUrl, caption = '', filename = 'documento') {
    return this._post({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'document',
      document: {
        link: documentUrl,
        caption,
        filename,
      },
    });
  }

  /**
   * Envía una imagen a un usuario.
   *
   * @param {string} to       - Número de destino
   * @param {string} imageUrl - URL pública de la imagen
   * @param {string} [caption] - Texto descriptivo de la imagen
   * @returns {Promise<Object>} Respuesta de Meta
   */
  async sendImage(to, imageUrl, caption = '') {
    return this._post({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'image',
      image: {
        link: imageUrl,
        caption,
      },
    });
  }

  /**
   * Marca un mensaje recibido como leído.
   * Esto activa el doble check azul en el WhatsApp del usuario.
   *
   * @param {string} messageId - ID del mensaje a marcar (formato wamid.XXXX)
   * @returns {Promise<Object>} Respuesta de Meta
   */
  async markAsRead(messageId) {
    return this._post({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
  }

  /**
   * Descarga un archivo multimedia usando su ID (proceso en 2 pasos):
   * 1. Obtener la URL de descarga con el ID del media
   * 2. Descargar el archivo desde esa URL
   *
   * @param {string} mediaId - ID del archivo multimedia
   * @returns {Promise<Buffer>} Buffer con el contenido del archivo
   */
  async downloadMedia(mediaId) {
    try {
      // Paso 1: Obtener la URL de descarga
      const metaClient = axios.create({
        baseURL: `${CONFIG.meta.baseUrl}/${CONFIG.meta.apiVersion}`,
        headers: { 'Authorization': `Bearer ${CONFIG.meta.accessToken}` },
      });

      const urlResponse = await metaClient.get(`/${mediaId}`);
      const mediaUrl = urlResponse.data.url;

      logger.debug('metaApiService: URL de media obtenida', { mediaId, url: mediaUrl });

      // Paso 2: Descargar el archivo desde la URL
      const fileResponse = await axios.get(mediaUrl, {
        responseType: 'arraybuffer',
        headers: { 'Authorization': `Bearer ${CONFIG.meta.accessToken}` },
      });

      logger.info(`metaApiService: Media descargada (${fileResponse.data.byteLength} bytes)`, { mediaId });
      return Buffer.from(fileResponse.data);
    } catch (err) {
      logger.error('metaApiService: Error descargando media', err.response?.data || err.message);
      throw err;
    }
  }
}

module.exports = new MetaApiService();
