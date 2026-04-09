'use strict';

/**
 * environment.js
 * Carga y valida las variables de entorno necesarias para la aplicación.
 * Todas las configuraciones sensibles se leen desde el archivo .env.
 */

require('dotenv').config();

/**
 * Objeto de configuración central de la aplicación.
 * Agrupa las variables por dominio: meta, bina, server.
 */
const CONFIG = {
  meta: {
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
    accessToken: process.env.META_ACCESS_TOKEN,
    phoneNumberId: process.env.META_PHONE_NUMBER_ID,
    verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN,
    apiVersion: process.env.META_API_VERSION || 'v21.0',
    baseUrl: 'https://graph.facebook.com',
  },
  bina: {
    apiUrl: process.env.BINA_API_URL || 'https://clouderp.abakoerp.com:9619/apiagenteia',
    timeout: parseInt(process.env.BINA_TIMEOUT_MS || '10000', 10),
    apiKey: process.env.BINA_API_KEY || '',
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
};

/**
 * Variables de entorno requeridas en producción.
 * En desarrollo se permiten valores vacíos para facilitar las pruebas iniciales.
 */
const REQUIRED_VARS = [
  'META_APP_SECRET',
  'META_ACCESS_TOKEN',
  'META_PHONE_NUMBER_ID',
  'META_WEBHOOK_VERIFY_TOKEN',
];

/**
 * Valida que las variables requeridas estén definidas.
 * Lanza un error si alguna falta (solo en producción).
 */
function validateEnvironment() {
  const missing = REQUIRED_VARS.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    const msg = `Variables de entorno requeridas no configuradas: ${missing.join(', ')}`;
    if (CONFIG.server.nodeEnv === 'production') {
      throw new Error(msg);
    } else {
      console.warn(`⚠️  ADVERTENCIA: ${msg}`);
      console.warn('   Configura el archivo .env antes de usar la aplicación en producción.');
    }
  }
}

// Ejecutar validación al cargar el módulo
validateEnvironment();

module.exports = CONFIG;
