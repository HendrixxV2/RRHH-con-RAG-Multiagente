create or replace function public.calcular_indicadores_rrhh_diarios()
returns jsonb
language sql
stable
security invoker
set search_path = public, extensions
as $$
with limites as (
  select current_date as hoy, current_date - 30 as desde
),
saldos_actuales as (
  select distinct on (colaborador_id)
    colaborador_id,
    dias_disponibles
  from public.saldos_vacaciones
  order by colaborador_id, periodo desc
),
metricas_chat as (
  select
    count(*) as consultas_30_dias,
    coalesce(round(avg(latencia_ms))::integer, 0) as latencia_promedio_ms,
    coalesce(round(percentile_cont(0.9) within group (order by latencia_ms))::integer, 0) as latencia_p90_ms,
    coalesce(
      round(
        100.0 * count(*) filter (where latencia_ms <= 8000)
        / nullif(count(latencia_ms), 0),
        1
      ),
      0
    ) as consultas_menores_8s_pct
  from public.consultas_chat, limites
  where creado_en >= limites.desde
),
temas_sin_fuente as (
  select
    tema.keyword as tema,
    count(*)::integer as cantidad
  from public.consultas_chat as consulta
  cross join lateral unnest(array[
    'vacaciones',
    'permiso',
    'licencia',
    'jornada',
    'beneficios',
    'conducta',
    'privacidad'
  ]) as tema(keyword)
  where consulta.creado_en >= current_date
    and consulta.intent in ('politica', 'mixta')
    and coalesce(jsonb_array_length(consulta.fuentes), 0) = 0
    and consulta.pregunta ilike '%' || tema.keyword || '%'
  group by tema.keyword
),
top5 AS (
  select tema, cantidad
  from temas_sin_fuente
  order by cantidad desc, tema
  limit 5
)
select jsonb_build_object(
  'fecha', current_date,
  'solicitudes_pendientes_mas_3_dias', (
    select count(*) from public.solicitudes
    where estado = 'pendiente'
      and fecha_solicitud <= now() - interval '3 days'
  ),
  'pasivo_vacaciones_mas_20_dias', (
    select count(*) from saldos_actuales
    where dias_disponibles > 20
  ),
  'incapacidades_30_dias', (
    select count(*) from public.incapacidades, limites
    where fecha_inicio <= limites.hoy and fecha_fin >= limites.desde
  ),
  'ausencias_30_dias', (
    select count(*) from public.incapacidades, limites
    where fecha_inicio <= limites.hoy and fecha_fin >= limites.desde
  ) + (
    select count(*) from public.solicitudes, limites
    where estado = 'aprobada'
      and tipo in ('vacaciones', 'permiso', 'licencia')
      and fecha_inicio <= limites.hoy
      and fecha_fin >= limites.desde
  ),
  'dias_ausencia_30_dias', (
    select coalesce(sum(dias), 0) from public.incapacidades, limites
    where fecha_inicio <= limites.hoy and fecha_fin >= limites.desde
  ) + (
    select coalesce(sum(
      greatest(least(fecha_fin, limites.hoy) - greatest(fecha_inicio, limites.desde) + 1, 0)
    ), 0)
    from public.solicitudes, limites
    where estado = 'aprobada'
      and tipo in ('vacaciones', 'permiso', 'licencia')
      and fecha_inicio <= limites.hoy
      and fecha_fin >= limites.desde
  ),
  'retiros_30_dias', (
    select count(*) from public.movimientos_personal, limites
    where tipo = 'retiro'
      and fecha between limites.desde and limites.hoy
  ),
  'consultas_30_dias', metricas_chat.consultas_30_dias,
  'latencia_promedio_ms', metricas_chat.latencia_promedio_ms,
  'latencia_p90_ms', metricas_chat.latencia_p90_ms,
  'consultas_menores_8s_pct', metricas_chat.consultas_menores_8s_pct,
  'top5_temas_brechas_rag', coalesce((
    select jsonb_agg(
      jsonb_build_object('tema', tema, 'cantidad', cantidad)
      order by cantidad desc, tema
    )
    from top5
  ), '[]'::jsonb)
)
from metricas_chat;
$$;

revoke all on function public.calcular_indicadores_rrhh_diarios()
  from public, anon, authenticated;
grant execute on function public.calcular_indicadores_rrhh_diarios() to service_role;
