// Backend/src/scripts/test-extraction.js
const { extraerTexto } = require('../services/drive.service');

// 👇 AQUÍ VA EL ID DE TU ARCHIVO (no la URL completa)
const FILE_ID_PRUEBA = '1Gav-Ruor66u4dg5Q3ggQoNjc91Bde0hy'; 
const MIME_TYPE_PRUEBA = 'application/pdf'; // Asumimos que es un PDF para la prueba. Si es un Doc, cambia esto.

async function probarExtraccion() {
  console.log('🔄 Iniciando prueba de extracción directa...');
  
  try {
    console.log(`📄 Buscando archivo con ID: ${FILE_ID_PRUEBA}`);
    console.log('⏳ Extrayendo texto...');

    // Llamamos a nuestro servicio pasándole el ID y el tipo MIME
    const texto = await extraerTexto(FILE_ID_PRUEBA, MIME_TYPE_PRUEBA);

    console.log('\n✅ ¡Extracción exitosa!');
    console.log('--- PRIMEROS 500 CARACTERES ---');
    console.log(texto.substring(0, 500) + '...\n');
    console.log(`📊 Total de caracteres extraídos: ${texto.length}`);

  } catch (error) {
    console.error('❌ Falló la prueba de extracción:', error.message);
  }
}

probarExtraccion();