# Backend RAG

## Preparación

1. Configura las variables de `Backend/.env` usando `.env.example` como referencia y coloca la cuenta de servicio de Drive en `service-account-key.json`.
2. Ejecuta en orden las migraciones SQL de `Backend/supabase/migrations/` en el SQL Editor de Supabase. Incluyen el índice vectorial RAG y las siete tablas operativas con datos simulados.
3. Desde `Backend`, ejecuta `npm run ingest:drive`. El proceso descarga los documentos admitidos de `DRIVE_FOLDER_ID`, extrae su texto, crea fragmentos y calcula embeddings multilingües localmente con `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (384 dimensiones). La primera ejecución puede descargar el modelo.
4. Inicia la API con `npm run dev` y el frontend con `npm run dev` desde `Frontend`.

DeepSeek se utiliza para generar respuestas; su API no provee embeddings. La búsqueda vectorial usa `Xenova/paraphrase-multilingual-MiniLM-L12-v2` localmente, sin enviar los documentos al proveedor de chat durante la vectorización.

La API expone `GET /api/health`, `POST /api/chat`, `GET /api/me`, `GET /api/dashboard` y `POST /api/analyst/run`.
En desarrollo local se permiten los encabezados `x-user-id` y `x-user-role` para pruebas. En producción, la API requiere un token de Supabase Auth mediante `Authorization: Bearer <token>`.
