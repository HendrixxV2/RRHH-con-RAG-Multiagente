# Paquete documental de Recursos Humanos

Empresa ficticia: **Nexo Verde S.A.**, empresa costarricense de servicios tecnológicos para gestión energética, con 250 personas colaboradoras.

## Contenido

- `00_Informe_Investigacion_Legal.md`: informe de investigación y comparación de mínimos legales con beneficios propuestos.
- `00_Informe_Investigacion_Legal.pdf`: versión PDF del informe.
- `00_Catalogo_Politicas.csv`: matriz compatible con Excel y Google Sheets.
- `00_Catalogo_Politicas.xlsx`: hoja de cálculo con las diez políticas.
- `Politicas/`: diez borradores de políticas, uno por dominio obligatorio.
- `Politicas/01_Vacaciones_y_Feriados_GoogleDocs.docx`: documento listo para importar y convertir en Google Docs.

Cada política incluye título, versión, vigencia, responsable y encabezados para facilitar su revisión e indexación. Los datos y beneficios internos son simulados. Las políticas están en Markdown para revisión y posterior conversión a Google Docs; el catálogo CSV puede importarse como hoja de Google Sheets.

## Preparación de Drive

1. Revisa y aprueba el contenido con asesoría laboral costarricense.
2. Sube el informe PDF, importa el catálogo XLSX como Google Sheets y abre el DOCX con Google Docs para convertirlo a formato nativo. Los Markdown conservan las fuentes editables de las diez políticas.
3. Comparte la carpeta resultante con la cuenta de servicio usando permiso de lector y configura `DRIVE_FOLDER_ID` en `Backend/.env`.
4. Aplica en Supabase todas las migraciones de `Backend/supabase/migrations/` y ejecuta `npm run ingest:drive` desde `Backend`.

El proyecto no sube archivos ni modifica Drive: su credencial de servicio se limita a lectura. Los documentos aquí incluidos son fuentes locales de preparación.
