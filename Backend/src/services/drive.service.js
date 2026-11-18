// Backend/src/services/drive.service.js
const { getDriveClient } = require('../../config/google-drive');
const pdf = require('pdf-parse');

/**
 * Extrae el texto de un archivo de Google Drive según su MIME type.
 * @param {string} fileId - El ID del archivo en Drive.
 * @param {string} mimeType - El tipo MIME del archivo.
 * @returns {Promise<string>} El texto extraído del documento.
 */
async function extraerTexto(fileId, mimeType) {
  const drive = await getDriveClient();

  try {
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

    // Si es un PDF, usamos pdf-parse
    if (mimeType === 'application/pdf') {
      const data = await pdf(buffer);
      return data.text;
    }

    // Fallback: Si es texto plano u otro formato legible
    return buffer.toString('utf-8');

  } catch (error) {
    console.error(`❌ Error extrayendo texto del archivo ${fileId}:`, error.message);
    throw error;
  }
}

module.exports = { extraerTexto };