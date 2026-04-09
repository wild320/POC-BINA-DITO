'use strict';

/**
 * signatureValidator.js
 * Middleware de Express para validar la firma HMAC-SHA256 de los webhooks de Meta.
 * Meta firma cada request POST con el App Secret para garantizar autenticidad.
 * Documentación: https://developers.facebook.com/docs/messenger-platform/webhooks#security
 */

const CONFIG = require('../config/environment');
const signatureService = require('../services/signatureService');
const logger = require('../utils/logger');

/**
 * Middleware que valida el header X-Hub-Signature-256 de los requests de Meta.
 * - En producción: rechaza requests sin firma válida con 401
 * - En desarrollo: permite requests sin firma (para facilitar pruebas con herramientas como curl/Postman)
 *
 * IMPORTANTE: Para que este middleware funcione, express.json() debe configurarse
 * con la opción 'verify' para preservar el rawBody del request.
 *
 * @param {import('express').Request}  req  - Request de Express
 * @param {import('express').Response} res  - Response de Express
 * @param {Function}                   next - Función next del middleware
 */
function signatureValidator(req, res, next) {
  const signatureHeader = req.headers['x-hub-signature-256'];
  const isProduction = CONFIG.server.nodeEnv === 'production';

  // Si no hay firma en el header
  if (!signatureHeader) {
    if (isProduction) {
      logger.warn('signatureValidator: Request sin firma recibido en producción');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Firma de webhook requerida',
      });
    }
    // En desarrollo: advertir pero continuar
    logger.warn('signatureValidator: Request sin firma (modo desarrollo - permitido)');
    return next();
  }

  // El rawBody debe estar disponible gracias a la configuración de express.json() en app.js
  const rawBody = req.rawBody;
  if (!rawBody) {
    logger.error('signatureValidator: rawBody no disponible. Verificar configuración de express.json()');
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Error en configuración del servidor',
    });
  }

  // Validar la firma usando el App Secret
  const isValid = signatureService.validateSignature(
    rawBody,
    signatureHeader,
    CONFIG.meta.appSecret
  );

  if (!isValid) {
    logger.warn('signatureValidator: Firma inválida rechazada', {
      ip: req.ip,
      signature: signatureHeader.substring(0, 20) + '...',
    });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Firma de webhook inválida',
    });
  }

  logger.debug('signatureValidator: Firma válida verificada');
  next();
}

module.exports = signatureValidator;
