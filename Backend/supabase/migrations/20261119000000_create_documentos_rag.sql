-- Migración para el pipeline de ingesta RAG (contexto del proyecto).
-- Crea las tablas documentos_drive y documentos_chunks con embeddings vector(384).
-- Ejecutar en Supabase (SQL Editor) antes de correr `npm run ingest:drive`.

create extension if not exists vector with schema extensions;

create table if not exists public.documentos_drive (
  id text primary key,
  name text not null,
  mimeType text not null,
  webViewLink text,
  hash_contenido text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.documentos_chunks (
  id bigint generated always as identity primary key,
  file_id text not null references public.documentos_drive(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  embedding vector(384) not null,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (file_id, chunk_index)
);

-- Índice ivfflat para búsqueda vectorial por coseno (igual que indica el contexto).
create index if not exists documentos_chunks_embedding_ivfflat_idx
  on public.documentos_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

alter table public.documentos_drive enable row level security;
alter table public.documentos_chunks enable row level security;

grant all on public.documentos_drive to service_role;
grant all on public.documentos_chunks to service_role;
grant usage, select on sequence public.documentos_chunks_id_seq to service_role;
