create extension if not exists pgcrypto;

create table if not exists public.colaboradores (
  id text primary key,
  nombre text not null,
  email text unique not null,
  rol text not null check (rol in ('colaborador', 'rrhh')),
  departamento text not null,
  cargo text not null,
  fecha_ingreso date not null,
  activo boolean not null default true
);

create table if not exists public.saldos_vacaciones (
  id bigint generated always as identity primary key,
  colaborador_id text not null references public.colaboradores(id) on delete cascade,
  dias_disponibles numeric(5,2) not null default 0,
  dias_usados numeric(5,2) not null default 0,
  periodo text not null,
  unique (colaborador_id, periodo)
);

create table if not exists public.solicitudes (
  id bigint generated always as identity primary key,
  colaborador_id text not null references public.colaboradores(id) on delete cascade,
  tipo text not null,
  estado text not null check (estado in ('pendiente', 'aprobada', 'rechazada')),
  fecha_solicitud timestamptz not null default now(),
  fecha_inicio date,
  fecha_fin date,
  detalle text
);

create table if not exists public.incapacidades (
  id bigint generated always as identity primary key,
  colaborador_id text not null references public.colaboradores(id) on delete cascade,
  fecha_inicio date not null,
  fecha_fin date not null,
  tipo text not null,
  dias numeric(5,2) not null
);

create table if not exists public.movimientos_personal (
  id bigint generated always as identity primary key,
  colaborador_id text not null references public.colaboradores(id) on delete cascade,
  tipo text not null check (tipo in ('ingreso','promocion','traslado','retiro')),
  fecha date not null,
  detalle text
);

create table if not exists public.consultas_chat (
  id bigint generated always as identity primary key,
  colaborador_id text,
  pregunta text not null,
  respuesta text not null,
  intent text,
  fuentes jsonb not null default '[]'::jsonb,
  latencia_ms integer,
  creado_en timestamptz not null default now()
);

create table if not exists public.reportes_diarios (
  id bigint generated always as identity primary key,
  fecha date not null unique,
  indicador jsonb not null,
  resumen text not null,
  creado_en timestamptz not null default now()
);

insert into public.colaboradores (id, nombre, email, rol, departamento, cargo, fecha_ingreso)
select
  'EMP-' || lpad(gs::text, 3, '0'),
  'Colaborador ' || lpad(gs::text, 3, '0'),
  'colaborador' || lpad(gs::text, 3, '0') || '@entre-nos.example',
  case when gs = 1 then 'rrhh' else 'colaborador' end,
  (array['Administracion','Operaciones','Ventas','Tecnologia','Recursos Humanos'])[1 + (gs % 5)],
  (array['Analista','Especialista','Coordinador','Asistente','Supervisor'])[1 + (gs % 5)],
  (current_date - (180 + gs * 7))
from generate_series(1, 50) gs
on conflict (id) do nothing;

insert into public.saldos_vacaciones (colaborador_id, dias_disponibles, dias_usados, periodo)
select
  id,
  4 + ((row_number() over ()) % 24),
  2 + ((row_number() over ()) % 12),
  '2026'
from public.colaboradores
on conflict (colaborador_id, periodo) do nothing;

insert into public.solicitudes (colaborador_id, tipo, estado, fecha_solicitud, fecha_inicio, fecha_fin, detalle)
select
  id,
  (array['vacaciones','permiso','licencia','teletrabajo'])[1 + (row_number() over () % 4)],
  (array['pendiente','aprobada','rechazada'])[1 + (row_number() over () % 3)],
  now() - ((row_number() over () % 90) || ' days')::interval,
  current_date + ((row_number() over () % 30)),
  current_date + ((row_number() over () % 30) + 3),
  'Solicitud simulada para fines académicos'
from public.colaboradores
on conflict do nothing;

insert into public.incapacidades (colaborador_id, fecha_inicio, fecha_fin, tipo, dias)
select
  id,
  current_date - (gs % 80),
  current_date - (gs % 80) + 3,
  (array['médica','laboral','maternidad'])[1 + (gs % 3)],
  3
from public.colaboradores cross join lateral (select substring(id from 5)::integer as gs) numbers
where gs % 3 = 0
on conflict do nothing;

insert into public.movimientos_personal (colaborador_id, tipo, fecha, detalle)
select
  id,
  (array['ingreso','promocion','traslado','retiro'])[1 + (gs % 4)],
  current_date - (gs * 7),
  'Movimiento simulado'
from public.colaboradores cross join lateral (select substring(id from 5)::integer as gs) numbers
on conflict do nothing;

create or replace function public.match_documentos_chunks(
  query_embedding vector(384),
  match_count integer default 5,
  match_threshold real default 0.25
)
returns table (
  id bigint,
  file_id text,
  chunk_index integer,
  content text,
  metadata jsonb,
  similarity real
)
language sql stable security invoker
set search_path = public, extensions
as $$
  select
    chunks.id,
    chunks.file_id,
    chunks.chunk_index,
    chunks.content,
    chunks.metadata,
    (1 - (chunks.embedding <=> query_embedding))::real as similarity
  from public.documentos_chunks as chunks
  where 1 - (chunks.embedding <=> query_embedding) >= match_threshold
  order by chunks.embedding <=> query_embedding
  limit greatest(match_count, 0);
$$;

alter table public.colaboradores enable row level security;
alter table public.saldos_vacaciones enable row level security;
alter table public.solicitudes enable row level security;
alter table public.incapacidades enable row level security;
alter table public.movimientos_personal enable row level security;
alter table public.consultas_chat enable row level security;
alter table public.reportes_diarios enable row level security;

grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function public.match_documentos_chunks(vector, integer, real) to service_role;
