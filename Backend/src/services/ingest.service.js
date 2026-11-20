const crypto = require('crypto');
const { getDriveClient } = require('../../config/google-drive');
const { supabase } = require('../../config/supabase');
const { extraerTexto } = require('./drive.service');
const { fragmentarTexto } = require('./chunker.service');
const { validarEmbeddings } = require('./embedding.service');

const MAX_CHARS = 4000;
const OVERLAP = 400;
const SYNC_STATE_ID = 'google-drive-policy-folder';
const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv'
]);

function generarEmbeddings(textos) {
  return require('./embedding-provider').obtenerEmbeddings(textos);
}

function getFolderId(configuredId = process.env.DRIVE_FOLDER_ID) {
  const folderId = configuredId?.trim().split('?')[0];
  if (!folderId || !/^[A-Za-z0-9_-]+$/.test(folderId)) {
    throw new Error('DRIVE_FOLDER_ID no contiene un ID de carpeta de Drive válido');
  }
  return folderId;
}

function calcularHash(texto) {
  return crypto.createHash('sha256').update(texto, 'utf8').digest('hex');
}

function obtenerCampo(texto, etiquetas) {
  const etiqueta = etiquetas.join('|');
  const match = texto.match(new RegExp(`^\\s*(?:\\*\\*)?(?:${etiqueta})\\s*:(?:\\*\\*)?\\s*(.+?)\\s*$`, 'im'));
  return match?.[1]?.trim() || null;
}

