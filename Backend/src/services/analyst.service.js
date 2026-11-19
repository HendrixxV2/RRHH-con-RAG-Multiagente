const { supabase } = require('../../config/supabase');
const { ejecutarAgente, AGENT_IDS } = require('./agents.service');

async function generarReporteDiario() {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const ago30 = new Date(today);
  ago30.setDate(ago30.getDate() - 30);

  const [
    pending,
    vacations,
    incapacity,
    movement,
    chat,
    documents
  ] = await Promise.all([
    supabase.from('solicitudes').select('id,fecha_solicitud,tipo').eq('estado', 'pendiente').lte('fecha_solicitud', new Date(today.getTime() - 3 * 86400000).toISOString()),
    supabase.from('saldos_vacaciones').select('colaborador_id,dias_disponibles').gt('dias_disponibles', 20),
    supabase.from('incapacidades').select('id,dias,tipo').gte('fecha_inicio', ago30.toISOString().slice(0, 10)),
    supabase.from('movimientos_personal').select('tipo').gte('fecha', ago30.toISOString().slice(0, 10)).eq('tipo', 'retiro'),
    supabase.from('consultas_chat').select('intent,latencia_ms,fuentes').gte('creado_en', ago30.toISOString()),
    supabase.from('consultas_chat').select('pregunta').gte('creado_en', today.toISOString().slice(0, 10))
  ]);

  for (const result of [pending, vacations, incapacity, movement, chat, documents]) {
    if (result.error) throw new Error(`Falló el cálculo del reporte: ${result.error.message}`);
  }

  const temas = {};
  for (const row of documents.data || []) {
    const text = (row.pregunta || '').toLowerCase();
    const keywords = ['vacaciones', 'permiso', 'licencia', 'jornada', 'beneficios', 'conducta', 'privacidad'];
    for (const keyword of keywords) {
      if (text.includes(keyword)) temas[keyword] = (temas[keyword] || 0) + 1;
    }
  }
  const top5 = Object.entries(temas).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tema, cantidad]) => ({ tema, cantidad }));

  const latencies = (chat.data || []).map(row => row.latencia_ms).filter(Number.isFinite);
  const promedioLatencia = latencies.length
    ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
    : 0;

  const indicadores = {
    solicitudes_pendientes_mas_3_dias: pending.data?.length || 0,
    pasivo_vacaciones_mas_20_dias: vacations.data?.length || 0,
    incapacidades_30_dias: incapacity.data?.length || 0,
    retiros_30_dias: movement.data?.length || 0,
    consultas_30_dias: chat.data?.length || 0,
    latencia_promedio_ms: promedioLatencia,
    top5_temas_brechas_rag: top5
  };

  const resumen = await redactarResumen(indicadores);
  const { data, error } = await supabase.from('reportes_diarios').upsert({
    fecha: todayIso,
    indicador: indicadores,
    resumen
  }, { onConflict: 'fecha' }).select().single();
  if (error) throw new Error(`No se pudo guardar el reporte diario: ${error.message}`);
  return data;
}

async function redactarResumen(indicadores) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return `Se registraron ${indicadores.consultas_30_dias} consultas en los últimos 30 días. ` +
      `Hay ${indicadores.solicitudes_pendientes_mas_3_dias} solicitudes pendientes por más de 3 días y ` +
      `${indicadores.incapacidades_30_dias} incapacidades en el mismo período. ` +
      `${indicadores.pasivo_vacaciones_mas_20_dias} colaboradores presentan pasivo de vacaciones superior a 20 días.`;
  }

  return ejecutarAgente(AGENT_IDS.ANALYTICS, {
    question: 'Redacta el resumen ejecutivo de estos indicadores.',
    context: JSON.stringify(indicadores)
  });
}

async function obtenerDashboard() {
  const { data: latest, error: latestError } = await supabase
    .from('reportes_diarios')
    .select('fecha,indicador,resumen')
    .order('fecha', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw latestError;

  const { data: history, error: historyError } = await supabase
    .from('reportes_diarios')
    .select('fecha,indicador,resumen')
    .order('fecha', { ascending: false })
    .limit(30);
  if (historyError) throw historyError;

  const { data: pending, error: pendingError } = await supabase
    .from('solicitudes')
    .select('id,tipo,estado,fecha_solicitud,fecha_inicio,fecha_fin,detalle,colaborador_id')
    .eq('estado', 'pendiente')
    .order('fecha_solicitud', { ascending: true })
    .limit(20);
  if (pendingError) throw pendingError;

  return { latest: latest || null, history: history || [], solicitudes_pendientes: pending || [] };
}

module.exports = { generarReporteDiario, obtenerDashboard };
