// Backend/src/services/chunker.service.js
/**
 * Divide un texto en fragmentos con solapamiento.
 * @param {string} texto - Texto completo
 * @param {number} maxChars - Tamaño aprox. por fragmento (~4 caracteres por token)
 * @param {number} overlap - Caracteres de solapamiento
 */
function fragmentarTexto(texto, maxChars = 2500, overlap = 250) {
  if (!texto) return [];
  
  const parrafos = texto.split(/\n\s*\n/);
  const chunks = [];
  let chunkActual = '';

  for (const parrafo of parrafos) {
    if ((chunkActual + parrafo).length <= maxChars) {
      chunkActual += parrafo + '\n\n';
    } else {
      if (chunkActual.trim()) chunks.push(chunkActual.trim());
      
      // Si el párrafo es más grande que el límite, lo cortamos forzosamente
      if (parrafo.length > maxChars) {
        for (let i = 0; i < parrafo.length; i += (maxChars - overlap)) {
          chunks.push(parrafo.slice(i, i + maxChars));
        }
        chunkActual = '';
      } else {
        // Aplicamos solapamiento tomando el final del chunk anterior
        const inicioOverlap = Math.max(0, chunkActual.length - overlap);
        chunkActual = chunkActual.slice(inicioOverlap) + parrafo + '\n\n';
      }
    }
  }
  if (chunkActual.trim()) chunks.push(chunkActual.trim());
  
  return chunks;
}

module.exports = { fragmentarTexto };