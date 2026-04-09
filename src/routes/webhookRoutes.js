'use strict';

/**
 * webhookRoutes.js
 * Definición de rutas del webhook de Meta WhatsApp Business.
 */

const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const signatureValidator = require('../middleware/signatureValidator');

/**
 * GET /webhook/whatsapp
 * Verificación del webhook por Meta.
 * Meta llama a este endpoint cuando se configura el webhook en el portal de desarrolladores.
 * No requiere validación de firma (es un GET sin body).
 */
router.get('/whatsapp', webhookController.verifyWebhook);

/**
 * POST /webhook/whatsapp
 * Recepción de mensajes y eventos entrantes de WhatsApp.
 * Requiere validación de firma HMAC-SHA256 (X-Hub-Signature-256).
 */
router.post('/whatsapp', signatureValidator, webhookController.handleWebhook);

module.exports = router;
