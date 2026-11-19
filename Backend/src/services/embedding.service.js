const { pipeline } = require('@huggingface/transformers');

const MODEL_ID = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const EMBEDDING_DIMENSIONS = 384;
const BATCH_SIZE = 16;
let extractorPromise;

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', MODEL_ID, { dtype: 'q8' })
      .catch(error => {
        extractorPromise = undefined;
        throw error;
      });
  }
  return extractorPromise;
}

async function generarEmbeddings(textos) {
  if (!Array.isArray(textos) || textos.some(texto => typeof texto !== 'string' || !texto.trim())) {
    throw new TypeError('Se requiere una lista de textos no vacíos');
  }

  const extractor = await getExtractor();
  const embeddings = [];

  for (let i = 0; i < textos.length; i += BATCH_SIZE) {
    const lote = textos.slice(i, i + BATCH_SIZE);
    const resultado = await extractor(lote, { pooling: 'mean', normalize: true });
    const vectores = resultado.tolist();

    if (!Array.isArray(vectores) || vectores.length !== lote.length) {
      throw new Error('El modelo devolvió una cantidad inesperada de embeddings');
    }

    for (const vector of vectores) {
      if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(`El modelo debe generar vectores de ${EMBEDDING_DIMENSIONS} dimensiones`);
      }
      embeddings.push(vector);
    }
  }

  return embeddings;
}

module.exports = { generarEmbeddings, EMBEDDING_DIMENSIONS };