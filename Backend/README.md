# Backend RAG

## Preparación

1. Configura las variables de `Backend/.env` usando `.env.example` como referencia y coloca la cuenta de servicio de Drive en `service-account-key.json`.
2. Ejecuta `supabase/migrations/20261118000000_create_document_chunks.sql` en el SQL Editor del proyecto Supabase. La tabla usa `pgvector` con vectores de 384 dimensiones.
3. Desde `Backend`, ejecuta `npm run ingest:drive`. El proceso descarga los documentos admitidos de `DRIVE_FOLDER_ID`, extrae su texto, crea fragmentos y calcula embeddings multilingües localmente. La primera ejecución descarga el modelo de Hugging Face.
4. Inicia la API con `npm run dev` y el frontend con `npm run dev` desde `Frontend`.

DeepSeek se utiliza para generar respuestas; su API no provee embeddings. La búsqueda vectorial usa `Xenova/paraphrase-multilingual-MiniLM-L12-v2` localmente, sin enviar los documentos al proveedor de chat durante la vectorización.

La API expone `GET /api/health` y `POST /api/chat` con `{ "question": "...", "history": [] }`. Para desplegar el frontend en otro origen, configura `FRONTEND_ORIGINS` con los orígenes permitidos.
