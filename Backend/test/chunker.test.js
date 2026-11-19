const test = require('node:test');
const assert = require('node:assert/strict');
const { fragmentarTexto } = require('../src/services/chunker.service');

test('fragmentarTexto respects chunk limits and keeps overlap', () => {
  const chunks = fragmentarTexto('abcdefghijklmnopqrst', 8, 2);

  assert.deepEqual(chunks, ['abcdefgh', 'ghijklmn', 'mnopqrst']);
  assert.ok(chunks.every(chunk => chunk.length <= 8));
});

test('fragmentarTexto rejects overlap that prevents forward progress', () => {
  assert.throws(() => fragmentarTexto('texto', 8, 8), RangeError);
});

test('fragmentarTexto returns no chunks for empty input', () => {
  assert.deepEqual(fragmentarTexto(' \n '), []);
});
