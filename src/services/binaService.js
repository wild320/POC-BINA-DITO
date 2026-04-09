'use strict';

/**
 * binaService.js
 * Cliente HTTP para comunicarse con el agente de IA Bina.
 * Endpoint: https://clouderp.abakoerp.com:9619/apiagenteia
 *
 * Bina es el motor de inteligencia artificial que procesa los mensajes
 * de los usuarios y genera respuestas contextuales.
 */

const axios = require('axios');
const CONFIG = require('../config/environment');
const logger = require('../utils/logger');

class BinaService {
  constructor() {
    // Cliente HTTP dedicado para Bina con timeout configurable
    this.client = axios.create({
      baseURL: CONFIG.bina.apiUrl,
      timeout: CONFIG.bina.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(CONFIG.bina.apiKey ? { 'X-API-Key': CONFIG.bina.apiKey } : {}),
      },
    });
  }

  /**
   * Envía un mensaje al agente Bina para su procesamiento y obtiene la respuesta.
   *
   * @param {string} sessionId      - Identificador único de la sesión (generalmente el wa_id del usuario)
   * @param {Object} userInfo       - Información del usuario { phone, name, wa_id }
   * @param {Object} messageContent - Contenido del mensaje procesado
   * @param {string} messageType    - Tipo del mensaje (text, image, document, etc.)
   * @returns {Promise<Object>} Respuesta de Bina con el texto a enviar al usuario
   */
  async sendMessage(sessionId, userInfo, messageContent, messageType) {
    const requestPayload = {
      session_id: sessionId,
      channel: 'whatsapp',
      user: {
        phone: userInfo.phone,
        name: userInfo.name || 'Usuario',
        wa_id: userInfo.wa_id || userInfo.phone,
      },
      message: {
        type: messageType,
        content: messageContent,
        timestamp: new Date().toISOString(),
        message_id: messageContent.message_id || null,
      },
      context: {
        business_phone: CONFIG.meta.phoneNumberId,
        platform: 'whatsapp_cloud_api',
        api_version: CONFIG.meta.apiVersion,
      },
    };

    logger.info(`binaService: Enviando mensaje a Bina`, {
      sessionId,
      messageType,
      user: userInfo.phone,
    });
    logger.debug('binaService: Request completo a Bina', requestPayload);

    try {
      const response = await this.client.post('', requestPayload);

      logger.info('binaService: Respuesta recibida de Bina', {
        sessionId,
        status: response.status,
      });
      logger.debug('binaService: Respuesta completa de Bina', response.data);

      return response.data;
    } catch (err) {
      // Si Bina no está disponible, retornar respuesta de fallback
      if (err.code === 'ECONNABORTED' || err.code === 'ECONNREFUSED' || err.response?.status >= 500) {
        logger.warn('binaService: Bina no disponible, usando respuesta de fallback', {
          error: err.message,
          code: err.code,
        });
        return this._getFallbackResponse(sessionId, messageContent);
      }

      logger.error('binaService: Error en comunicación con Bina', {
        error: err.response?.data || err.message,
        status: err.response?.status,
      });
      throw err;
    }
  }

  /**
   * Genera una respuesta de fallback cuando Bina no está disponible.
   * Garantiza que el usuario siempre reciba una respuesta aunque el servicio de IA falle.
   *
   * @private
   * @param {string} sessionId      - ID de la sesión
   * @param {Object} messageContent - Contenido del mensaje original
   * @returns {Object} Respuesta de fallback con formato compatible con Bina
   */
  _getFallbackResponse(sessionId, messageContent) {
    return {
      session_id: sessionId,
      response: {
        type: 'text',
        text: 'Gracias por tu mensaje. En este momento estamos experimentando dificultades técnicas. ' +
              'Por favor intenta nuevamente en unos minutos o comunícate con nosotros por otro canal.',
      },
      suggestions: [],
      metadata: {
        fallback: true,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

module.exports = new BinaService();
