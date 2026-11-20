const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ingestirCarpetaDrive,
  obtenerCambios,
  obtenerMetadatos,
  tokenExpirado
} = require('../src/services/ingest.service');

function createStorage(initialState = null, initialDocuments = []) {
  let state = initialState;
  const documents = new Map(initialDocuments.map(document => [document.id, document]));
  const chunks = new Map();

  function query(table) {
    let operation = 'select';
    let values;
    const filters = {};
    const builder = {
      select(columns) {
        builder.columns = columns;
        return builder;
      },
      eq(column, value) {
        filters[column] = value;
        return builder;
      },
      delete() {
        operation = 'delete';
        return builder;
      },
      upsert(row) {
        operation = 'upsert';
        values = row;
        return builder;
      },
      async maybeSingle() {
        const result = await builder.execute();
        return { data: result.data?.[0] || result.data || null, error: null };
      },
      async execute() {
        if (table === 'drive_sync_state') {
          if (operation === 'upsert') state = values;
          return { data: state, error: null };
        }

        if (operation === 'delete') {
          const ids = [...documents.values()]
            .filter(row => Object.entries(filters).every(([key, value]) => row[key] === value))
            .map(row => row.id);
          for (const id of ids) {
            documents.delete(id);
            chunks.delete(id);
          }
          return { data: null, error: null };
        }
        if (operation === 'upsert') {
          documents.set(values.id, values);
          return { data: values, error: null };
        }
        const rows = [...documents.values()].filter(row =>
          Object.entries(filters).every(([key, value]) => row[key] === value)
        );
        return { data: rows, error: null };
      },
      then(resolve, reject) {
        return builder.execute().then(resolve, reject);
      }
    };
    return builder;
  }

  return {
    documents,
    chunks,
    get state() {
      return state;
    },
    from: query,
    async rpc(name, args) {
      assert.equal(name, 'replace_document_chunks');
      documents.set(args.p_file_id, {
        id: args.p_file_id,
        name: args.p_file_name,
        mimetype: args.p_mime_type,
        webviewlink: args.p_web_view_link,
        hash_contenido: args.p_hash,
        folder_id: args.p_folder_id
      });
      chunks.set(args.p_file_id, args.p_chunks);
      return { data: args.p_chunks.length, error: null };
    }
  };
}

function createDrive({ files = [], changes = [], startPageToken = 'start-token' } = {}) {
  const calls = [];
  return {
    calls,
    files: {
      async list() {
        calls.push('files.list');
        return { data: { files } };
      },
      async get({ fileId }) {
        calls.push(`files.get:${fileId}`);
        const file = files.find(item => item.id === fileId);
        return { data: file };
      }
    },
    changes: {
      async getStartPageToken() {
        calls.push('getStartPageToken');
        return { data: { startPageToken } };
      },
      async list(params) {
        calls.push(`changes.list:${params.pageToken}`);
        return { data: { changes, newStartPageToken: 'next-token' } };
      }
    }
  };
}

const file = {
  id: 'drive-file-1',
  name: 'Vacaciones.pdf',
  mimeType: 'application/pdf',
  parents: ['policies-folder'],
  webViewLink: 'https://drive.google.com/file/d/drive-file-1/view'
};
const documentText = [
  '**Título:** Política de Vacaciones',
  '**Versión:** 1.2',
  '**Vigencia:** 2026-01-01',
  '**Responsable:** Recursos Humanos',
  '**Empresa:** Nexo Verde S.A.',
  '**País:** Costa Rica',
  '**Estado:** Borrador académico',
  '## Solicitud y disfrute',
  'La política describe el procedimiento interno para solicitar vacaciones.'
].join('\n');

test('la sincronización inicial guarda fragmentos con metadatos y cursor de cambios', async () => {
  const storage = createStorage();
  const drive = createDrive({ files: [file] });
  const report = await ingestirCarpetaDrive({
    drive,
    storage,
    folderId: 'policies-folder',
    extraerTextoArchivo: async () => documentText,
    obtenerEmbeddings: async chunks => chunks.map(() => Array(384).fill(0.25))
  });

  assert.deepEqual(drive.calls.slice(0, 2), ['getStartPageToken', 'files.list']);
  assert.equal(report.filesProcessed, 1);
  assert.equal(storage.state.page_token, 'start-token');
  assert.equal(storage.documents.get(file.id).folder_id, 'policies-folder');
  assert.equal(storage.chunks.get(file.id)[0].metadata.versión, '1.2');
  assert.equal(storage.chunks.get(file.id)[0].metadata.vigencia, '2026-01-01');
  assert.equal(storage.chunks.get(file.id)[0].metadata.responsable, 'Recursos Humanos');
  assert.equal(storage.chunks.get(file.id)[0].metadata.enlace, file.webViewLink);
  assert.equal(storage.chunks.get(file.id)[0].metadata.sección, 'Solicitud y disfrute');
});

