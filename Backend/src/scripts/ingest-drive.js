require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '..', '.env') });
const { ingestirCarpetaDrive } = require('../services/ingest.service');
const { obtenerEmbeddings } = require('../services/embedding-provider');

async function main() {
  console.log('🔄 Indexando documentos de Google Drive...');
  const report = await ingestirCarpetaDrive({ obtenerEmbeddings });
  console.log('✅ Indexación completada:', report);
}

main().catch(error => {
  console.error('❌ Falló la indexación:', error.message);
  process.exitCode = 1;
});
