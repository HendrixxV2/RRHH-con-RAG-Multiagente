// Backend/src/scripts/test-drive.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });
const { getDriveClient } = require('../../config/google-drive');

async function testConnection() {
  console.log('🔄 Probando conexión con Google Drive...');
  
  try {
    const drive = await getDriveClient();
    
    // Intentamos listar los archivos dentro de la carpeta configurada en el .env
    const folderId = process.env.DRIVE_FOLDER_ID?.trim().split('?')[0];
    
    if (!folderId) {
      console.warn('⚠️ No has configurado DRIVE_FOLDER_ID en el .env. Listando todos los archivos accesibles...');
      const res = await drive.files.list({ pageSize: 5, fields: 'files(id, name, mimeType)' });
      console.log('✅ Archivos encontrados (primeros 5):', res.data.files);
    } else {
      const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType, webViewLink)',
        pageSize: 10
      });
      console.log(`✅ Conexión exitosa. Archivos en la carpeta (${res.data.files.length}):`);
      console.table(res.data.files.map(f => ({ Nombre: f.name, Tipo: f.mimeType })));
    }
  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
    process.exitCode = 1;
  }
}

testConnection();