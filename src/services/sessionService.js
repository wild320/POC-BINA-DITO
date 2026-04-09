'use strict';

/**
 * sessionService.js
 * Gestión de sesiones de usuario y control de la ventana de 24 horas de Meta.
 *
 * NOTA PARA PRODUCCIÓN:
 * Este servicio usa almacenamiento en memoria (Map) adecuado solo para la PoC.
 * En producción se debe migrar a Redis o una base de datos persistente para:
 * - Soportar múltiples instancias del servidor (escalado horizontal)
 * - Persistir sesiones ante reinicios
 * - Gestionar TTL de forma eficiente
 */

const logger = require('../utils/logger');
const { SESSION_WINDOW_HOURS } = require('../config/constants');

class SessionService {
  constructor() {
    /**
     * Map que almacena las sesiones activas.
     * Clave: userId (número de teléfono del usuario)
     * Valor: objeto de sesión con metadatos de la conversación
     *
     * PRODUCCIÓN: Reemplazar este Map con un cliente de Redis:
     *   const redis = require('ioredis');
     *   this.store = new redis({ host: process.env.REDIS_HOST });
     */
    this.sessions = new Map();

    // Limpiar sesiones expiradas cada 30 minutos para liberar memoria
    this.cleanupInterval = setInterval(() => {
      this.clearExpiredSessions();
    }, 30 * 60 * 1000);

    // Evitar que el interval bloquee el cierre del proceso
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Obtiene la sesión de un usuario. Si no existe, crea una nueva sesión vacía.
   *
   * @param {string} userId - Número de teléfono del usuario (wa_id)
   * @returns {Object} Objeto de sesión del usuario
   */
  getSession(userId) {
    if (!this.sessions.has(userId)) {
      const newSession = {
        userId,
        createdAt: new Date().toISOString(),
        lastMessageAt: null,
        messageCount: 0,
        context: {},
      };
      this.sessions.set(userId, newSession);
      logger.debug(`sessionService: Nueva sesión creada para ${userId}`);
    }
    return this.sessions.get(userId);
  }

  /**
   * Actualiza los datos de una sesión existente.
   * Registra el timestamp del último mensaje para el control de la ventana de 24h.
   *
   * @param {string} userId - Número de teléfono del usuario
   * @param {Object} data   - Datos a fusionar en la sesión
   */
  updateSession(userId, data) {
    const session = this.getSession(userId);
    const updated = {
      ...session,
      ...data,
      lastMessageAt: new Date().toISOString(),
      messageCount: (session.messageCount || 0) + 1,
    };
    this.sessions.set(userId, updated);
    logger.debug(`sessionService: Sesión actualizada para ${userId}`, {
      messageCount: updated.messageCount,
    });
  }

  /**
   * Verifica si el usuario está dentro de la ventana de conversación de 24 horas.
   * Meta permite enviar mensajes de texto libre solo dentro de esta ventana.
   * Fuera de ella, solo se pueden enviar templates aprobados.
   *
   * @param {string} userId - Número de teléfono del usuario
   * @returns {boolean} true si está dentro de la ventana de 24h, false si no
   */
  isWithinWindow(userId) {
    const session = this.sessions.get(userId);

    // Si no hay sesión o no hay mensaje previo, no estamos dentro de la ventana
    if (!session || !session.lastMessageAt) {
      return false;
    }

    const lastMessageTime = new Date(session.lastMessageAt).getTime();
    const nowTime = Date.now();
    const windowMs = SESSION_WINDOW_HOURS * 60 * 60 * 1000;

    return (nowTime - lastMessageTime) < windowMs;
  }

  /**
   * Elimina todas las sesiones cuya última actividad supere la ventana de 24h.
   * Se ejecuta automáticamente cada 30 minutos para liberar memoria.
   */
  clearExpiredSessions() {
    const windowMs = SESSION_WINDOW_HOURS * 60 * 60 * 1000;
    const nowTime = Date.now();
    let cleared = 0;

    for (const [userId, session] of this.sessions.entries()) {
      if (session.lastMessageAt) {
        const lastMessageTime = new Date(session.lastMessageAt).getTime();
        if ((nowTime - lastMessageTime) > windowMs) {
          this.sessions.delete(userId);
          cleared++;
        }
      }
    }

    if (cleared > 0) {
      logger.info(`sessionService: ${cleared} sesiones expiradas eliminadas`);
    }
  }

  /**
   * Retorna estadísticas del estado actual de las sesiones.
   * Útil para el endpoint /health.
   *
   * @returns {Object} Estadísticas de sesiones
   */
  getStats() {
    return {
      activeSessions: this.sessions.size,
      storageType: 'in-memory (Map)',
    };
  }
}

module.exports = new SessionService();
