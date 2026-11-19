// Backend/src/services/ingest.service.js
// Servicio principal de ingesta de documentos de Google Drive al pipeline RAG.
//
// Flujo por archivo:
//   1. Extrae texto (drive.service).
//   2. Calcula hash SHA-256 del contenido para detectar cambios.
//   3. Si el hash ya coincide con el registrado, salta el archivo (sin cambios).
//   4. Fragmenta el texto (chunker.service).
//   5. Valida y usa los embeddings precomputados proveídos externamente.
//   6. Upsert metadatos del documento en public.documentos_drive.
//   7. Reemplaza los fragmentos en public.documentos_chunks con metadatos JSONB:
//      { nombre_doc, sección, versión, enlace }.
const crypto = require('crypto');
const { getDriveClient } = require('../../config/google-drive');
const { supabase } = require('../../config/supabase');
const { extraerTexto } = require('./drive.service');
const { fragmentarTexto } = require('./chunker.service');
const { validarEmbeddings } = require('./embedding.service');

const CHUNK_BATCH_SIZE = 50;
const MAX_CHARS = 4000;   // 500-1000 tokens aprox.
const OVERLAP = 400;

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv'
]);

function getFolderId() {
  const folderId = process.env.DRIVE_FOLDER_ID?.trim().split('?')[0];
  if (!folderId || !/^[A-Za-z0-9_-]+$/.test(folderId)) {
    throw new Error('DRIVE_FOLDER_ID no contiene un ID de carpeta de Drive válido');
  }
  return folderId;
}

function calcularHash(texto) {
  return crypto.createHash('sha256').update(texto, 'utf8').digest('hex');
}

function detectarSeccion(texto) {
  const lineas = texto.split(/\r?\n/);
  for (const linea of lineas) {
    const t = linea.trim();
    if (!t) continue;
    if (t.length >= 3 && t.length <= 70 && !/[.!?]$/.test(t)) {
      return t;
    }
  }
  return 'General';
}

async function listarArchivosCarpeta(drive, folderId) {
  const files = [];
  let pageToken;

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, webViewLink)',
      pageSize: 100,
      pageToken
    });
    files.push(...(response.data.files || []));
    pageToken = response.data.nextPageToken;
  } while (pageToken);

  return files;
}

async function upsertDocumento(file, hash) {
  const { error } = await supabase
    .from('documentos_drive')
    .upsert(
      {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        webViewLink: file.webViewLink || null,
        hash_contenido: hash
      },
      { onConflict: 'id' }
    );

  if (error) {
    throw new Error(`No se pudo registrar el documento "${file.name}" en documentos_drive: ${error.message}`);
  }
}

async function obtenerHashExistente(fileId) {
  const { data, error } = await supabase
    .from('documentos_drive')
    .select('hash_contenido')
    .eq('id', fileId)
    .maybeSingle();

  if (error) {
    return null;
  }
  return data ? data.hash_contenido : null;
}

async function eliminarChunksAntiguos(fileId) {
  const { error } = await supabase.from('documentos_chunks').delete().eq('file_id', fileId);
  if (error) {
    throw new Error(`No se pudieron eliminar chunks previos del archivo ${fileId}: ${error.message}`);
  }
}
async function guardarChunks(file, chunks, embeddings, hash) {
  const webViewLink = file.webViewLink || null;
  // Versión basada en el contenido: así se detecta fácilmente cuándo se actualizó el documento.
  const version = hash ? hash.substring(0, 12) : '1';

  const rows = chunks.map((content, index) => ({
    file_id: file.id,
    chunk_index: index,
    content,
    embedding: embeddings[index],
    metadata: {
      nombre_doc: file.name,
      sección: detectarSeccion(content),
      versión: version,
      enlace: webViewLink
    }
  }));

  for (let i = 0; i < rows.length; i += CHUNK_BATCH_SIZE) {
    const { error } = await supabase
      .from('documentos_chunks')
      .insert(rows.slice(i, i + CHUNK_BATCH_SIZE));
    if (error) {
      throw new Error(`No se pudieron guardar chunks de "${file.name}": ${error.message}`);
    }
  }

  return rows.length;
}

async function procesarArchivo(drive, file, { obtenerEmbeddings } = {}) {
  const texto = await extraerTexto(file.id, file.mimeType);
  const hash = calcularHash(texto);

  const hashExistente = await obtenerHashExistente(file.id);
  if (hashExistente && hashExistente === hash) {
    return { skipped: true, reason: 'sin cambios', chunks: 0 };
  }

  const chunks = fragmentarTexto(texto, MAX_CHARS, OVERLAP);
  if (chunks.length === 0) {
    await eliminarChunksAntiguos(file.id);
    return { skipped: true, reason: 'sin contenido', chunks: 0 };
  }

  let embeddings;
  if (obtenerEmbeddings) {
    embeddings = validarEmbeddings(await obtenerEmbeddings(chunks));
  } else {
    throw new Error(
      `Se debe proveer obtenerEmbeddings para vectorizar los chunks de "${file.name}"`
    );
  }

  await upsertDocumento(file, hash);
  await eliminarChunksAntiguos(file.id);
  const saved = await guardarChunks(file, chunks, embeddings, hash);

  return { skipped: false, chunks: saved };
}

async function ingestirCarpetaDrive(opts = {}) {
  const { obtenerEmbeddings } = opts;
  const drive = await getDriveClient();
  const files = await listarArchivosCarpeta(drive, getFolderId());

  const report = {
    filesFound: files.length,
    filesProcessed: 0,
    filesSkipped: 0,
    chunksSaved: 0,
    details: []
  };

  for (const file of files) {
    if (!file.id || !SUPPORTED_MIME_TYPES.has(file.mimeType)) {
      report.filesSkipped += 1;
      report.details.push({
        file: file.name || '(sin nombre)',
        status: 'omitido',
        reason: 'tipo no soportado o sin id'
      });
      continue;
    }

    try {
      const result = await procesarArchivo(drive, file, { obtenerEmbeddings });
      if (result.skipped) {
        report.filesSkipped += 1;
        report.details.push({
          file: file.name,
          status: 'omitido',
          reason: result.reason
        });
      } else {
        report.filesProcessed += 1;
        report.chunksSaved += result.chunks;
        report.details.push({ file: file.name, status: 'procesado', chunks: result.chunks });
        console.log(`✅ ${file.name}: ${result.chunks} fragmentos indexados`);
      }
    } catch (error) {
      report.filesSkipped += 1;
      report.details.push({ file: file.name, status: 'error', reason: error.message });
      console.error(`❌ ${file.name}: ${error.message}`);
    }
  }

  return report;
}

module.exports = {
  ingestirCarpetaDrive,
  procesarArchivo,
  calcularHash,
  detectarSeccion,
  listarArchivosCarpeta,
  EMBEDDING_DIMENSIONS: 384
};

