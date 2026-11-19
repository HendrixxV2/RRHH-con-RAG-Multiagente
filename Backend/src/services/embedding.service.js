// Backend/src/services/embedding.service.js
// Utilidad para trabajar con embeddings precomputados.
// Este proyecto usa el modelo multilingüe local Xenova. Este servicio valida
// los vectores y conserva una interfaz única para ingesta y búsqueda.
const EMBEDDING_DIMENSIONS = 384;

/**
 * Valida que un arreglo de vectores tenga el formato esperado por la tabla
 * documentos_chunks (embedding vector(384)).
 * @param {number[][]} vectores - Embeddings precomputados.
 * @returns {number[][]} Los mismos vectores si son válidos.
 */
function validarEmbeddings(vectores) {
  if (!Array.isArray(vectores) || vectores.length === 0) {
    throw new TypeError('Se requiere un arreglo no vacío de embeddings');
  }

  for (const vector of vectores) {
    if (!Array.isArray(vector)) {
      throw new TypeError('Cada embedding debe ser un arreglo de números');
    }
    if (vector.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Cada embedding debe tener exactamente ${EMBEDDING_DIMENSIONS} dimensiones, recibió ${vector.length}`
      );
    }
    if (vector.some(n => typeof n !== 'number' || !Number.isFinite(n))) {
      throw new TypeError('Cada embedding debe contener únicamente números finitos');
    }
  }

  return vectores;
}

/**
 * Genera embeddings (NO OPERATIVO).
 * Este proyecto ya no depende de la API de Gemini. Los embeddings deben ser
 * precomputados y validados con `validarEmbeddings`. Se conserva esta exportación
 * solo para evitar errores de importación en otros módulos; al invocarla lanza
 * un error informativo.
 */
async function generarEmbeddings(textos) {
  const { obtenerEmbeddings } = require('./embedding-provider');
  const vectores = await obtenerEmbeddings(textos);
  return validarEmbeddings(vectores);
}

module.exports = {
  validarEmbeddings,
  generarEmbeddings,
  EMBEDDING_DIMENSIONS
};