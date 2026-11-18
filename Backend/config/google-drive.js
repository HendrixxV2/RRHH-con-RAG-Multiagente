// Backend/config/google-drive.js
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Resolvemos la ruta absoluta del archivo JSON
const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ? path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS)
  : path.join(__dirname, '..', 'service-account-key.json');

// Verificamos que el archivo exista antes de intentar leerlo
if (!fs.existsSync(keyFilePath)) {
  console.error(`\n❌ ERROR: No se encontró el archivo de credenciales en la ruta:`);
  console.error(`👉 ${keyFilePath}`);
  console.error(`\nAsegúrate de que el archivo JSON descargado de Google Cloud esté en esa ubicación y se llame 'service-account-key.json'.\n`);
  process.exit(1); // Detenemos la ejecución para evitar errores confusos
}

// Leemos el contenido del JSON y lo parseamos
const credentials = JSON.parse(fs.readFileSync(keyFilePath, 'utf-8'));

// Creamos el cliente de autenticación usando el objeto de credenciales (método no deprecado)
const auth = new google.auth.GoogleAuth({
  credentials: credentials,
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
});

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