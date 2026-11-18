// Backend/config/google-drive.js
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const backendRoot = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(backendRoot, '.env') });

const configuredKeyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'service-account-key.json';
const keyFilePath = path.resolve(backendRoot, configuredKeyPath);

if (!fs.existsSync(keyFilePath)) {
  console.error(`❌ No se encontró el archivo JSON en: ${keyFilePath}`);
  process.exit(1);
}

// Leemos las credenciales del archivo
const credentials = JSON.parse(fs.readFileSync(keyFilePath, 'utf-8'));

const authClient = new google.auth.JWT({
  email: credentials.client_email,
  key: credentials.private_key,
  scopes: ['https://www.googleapis.com/auth/drive.readonly']
});

/**
 * Retorna un cliente de Google Drive autenticado
 */
async function getDriveClient() {
  try {
    // Pasamos el cliente de autenticación directamente
    return google.drive({ version: 'v3', auth: authClient });
  } catch (error) {
    console.error('❌ Error al crear el cliente de Drive:', error.message);
    throw error;
  }
}

module.exports = { getDriveClient };