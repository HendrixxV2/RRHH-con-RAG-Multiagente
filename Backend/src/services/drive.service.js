// Backend/src/services/drive.service.js
const { getDriveClient } = require('../../config/google-drive');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Extrae el texto de un archivo de Google Drive según su MIME type.
 * @param {string} fileId - El ID del archivo en Drive.
 * @param {string} mimeType - El tipo MIME del archivo.
 * @returns {Promise<string>} El texto extraído del documento.
 */
async function extraerTexto(fileId, mimeType) {
  const drive = await getDriveClient();

  try {
    if (!mimeType) {
      const metadata = await drive.files.get({ fileId, fields: 'mimeType' });
      mimeType = metadata.data.mimeType;
    }

    if (!mimeType) {
      throw new Error(`No se pudo determinar el tipo MIME del archivo ${fileId}`);
    }

    // 1. GOOGLE DOCS NATIVOS -> Exportar como texto plano
    if (mimeType === 'application/vnd.google-apps.document') {
      const res = await drive.files.export(
        { fileId, mimeType: 'text/plain' },
        { responseType: 'text' }
      );
      return res.data;
    }

    // 2. GOOGLE SHEETS -> Exportar como CSV
    if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      const res = await drive.files.export(
        { fileId, mimeType: 'text/csv' },
        { responseType: 'text' }
      );
      return res.data;
    }

    // 3. ARCHIVOS BINARIOS (PDF, DOCX) -> Descargar y parsear
    const res = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    // Recolectamos el stream en un Buffer
    const chunks = [];
    for await (const chunk of res.data) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Los binarios se parsean según su formato.
    if (mimeType === 'application/pdf') {
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        return result.text;
      } finally {
        await parser.destroy();
      }
    }

    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    if (mimeType === 'text/plain' || mimeType === 'text/csv') {
      return buffer.toString('utf-8');
    }

    throw new Error(`Formato no compatible para extracción: ${mimeType}`);

  } catch (error) {
    console.error(`❌ Error extrayendo texto del archivo ${fileId}:`, error.message);
    throw error;
  }
}

module.exports = { extraerTexto };