test('la sincronización incremental actualiza cambios, elimina archivos movidos y avanza el cursor', async () => {
  const existing = {
    id: 'moved-file',
    name: 'Antigua.pdf',
    mimetype: 'application/pdf',
    webviewlink: null,
    hash_contenido: 'old-hash',
    folder_id: 'policies-folder'
  };
  const storage = createStorage(
    { id: 'google-drive-policy-folder', folder_id: 'policies-folder', page_token: 'old-token' },
    [existing]
  );
  const updatedFile = { ...file, name: 'Actualizada.pdf' };
  const drive = createDrive({
    files: [updatedFile],
    changes: [
      { fileId: updatedFile.id, file: updatedFile },
      { fileId: existing.id, file: { ...file, id: existing.id, parents: ['another-folder'] } }
    ]
  });

  const report = await ingestirCarpetaDrive({
    drive,
    storage,
    folderId: 'policies-folder',
    extraerTextoArchivo: async () => documentText,
    obtenerEmbeddings: async chunks => chunks.map(() => Array(384).fill(0.25))
  });

  assert.ok(drive.calls.includes('changes.list:old-token'));
  assert.equal(storage.documents.has(existing.id), false);
  assert.equal(storage.documents.get(updatedFile.id).name, 'Actualizada.pdf');
  assert.equal(storage.state.page_token, 'next-token');
  assert.equal(report.filesProcessed, 1);
  assert.equal(report.filesSkipped, 1);
});

test('no avanza el cursor si falla el procesamiento de un archivo cambiado', async () => {
  const storage = createStorage(
    { id: 'google-drive-policy-folder', folder_id: 'policies-folder', page_token: 'old-token' }
  );
  const drive = createDrive({ changes: [{ fileId: file.id, file }] });

  await assert.rejects(
    ingestirCarpetaDrive({
      drive,
      storage,
      folderId: 'policies-folder',
      extraerTextoArchivo: async () => {
        throw new Error('Fallo de extracción');
      }
    }),
    /Fallo de extracción/
  );
  assert.equal(storage.state.page_token, 'old-token');
});

test('recupera un cursor expirado mediante una sincronización completa', async () => {
  const storage = createStorage(
    { id: 'google-drive-policy-folder', folder_id: 'policies-folder', page_token: 'expired-token' }
  );
  const drive = createDrive({ files: [file] });
  drive.changes.list = async () => {
    const error = new Error('Page token expired');
    error.code = 410;
    throw error;
  };

  const report = await ingestirCarpetaDrive({
    drive,
    storage,
    folderId: 'policies-folder',
    extraerTextoArchivo: async () => documentText,
    obtenerEmbeddings: async chunks => chunks.map(() => Array(384).fill(0.25))
  });

  assert.equal(report.filesProcessed, 1);
  assert.equal(storage.state.page_token, 'start-token');
  assert.equal(tokenExpirado({ response: { status: 410 } }), true);
});

test('extrae título, versión y sección para las citas', () => {
  assert.deepEqual(
    obtenerMetadatos(documentText, file, 'abcdef0123456789'),
    {
      nombre_doc: 'Política de Vacaciones',
      sección: 'Solicitud y disfrute',
      versión: '1.2',
      vigencia: '2026-01-01',
      responsable: 'Recursos Humanos',
      empresa: 'Nexo Verde S.A.',
      país: 'Costa Rica',
      estado: 'Borrador académico',
      enlace: file.webViewLink
    }
  );
});

test('recorre todas las páginas de cambios antes de avanzar el cursor', async () => {
  const pageTokens = [];
  const drive = {
    changes: {
      async list({ pageToken }) {
        pageTokens.push(pageToken);
        if (pageToken === 'page-1') {
          return {
            data: {
              changes: [{ fileId: 'file-1' }],
              nextPageToken: 'page-2'
            }
          };
        }
        return {
          data: {
            changes: [{ fileId: 'file-2' }],
            newStartPageToken: 'page-3'
          }
        };
      }
    }
  };

  const result = await obtenerCambios(drive, 'page-1');
  assert.deepEqual(pageTokens, ['page-1', 'page-2']);
  assert.deepEqual(result.changes.map(change => change.fileId), ['file-1', 'file-2']);
  assert.equal(result.newStartPageToken, 'page-3');
});
