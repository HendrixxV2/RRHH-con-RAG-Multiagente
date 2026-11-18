// Backend/config/google-drive.js
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Buscamos el archivo JSON en la carpeta Backend
const keyFilePath = path.join(__dirname, '..', 'service-account-key.json');

if (!fs.existsSync(keyFilePath)) {
  console.error(`❌ No se encontró el archivo JSON en: ${keyFilePath}`);
  process.exit(1);
}

// Leemos las credenciales del archivo
const credentials = JSON.parse(fs.readFileSync(keyFilePath, 'utf-8'));

// Creamos el cliente de autenticación usando fromJSON
const authClient = google.auth.fromJSON(credentials);

// Le indicamos los scopes necesarios (solo lectura de Drive)
authClient.scopes = ['https://www.googleapis.com/auth/drive.readonly'];

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