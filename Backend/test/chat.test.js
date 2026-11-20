const test = require('node:test');
const assert = require('node:assert/strict');
const {
  filtrarCoincidenciasConfiables,
  LOW_SIMILARITY_THRESHOLD
} = require('../src/services/chat.service');

test('el filtro RAG conserva el umbral mínimo y descarta coincidencias no confiables', () => {
  const matches = [
    { file_id: 'accepted', similarity: LOW_SIMILARITY_THRESHOLD },
    { file_id: 'rejected', similarity: LOW_SIMILARITY_THRESHOLD - 0.001 },
    { file_id: 'invalid', similarity: null }
  ];

  assert.deepEqual(filtrarCoincidenciasConfiables(matches), [matches[0]]);
});
