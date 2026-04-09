'use strict';

/**
 * errorHandler.js
 * Middleware centralizado de manejo de errores para Express.
 * Captura todos los errores no manejados en los middleware y rutas anteriores.
 */

const logger = require('../utils/logger');
const CONFIG = require('../config/environment');

/**
 * Middleware de manejo global de errores de Express.
 * Debe registrarse al final de todos los middleware y rutas en app.js.
 *
 * - En producción: devuelve mensajes genéricos sin exponer detalles internos
 * - En desarrollo: incluye el stack trace completo para facilitar el debugging
 *
 * @param {Error}                      err  - Error capturado
 * @param {import('express').Request}  req  - Request de Express
 * @param {import('express').Response} res  - Response de Express
 * @param {Function}                   next - Función next (requerida por Express para reconocer el middleware como error handler)
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Registrar el error con contexto del request
  logger.error(`errorHandler: ${err.message}`, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    stack: CONFIG.server.nodeEnv !== 'production' ? err.stack : undefined,
  });

  // Determinar el código de estado HTTP (usar el del error si está definido, o 500 por defecto)
  const statusCode = err.statusCode || err.status || 500;

  // En producción, no exponer detalles internos del error
  const responseBody = {
    error: 'Internal Server Error',
    message: CONFIG.server.nodeEnv === 'production'
      ? 'Ha ocurrido un error interno. Por favor intenta nuevamente.'
      : err.message,
  };

  // En desarrollo, incluir el stack trace para facilitar el debugging
  if (CONFIG.server.nodeEnv !== 'production' && err.stack) {
    responseBody.stack = err.stack;
  }

  res.status(statusCode).json(responseBody);
}

module.exports = errorHandler;
