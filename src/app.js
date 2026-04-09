'use strict';

/**
 * app.js
 * Entry point del servidor Express para la integración
 * Meta WhatsApp Business ↔ Bina IA
 */

const express = require('express');
const CONFIG = require('./config/environment');
const webhookRoutes = require('./routes/webhookRoutes');
const errorHandler = require('./middleware/errorHandler');
const sessionService = require('./services/sessionService');
const logger = require('./utils/logger');

const app = express();

// ─────────────────────────────────────────────
// Configuración del parser de JSON
// La opción 'verify' guarda el rawBody en el request,
// necesario para validar la firma HMAC-SHA256 de Meta.
// ─────────────────────────────────────────────
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
}));

// ─────────────────────────────────────────────
// Rutas del webhook de Meta
// ─────────────────────────────────────────────
app.use('/webhook', webhookRoutes);

// ─────────────────────────────────────────────
// Endpoint de Health Check
// Permite verificar que el servicio está activo
// y con la configuración correcta.
// ─────────────────────────────────────────────
app.get('/health', (_req, res) => {
  const sessionStats = sessionService.getStats();
  res.status(200).json({
    status: 'ok',
    service: 'poc-bina-dito',
    timestamp: new Date().toISOString(),
    environment: CONFIG.server.nodeEnv,
    config: {
      metaApiVersion: CONFIG.meta.apiVersion,
      metaPhoneNumberId: CONFIG.meta.phoneNumberId ? '***configurado***' : 'NO CONFIGURADO',
      binaApiUrl: CONFIG.bina.apiUrl,
      binaTimeout: `${CONFIG.bina.timeout}ms`,
    },
    sessions: sessionStats,
  });
});

// ─────────────────────────────────────────────
// Middleware de manejo centralizado de errores
// Debe ir al final, después de todas las rutas
// ─────────────────────────────────────────────
app.use(errorHandler);

// ─────────────────────────────────────────────
// Inicio del servidor
// ─────────────────────────────────────────────
const PORT = CONFIG.server.port;

app.listen(PORT, () => {
  logger.info('═══════════════════════════════════════════════');
  logger.info('  POC - Integración Meta WhatsApp ↔ Bina IA   ');
  logger.info('═══════════════════════════════════════════════');
  logger.info(`Servidor iniciado en puerto: ${PORT}`);
  logger.info(`Entorno: ${CONFIG.server.nodeEnv}`);
  logger.info(`Webhook URL: http://localhost:${PORT}/webhook/whatsapp`);
  logger.info(`Health Check: http://localhost:${PORT}/health`);
  logger.info(`Bina IA endpoint: ${CONFIG.bina.apiUrl}`);
  logger.info('═══════════════════════════════════════════════');
  logger.info('Para exponer localmente usa: npm run tunnel (ngrok)');
});

module.exports = app;
