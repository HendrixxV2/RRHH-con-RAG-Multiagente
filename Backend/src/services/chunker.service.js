// Backend/src/services/chunker.service.js
/**
 * Divide un texto en fragmentos con solapamiento.
 * @param {string} texto - Texto completo
 * @param {number} maxChars - Tamaño aprox. por fragmento (~4 caracteres por token)
 * @param {number} overlap - Caracteres de solapamiento
 */
function fragmentarTexto(texto, maxChars = 2500, overlap = 250) {
  if (typeof texto !== 'string') {
    throw new TypeError('El texto debe ser una cadena');
  }
  if (!Number.isInteger(maxChars) || maxChars <= 0) {
    throw new RangeError('maxChars debe ser un entero positivo');
  }
  if (!Number.isInteger(overlap) || overlap < 0 || overlap >= maxChars) {
    throw new RangeError('overlap debe ser un entero entre 0 y maxChars - 1');
  }

  const contenido = texto.trim();
  if (!contenido) return [];

  const chunks = [];
  let inicio = 0;

  while (inicio < contenido.length) {
    let fin = Math.min(inicio + maxChars, contenido.length);
    if (fin < contenido.length) {
      const limiteParrafo = contenido.lastIndexOf('\n\n', fin);
      if (limiteParrafo > inicio + maxChars / 2) {
        fin = limiteParrafo;
      }
    }

    const chunk = contenido.slice(inicio, fin).trim();
    if (chunk) chunks.push(chunk);
    if (fin >= contenido.length) break;

    inicio = Math.max(inicio + 1, fin - overlap);
  }

  return chunks;
}

module.exports = { fragmentarTexto };