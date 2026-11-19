require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '..', '.env') });
const { ingestirCarpetaDrive } = require('../services/drive-ingestion.service');

async function main() {
  console.log('🔄 Indexando documentos de Google Drive...');
  const report = await ingestirCarpetaDrive();
  console.log('✅ Indexación completada:', report);
}

main().catch(error => {
  console.error('❌ Falló la indexación:', error.message);
  process.exitCode = 1;
});
