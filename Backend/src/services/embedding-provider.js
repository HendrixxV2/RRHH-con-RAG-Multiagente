const { pipeline } = require('@huggingface/transformers');

const MODEL_NAME = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
let extractorPromise;

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', MODEL_NAME, {
      pooling: 'mean',
      normalize: true
    });
  }
  return extractorPromise;
}

function vectorFromOutput(output) {
  const value = typeof output.tolist === 'function' ? output.tolist() : output;
  if (!Array.isArray(value) || value.length === 0) return null;

  if (typeof value[0] === 'number') return value;
  if (Array.isArray(value[0]) && typeof value[0][0] === 'number') return value[0];
  if (
    Array.isArray(value[0]) &&
    Array.isArray(value[0][0]) &&
    typeof value[0][0][0] === 'number'
  ) {
    const tokens = value[0];
    const dimensions = tokens[0].length;
    return Array.from({ length: dimensions }, (_, dimension) =>
      tokens.reduce((sum, token) => sum + token[dimension], 0) / tokens.length
    );
  }
  return null;
}

async function obtenerEmbeddings(chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new TypeError('obtenerEmbeddings requiere un arreglo no vacío de chunks');
  }
  if (chunks.some(chunk => typeof chunk !== 'string' || !chunk.trim())) {
    throw new TypeError('Todos los chunks deben ser texto no vacío');
  }

  const extractor = await getExtractor();
  const vectors = [];

  for (const chunk of chunks) {
    const output = await extractor(chunk, { pooling: 'mean', normalize: true });
    const vector = vectorFromOutput(output);
    if (!vector || vector.length !== 384) {
      throw new Error(`El proveedor generó un embedding de dimensión inválida (${vector?.length || 0})`);
    }
    vectors.push(vector);
  }

  return vectors;
}

module.exports = { obtenerEmbeddings, MODEL_NAME };
