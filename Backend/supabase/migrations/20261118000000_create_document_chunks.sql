create schema if not exists extensions;
create extension if not exists vector with schema extensions;

create table if not exists public.document_chunks (
  id bigint generated always as identity primary key,
  file_id text not null,
  file_name text not null,
  mime_type text not null,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  embedding extensions.vector(384) not null,
  updated_at timestamptz not null default now(),
  unique (file_id, chunk_index)
);

create index if not exists document_chunks_embedding_hnsw_idx
  on public.document_chunks using hnsw (embedding vector_cosine_ops);

alter table public.document_chunks enable row level security;

create or replace function public.match_document_chunks(
  query_embedding extensions.vector(384),
  match_count integer default 5,
  match_threshold real default 0.25
)
returns table (
  id bigint,
  file_id text,
  file_name text,
  content text,
  similarity real
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    chunks.id,
    chunks.file_id,
    chunks.file_name,
    chunks.content,
    (1 - (chunks.embedding <=> query_embedding))::real as similarity
  from public.document_chunks as chunks
  where 1 - (chunks.embedding <=> query_embedding) >= match_threshold
  order by chunks.embedding <=> query_embedding
  limit greatest(match_count, 0);
$$;

grant select, insert, update, delete on public.document_chunks to service_role;
grant usage, select on sequence public.document_chunks_id_seq to service_role;
grant execute on function public.match_document_chunks(extensions.vector, integer, real) to service_role;
