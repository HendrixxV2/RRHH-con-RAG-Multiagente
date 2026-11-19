const { getDriveClient } = require('../../config/google-drive');
const { supabase } = require('../../config/supabase');
const { extraerTexto } = require('./drive.service');
const { fragmentarTexto } = require('./chunker.service');
const { generarEmbeddings } = require('./embedding.service');

const CHUNK_BATCH_SIZE = 50;
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

async function listFolderFiles(drive, folderId) {
  const files = [];
  let pageToken;

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 100,
      pageToken
    });
    files.push(...(response.data.files || []));
    pageToken = response.data.nextPageToken;
  } while (pageToken);

  return files;
}

async function saveChunks(file, chunks, embeddings) {
  const rows = chunks.map((content, index) => ({
    file_id: file.id,
    file_name: file.name,
    mime_type: file.mimeType,
    chunk_index: index,
    content,
    embedding: embeddings[index]
  }));

  for (let i = 0; i < rows.length; i += CHUNK_BATCH_SIZE) {
    const { error } = await supabase
      .from('document_chunks')
      .upsert(rows.slice(i, i + CHUNK_BATCH_SIZE), { onConflict: 'file_id,chunk_index' });
    if (error) throw new Error(`No se pudieron guardar fragmentos de "${file.name}": ${error.message}`);
  }

  const { error } = await supabase
    .from('document_chunks')
    .delete()
    .eq('file_id', file.id)
    .gte('chunk_index', chunks.length);
  if (error) throw new Error(`No se pudieron limpiar fragmentos antiguos de "${file.name}": ${error.message}`);
}

async function ingestirCarpetaDrive() {
  const drive = await getDriveClient();
  const files = await listFolderFiles(drive, getFolderId());
  const report = { filesFound: files.length, filesProcessed: 0, filesSkipped: 0, chunksSaved: 0 };

  for (const file of files) {
    if (!file.id || !SUPPORTED_MIME_TYPES.has(file.mimeType)) {
      report.filesSkipped += 1;
      continue;
    }

    const text = await extraerTexto(file.id, file.mimeType);
    const chunks = fragmentarTexto(text);
    if (chunks.length === 0) {
      const { error } = await supabase.from('document_chunks').delete().eq('file_id', file.id);
      if (error) throw new Error(`No se pudieron limpiar fragmentos de "${file.name}": ${error.message}`);
      report.filesSkipped += 1;
      continue;
    }

    const embeddings = await generarEmbeddings(chunks);
    await saveChunks(file, chunks, embeddings);
    report.filesProcessed += 1;
    report.chunksSaved += chunks.length;
    console.log(`✅ ${file.name}: ${chunks.length} fragmentos indexados`);
  }

  return report;
}

module.exports = { ingestirCarpetaDrive };
