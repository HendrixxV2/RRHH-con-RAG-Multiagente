alter table public.documentos_drive
  add column if not exists folder_id text;

create table if not exists public.drive_sync_state (
  id text primary key check (id = 'google-drive-policy-folder'),
  folder_id text not null,
  page_token text not null,
  updated_at timestamptz not null default now()
);

alter table public.drive_sync_state enable row level security;
grant all on public.drive_sync_state to service_role;

create or replace function public.replace_document_chunks(
  p_file_id text,
  p_folder_id text,
  p_file_name text,
  p_mime_type text,
  p_web_view_link text,
  p_hash text,
  p_chunks jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  chunks_saved integer;
begin
  insert into public.documentos_drive (id, name, mimeType, webViewLink, hash_contenido, folder_id)
  values (p_file_id, p_file_name, p_mime_type, p_web_view_link, p_hash, p_folder_id)
  on conflict (id) do update set
    name = excluded.name,
    mimeType = excluded.mimeType,
    webViewLink = excluded.webViewLink,
    hash_contenido = excluded.hash_contenido,
    folder_id = excluded.folder_id,
    updated_at = now();

  delete from public.documentos_chunks
  where file_id = p_file_id;

  insert into public.documentos_chunks (file_id, chunk_index, content, embedding, metadata)
  select
    p_file_id,
    chunk.chunk_index,
    chunk.content,
    chunk.embedding::text::vector(384),
    coalesce(chunk.metadata, '{}'::jsonb)
  from jsonb_to_recordset(coalesce(p_chunks, '[]'::jsonb)) as chunk(
    chunk_index integer,
    content text,
    embedding jsonb,
    metadata jsonb
  );

  get diagnostics chunks_saved = row_count;
  return chunks_saved;
end;
$$;

grant execute on function public.replace_document_chunks(text, text, text, text, text, text, jsonb)
  to service_role;
revoke all on function public.replace_document_chunks(text, text, text, text, text, text, jsonb)
  from public, anon, authenticated;

create unique index if not exists movimientos_personal_simulado_unico_idx
  on public.movimientos_personal (colaborador_id, fecha, detalle);

insert into public.movimientos_personal (colaborador_id, tipo, fecha, detalle)
select
  collaborator.id,
  (array['ingreso', 'promocion', 'traslado', 'retiro'])[1 + ((person.number + period.number) % 4)],
  current_date - (period.number * 30 + (person.number % 20)),
  'Movimiento simulado - ' || to_char(current_date - (period.number * 30), 'YYYY-MM')
from public.colaboradores as collaborator
cross join lateral (select substring(collaborator.id from 5)::integer as number) as person
cross join generate_series(0, 2) as period(number)
on conflict do nothing;
