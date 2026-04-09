'use strict';

/**
 * logger.js
 * Utilidad de logging con timestamps y colores en consola.
 * Formato: [YYYY-MM-DD HH:mm:ss] [LEVEL] mensaje
 */

// Códigos de color ANSI para la consola
const COLORS = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
};

/**
 * Genera un timestamp con formato legible.
 * @returns {string} Timestamp en formato YYYY-MM-DD HH:mm:ss
 */
function getTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
         `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

/**
 * Formatea e imprime un mensaje de log en consola.
 * @param {string} level   - Nivel del log (INFO, WARN, ERROR, DEBUG)
 * @param {string} color   - Código de color ANSI
 * @param {string} message - Mensaje principal
 * @param {*}      [data]  - Datos adicionales opcionales
 */
function log(level, color, message, data) {
  const timestamp = getTimestamp();
  const prefix = `${COLORS.gray}[${timestamp}]${COLORS.reset} ${color}[${level}]${COLORS.reset}`;
  // Se usa un array de argumentos para evitar que 'message' sea interpretado
  // como cadena de formato si contiene caracteres como %s, %d, etc.
  // NOTA: Nunca pasar valores sensibles (tokens, secretos) como argumento 'data'.
  // Las credenciales deben enmascararse antes de ser registradas ('***').
  const args = [`${prefix} %s`, String(message)];
  if (data !== undefined) {
    args.push(typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data));
  }
  console.log(...args);
}

/**
 * Log de nivel INFO - para eventos normales del sistema.
 * @param {string} message - Mensaje descriptivo
 * @param {*}      [data]  - Datos adicionales
 */
function info(message, data) {
  log('INFO ', COLORS.cyan, message, data);
}

/**
 * Log de nivel WARN - para situaciones anómalas no críticas.
 * @param {string} message - Mensaje descriptivo
 * @param {*}      [data]  - Datos adicionales
 */
function warn(message, data) {
  log('WARN ', COLORS.yellow, message, data);
}

/**
 * Log de nivel ERROR - para errores que requieren atención.
 * @param {string} message - Mensaje descriptivo
 * @param {*}      [data]  - Datos adicionales (puede incluir stack trace)
 */
function error(message, data) {
  log('ERROR', COLORS.red, message, data);
}

/**
 * Log de nivel DEBUG - solo activo cuando NODE_ENV=development.
 * @param {string} message - Mensaje descriptivo
 * @param {*}      [data]  - Datos adicionales
 */
function debug(message, data) {
  if (process.env.NODE_ENV !== 'production') {
    log('DEBUG', COLORS.gray, message, data);
  }
}

module.exports = { info, warn, error, debug };