function detectarSeccion(texto) {
  const lineas = texto.split(/\r?\n/);
  const metadataLine = /^\s*(?:\*\*)?(?:t[ií]tulo|versi[oó]n|vigencia|fecha de vigencia|responsable|empresa|pa[ií]s|sector|estado)\s*:(?:\*\*)?/i;
  const subheading = lineas.find(linea => /^\s*#{2,6}\s+/.test(linea));
  if (subheading) return subheading.trim().replace(/^#{2,6}\s+/, '').trim();

  const heading = lineas.find(linea => /^\s*#\s+/.test(linea));
  if (heading) return heading.trim().replace(/^#\s+/, '').trim();

  for (const linea of lineas) {
    const titulo = linea.trim().replace(/^#{1,6}\s*/, '');
    if (
      titulo &&
      titulo.length <= 100 &&
      !metadataLine.test(titulo) &&
      (linea.trim().startsWith('#') || (!/[.!?]$/.test(titulo) && titulo.length <= 70))
    ) {
      return titulo;
    }
  }
  return 'General';
}

function obtenerMetadatos(texto, file, hash) {
  return {
    nombre_doc: obtenerCampo(texto, ['t[ií]tulo']) || file.name,
    sección: detectarSeccion(texto),
    versión: obtenerCampo(texto, ['versi[oó]n']) || hash.slice(0, 12),
    vigencia: obtenerCampo(texto, ['vigencia', 'fecha de vigencia']),
    responsable: obtenerCampo(texto, ['responsable']),
    empresa: obtenerCampo(texto, ['empresa']),
    país: obtenerCampo(texto, ['pa[ií]s']),
    estado: obtenerCampo(texto, ['estado']),
    enlace: file.webViewLink || null
  };
}

async function listarArchivosCarpeta(drive, folderId) {
  const files = [];
  let pageToken;

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, parents, webViewLink, modifiedTime)',
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    files.push(...(response.data.files || []));
    pageToken = response.data.nextPageToken;
  } while (pageToken);

  return files;
}

async function obtenerDocumentoExistente(storage, fileId) {
  const { data, error } = await storage
    .from('documentos_drive')
    .select('name,mimetype,webviewlink,hash_contenido,folder_id')
    .eq('id', fileId)
    .maybeSingle();

  if (error) throw new Error(`No se pudo consultar el documento ${fileId}: ${error.message}`);
  return data;
}

async function eliminarDocumento(storage, fileId) {
  const { error } = await storage.from('documentos_drive').delete().eq('id', fileId);
  if (error) throw new Error(`No se pudo eliminar el documento ${fileId}: ${error.message}`);
}

async function eliminarDocumentosDeCarpeta(storage, folderId) {
  const { error } = await storage.from('documentos_drive').delete().eq('folder_id', folderId);
  if (error) throw new Error(`No se pudo limpiar la carpeta indexada ${folderId}: ${error.message}`);
}

async function guardarDocumentoYChunks(storage, file, folderId, hash, chunks, embeddings, text) {
  const metadata = obtenerMetadatos(text, file, hash);
  const rows = chunks.map((content, index) => ({
    chunk_index: index,
    content,
    embedding: embeddings[index],
    metadata
  }));
  const { error } = await storage.rpc('replace_document_chunks', {
    p_file_id: file.id,
    p_folder_id: folderId,
    p_file_name: file.name,
    p_mime_type: file.mimeType,
    p_web_view_link: file.webViewLink || null,
    p_hash: hash,
    p_chunks: rows
  });

  if (error) {
    throw new Error(`No se pudo guardar "${file.name}" en la base vectorial: ${error.message}`);
  }
  return rows.length;
}

async function procesarArchivo(drive, file, options = {}) {
  const {
    obtenerEmbeddings = generarEmbeddings,
    storage = supabase,
    folderId = getFolderId(),
    extraerTextoArchivo = extraerTexto
  } = options;

  if (!file.id || !SUPPORTED_MIME_TYPES.has(file.mimeType)) {
    if (file.id) await eliminarDocumento(storage, file.id);
    return { skipped: true, reason: 'tipo no soportado o sin id', chunks: 0 };
  }

  const texto = await extraerTextoArchivo(file.id, file.mimeType);
  const hash = calcularHash(texto);
  const existing = await obtenerDocumentoExistente(storage, file.id);
  const metadataChanged = existing && (
    existing.name !== file.name ||
    existing.mimetype !== file.mimeType ||
    existing.webviewlink !== (file.webViewLink || null) ||
    existing.folder_id !== folderId
  );
  if (existing?.hash_contenido === hash && !metadataChanged) {
    return { skipped: true, reason: 'sin cambios', chunks: 0 };
  }

  const chunks = fragmentarTexto(texto, MAX_CHARS, OVERLAP);
  if (chunks.length === 0) {
    await guardarDocumentoYChunks(storage, file, folderId, hash, [], [], texto);
    return { skipped: true, reason: 'sin contenido', chunks: 0 };
  }

  const embeddings = validarEmbeddings(await obtenerEmbeddings(chunks));
  if (embeddings.length !== chunks.length) {
    throw new Error(`El número de embeddings no coincide con los fragmentos de "${file.name}"`);
  }

  const saved = await guardarDocumentoYChunks(
    storage,
    file,
    folderId,
    hash,
    chunks,
    embeddings,
    texto
  );
  return { skipped: false, chunks: saved };
}

async function leerEstadoSincronizacion(storage) {
  const { data, error } = await storage
    .from('drive_sync_state')
    .select('folder_id,page_token')
    .eq('id', SYNC_STATE_ID)
    .maybeSingle();

  if (error) throw new Error(`No se pudo leer el estado de sincronización de Drive: ${error.message}`);
  return data;
}

async function guardarEstadoSincronizacion(storage, folderId, pageToken) {
  const { error } = await storage.from('drive_sync_state').upsert({
    id: SYNC_STATE_ID,
    folder_id: folderId,
    page_token: pageToken
  }, { onConflict: 'id' });

  if (error) throw new Error(`No se pudo guardar el cursor de Drive: ${error.message}`);
}

async function obtenerTokenInicial(drive) {
  const { data } = await drive.changes.getStartPageToken({ supportsAllDrives: true });
  if (!data.startPageToken) throw new Error('Drive no devolvió un token inicial de cambios');
  return data.startPageToken;
}

async function obtenerCambios(drive, pageToken) {
  const changes = [];
  let nextPageToken = pageToken;
  let newStartPageToken;

  do {
    const { data } = await drive.changes.list({
      pageToken: nextPageToken,
      spaces: 'drive',
      fields: 'nextPageToken,newStartPageToken,changes(fileId,removed,file(id,name,mimeType,parents,trashed,webViewLink,modifiedTime))',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    changes.push(...(data.changes || []));
    nextPageToken = data.nextPageToken;
    newStartPageToken = data.newStartPageToken || newStartPageToken;
  } while (nextPageToken);

  if (!newStartPageToken) throw new Error('Drive no devolvió un nuevo token de cambios');
  return { changes, newStartPageToken };
}

function tokenExpirado(error) {
  return error?.code === 410 || error?.response?.status === 410;
}

async function reconciliarCarpeta(storage, folderId, files) {
  const { data, error } = await storage
    .from('documentos_drive')
    .select('id')
    .eq('folder_id', folderId);

  if (error) throw new Error(`No se pudieron consultar documentos indexados: ${error.message}`);
  const currentIds = new Set(
    files
      .filter(file => file.id && SUPPORTED_MIME_TYPES.has(file.mimeType))
      .map(file => file.id)
  );
  for (const row of data || []) {
    if (!currentIds.has(row.id)) await eliminarDocumento(storage, row.id);
  }
}

function crearReporte(filesFound = 0) {
  return { filesFound, filesProcessed: 0, filesSkipped: 0, chunksSaved: 0 };
}

async function procesarArchivoYActualizarReporte(drive, storage, folderId, file, options, report) {
  const result = await procesarArchivo(drive, file, {
    ...options,
    storage,
    folderId
  });
  if (result.skipped) {
    report.filesSkipped += 1;
  } else {
    report.filesProcessed += 1;
    report.chunksSaved += result.chunks;
  }
}

async function sincronizacionCompleta(drive, storage, folderId, options) {
  const initialPageToken = await obtenerTokenInicial(drive);
  const files = await listarArchivosCarpeta(drive, folderId);
  const report = crearReporte(files.length);

  for (const file of files) {
    await procesarArchivoYActualizarReporte(drive, storage, folderId, file, options, report);
  }
  await reconciliarCarpeta(storage, folderId, files);
  await guardarEstadoSincronizacion(storage, folderId, initialPageToken);
  return report;
}

async function procesarCambio(drive, storage, folderId, change, options, report) {
  const fileId = change.fileId || change.file?.id;
  if (!fileId) return;

  if (change.removed) {
    await eliminarDocumento(storage, fileId);
    report.filesSkipped += 1;
    return;
  }

  let file = change.file;
  if (!file?.id || !file.parents) {
    const { data } = await drive.files.get({
      fileId,
      fields: 'id,name,mimeType,parents,trashed,webViewLink,modifiedTime',
      supportsAllDrives: true
    });
    file = data;
  }

  if (file.trashed || !file.parents?.includes(folderId)) {
    await eliminarDocumento(storage, fileId);
    report.filesSkipped += 1;
    return;
  }

  await procesarArchivoYActualizarReporte(drive, storage, folderId, file, options, report);
}

async function sincronizarCambios(drive, storage, folderId, state, options) {
  const { changes, newStartPageToken } = await obtenerCambios(drive, state.page_token);
  const report = crearReporte(changes.length);
  const latestByFile = new Map();
  for (const change of changes) {
    const fileId = change.fileId || change.file?.id;
    if (fileId) latestByFile.set(fileId, change);
  }

  for (const change of latestByFile.values()) {
    await procesarCambio(drive, storage, folderId, change, options, report);
  }
  await guardarEstadoSincronizacion(storage, folderId, newStartPageToken);
  return report;
}

async function ingestirCarpetaDrive(options = {}) {
  const drive = options.drive || await getDriveClient();
  const storage = options.storage || supabase;
  const folderId = getFolderId(options.folderId);
  const processingOptions = {
    obtenerEmbeddings: options.obtenerEmbeddings || generarEmbeddings,
    extraerTextoArchivo: options.extraerTextoArchivo || extraerTexto
  };
  const state = await leerEstadoSincronizacion(storage);

  if (!state || state.folder_id !== folderId) {
    if (state?.folder_id) await eliminarDocumentosDeCarpeta(storage, state.folder_id);
    return sincronizacionCompleta(drive, storage, folderId, processingOptions);
  }

  try {
    return await sincronizarCambios(drive, storage, folderId, state, processingOptions);
  } catch (error) {
    if (!tokenExpirado(error)) throw error;
    return sincronizacionCompleta(drive, storage, folderId, processingOptions);
  }
}

module.exports = {
  ingestirCarpetaDrive,
  procesarArchivo,
  calcularHash,
  detectarSeccion,
  obtenerMetadatos,
  listarArchivosCarpeta,
  obtenerCambios,
  tokenExpirado,
  EMBEDDING_DIMENSIONS: 384
};
