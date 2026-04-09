'use strict';

/**
 * signatureService.js
 * Servicio para validar y generar firmas HMAC-SHA256 de Meta.
 * Meta firma cada request POST al webhook con el App Secret para garantizar autenticidad.
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

class SignatureService {
  /**
   * Valida la firma HMAC-SHA256 que Meta incluye en el header X-Hub-Signature-256.
   *
   * @param {Buffer|string} rawBody        - Cuerpo crudo del request (sin parsear)
   * @param {string}        signatureHeader - Valor del header X-Hub-Signature-256 (formato: "sha256=<hash>")
   * @param {string}        appSecret       - App Secret de la aplicación de Meta
   * @returns {boolean} true si la firma es válida, false en caso contrario
   */
  validateSignature(rawBody, signatureHeader, appSecret) {
    if (!signatureHeader || !appSecret) {
      logger.warn('signatureService: Falta la firma o el App Secret');
      return false;
    }

    // El header tiene formato "sha256=<hash_hexadecimal>"
    const parts = signatureHeader.split('=');
    if (parts.length !== 2 || parts[0] !== 'sha256') {
      logger.warn('signatureService: Formato de firma inválido', { signatureHeader });
      return false;
    }

    const receivedSignature = parts[1];

    // Calcular la firma esperada con el App Secret
    const expectedSignature = crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

    // Usar comparación de tiempo constante para prevenir timing attacks
    try {
      const receivedBuffer = Buffer.from(receivedSignature, 'hex');
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');

      if (receivedBuffer.length !== expectedBuffer.length) {
        logger.warn('signatureService: Longitud de firma no coincide');
        return false;
      }

      return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
    } catch (err) {
      logger.error('signatureService: Error al comparar firmas', err.message);
      return false;
    }
  }

  /**
   * Genera una firma HMAC-SHA256 para un payload dado.
   * Útil para pruebas y simulación de requests desde Meta.
   *
   * @param {string|Buffer} payload - Contenido a firmar
   * @param {string}        secret  - Secreto con el que firmar
   * @returns {string} Firma en formato "sha256=<hash_hexadecimal>"
   */
  generateSignature(payload, secret) {
    const hash = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    return `sha256=${hash}`;
  }
}

module.exports = new SignatureService();
