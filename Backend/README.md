# Backend RAG

## Preparación

1. Configura las variables de `Backend/.env` usando `.env.example` como referencia y coloca la cuenta de servicio de Drive en `service-account-key.json`.
2. Comparte la carpeta de políticas con el correo de la cuenta de servicio, asignándole solo lectura, y configura su ID en `DRIVE_FOLDER_ID`. La cuenta usa el alcance `drive.readonly`.
3. Ejecuta en orden las migraciones SQL de `Backend/supabase/migrations/` en el SQL Editor de Supabase. Incluyen el índice vectorial RAG, las tablas operativas y datos simulados (50 colaboradores y movimientos de los últimos tres meses), el estado de sincronización de Drive y la función de indicadores agregados del dashboard.
4. Desde `Backend`, ejecuta `npm run ingest:drive`. La primera ejecución indexa los archivos admitidos de la carpeta; las siguientes consultan `Drive API changes.list` y actualizan solo archivos nuevos o editados, eliminan del índice los borrados o movidos fuera de la carpeta y conservan título, versión, vigencia, responsable, sección y enlace de cita cuando constan en el documento. La sincronización automática se ejecuta diariamente desde las 6:00 a. m. y el reporte de RR. HH. a las 7:00 a. m., hora de Costa Rica. El proceso extrae texto, crea fragmentos de hasta 4.000 caracteres con solapamiento de 400 y calcula embeddings multilingües localmente con `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (384 dimensiones). La primera ejecución puede descargar el modelo.
5. Configura `Frontend/.env` con `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (clave pública anon, nunca la service-role) y, si aplica, `VITE_API_URL`. Los usuarios deben tener una cuenta de Supabase Auth cuyo correo coincida con `colaboradores.email`; el rol se obtiene de esa tabla.
6. Inicia la API con `npm run dev` desde `Backend` y el frontend con `npm run dev` desde `Frontend`.

DeepSeek se utiliza para generar respuestas; su API no provee embeddings. La búsqueda vectorial usa `Xenova/paraphrase-multilingual-MiniLM-L12-v2` localmente, sin enviar los documentos al proveedor de chat durante la vectorización.

El trabajo usa cinco agentes conectados a DeepSeek: coordinador, especialista en políticas (RAG), asistente de perfil personal, asistente de solicitudes propias y analista de RR. HH. (indicadores agregados). El filtro local de privacidad y alcance se ejecuta antes del coordinador; este solo puede derivar consultas personales entre perfil y solicitudes, con una ruta de respaldo determinista. Los agentes comparten `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` y `DEEPSEEK_BASE_URL`. Cada respuesta del chat incluye el agente que redactó la respuesta. La clave debe permanecer en `Backend/.env` y nunca configurarse en el frontend.

La API expone `GET /api/health`, `POST /api/chat`, `GET /api/me`, `GET /api/dashboard` y `POST /api/analyst/run`.
En desarrollo local se permiten los encabezados `x-user-id` y `x-user-role` para pruebas. En producción, la API requiere un token de Supabase Auth mediante `Authorization: Bearer <token>`.
El dashboard está restringido al rol `rrhh` y presenta indicadores agregados, historial de reportes y solicitudes pendientes. La generación diaria es idempotente por fecha y puede volver a intentarse tras un error; la publicación manual está disponible en `POST /api/analyst/run`.
