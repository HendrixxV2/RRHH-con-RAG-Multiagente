// Backend/config/google-drive.js
const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();

// Leemos la ruta del archivo de credenciales desde el .env, o usamos una ruta por defecto
const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '..', 'service-account-key.json');

// Configuramos la autenticación con los scopes necesarios (solo lectura para Drive)
const auth = new google.auth.GoogleAuth({
  keyFile: keyFilePath,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});

/**
 * Retorna un cliente autenticado de Google Drive v3
 */
async function getDriveClient() {
  try {
    const authClient = await auth.getClient();
    return google.drive({ version: 'v3', auth: authClient });
  } catch (error) {
    console.error('❌ Error al autenticar con Google Drive:', error.message);
    throw error;
  }
}

module.exports = { getDriveClient };