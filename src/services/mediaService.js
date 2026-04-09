'use strict';

/**
 * mediaService.js
 * Manejo de descarga y subida de archivos multimedia en la integración con Meta.
 * Los archivos multimedia (imágenes, documentos, audio, video) requieren
 * un proceso especial de dos pasos para ser accedidos.
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const CONFIG = require('../config/environment');
const logger = require('../utils/logger');

class MediaService {
  /**
   * Descarga un archivo multimedia de Meta usando su ID.
   * Proceso en dos pasos:
   * 1. Obtener la URL temporal del archivo con el mediaId
   * 2. Descargar el contenido binario del archivo desde esa URL
   *
   * @param {string} mediaId - ID del archivo multimedia proporcionado por Meta
   * @returns {Promise<Object>} Objeto con { buffer, mimeType, fileSize }
   */
  async downloadMedia(mediaId) {
    // Paso 1: Obtener metadatos y URL de descarga
    const mediaInfo = await this.getMediaUrl(mediaId);

    logger.info(`mediaService: Descargando media`, { mediaId, url: mediaInfo.url, mime: mediaInfo.mime_type });

    // Paso 2: Descargar el archivo binario
    const fileResponse = await axios.get(mediaInfo.url, {
      responseType: 'arraybuffer',
      headers: {
        'Authorization': `Bearer ${CONFIG.meta.accessToken}`,
      },
      timeout: 30000, // 30 segundos para archivos grandes
    });

    const buffer = Buffer.from(fileResponse.data);
    logger.info(`mediaService: Media descargada exitosamente`, {
      mediaId,
      bytes: buffer.length,
      mimeType: mediaInfo.mime_type,
    });

    return {
      buffer,
      mimeType: mediaInfo.mime_type,
      fileSize: buffer.length,
      sha256: mediaInfo.sha256,
    };
  }

  /**
   * Obtiene la URL de descarga y metadatos de un archivo multimedia sin descargarlo.
   *
   * @param {string} mediaId - ID del archivo multimedia
   * @returns {Promise<Object>} Metadatos del archivo: { url, mime_type, sha256, file_size, id }
   */
  async getMediaUrl(mediaId) {
    try {
      const response = await axios.get(
        `${CONFIG.meta.baseUrl}/${CONFIG.meta.apiVersion}/${mediaId}`,
        {
          headers: {
            'Authorization': `Bearer ${CONFIG.meta.accessToken}`,
          },
        }
      );
      return response.data;
    } catch (err) {
      logger.error('mediaService: Error obteniendo URL de media', {
        mediaId,
        error: err.response?.data || err.message,
      });
      throw err;
    }
  }

  /**
   * Sube un archivo multimedia a Meta para poder enviarlo a usuarios.
   * Meta devuelve un media_id que luego se usa en los mensajes salientes.
   *
   * @param {string} filePath - Ruta absoluta del archivo a subir
   * @param {string} mimeType - Tipo MIME del archivo (ej: 'image/jpeg', 'application/pdf')
   * @returns {Promise<string>} ID del media subido en Meta
   */
  async uploadMedia(filePath, mimeType) {
    try {
      const form = new FormData();
      form.append('messaging_product', 'whatsapp');
      form.append('file', fs.createReadStream(filePath), { contentType: mimeType });
      form.append('type', mimeType);

      const response = await axios.post(
        `${CONFIG.meta.baseUrl}/${CONFIG.meta.apiVersion}/${CONFIG.meta.phoneNumberId}/media`,
        form,
        {
          headers: {
            'Authorization': `Bearer ${CONFIG.meta.accessToken}`,
            ...form.getHeaders(),
          },
          timeout: 60000, // 60 segundos para uploads grandes
        }
      );

      const mediaId = response.data.id;
      logger.info(`mediaService: Media subida exitosamente`, { filePath, mediaId });
      return mediaId;
    } catch (err) {
      logger.error('mediaService: Error subiendo media', {
        filePath,
        error: err.response?.data || err.message,
      });
      throw err;
    }
  }
}

module.exports = new MediaService();
