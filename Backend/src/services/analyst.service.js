const { supabase } = require('../../config/supabase');
const { ejecutarAgente, AGENT_IDS } = require('./agents.service');

async function generarReporteDiario() {
  const { data: indicadores, error: metricsError } = await supabase.rpc(
    'calcular_indicadores_rrhh_diarios'
  );
  if (metricsError) throw new Error(`Falló el cálculo SQL del reporte: ${metricsError.message}`);
  if (!indicadores || typeof indicadores !== 'object') {
    throw new Error('La base de datos no devolvió indicadores válidos para el reporte');
  }

  const resumen = await redactarResumen(indicadores);
  const { data, error } = await supabase.from('reportes_diarios').upsert({
    fecha: indicadores.fecha || new Date().toISOString().slice(0, 10),
    indicador: indicadores,
    resumen
  }, { onConflict: 'fecha' }).select().single();
  if (error) throw new Error(`No se pudo guardar el reporte diario: ${error.message}`);
  return data;
}

async function redactarResumen(indicadores) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return `En los últimos 30 días se registraron ${indicadores.consultas_30_dias} consultas, con latencia p90 de ${indicadores.latencia_p90_ms} ms. ` +
      `Se reportaron ${indicadores.ausencias_30_dias} ausencias que suman ${indicadores.dias_ausencia_30_dias} días. ` +
      `Hay ${indicadores.solicitudes_pendientes_mas_3_dias} solicitudes pendientes por más de tres días y ${indicadores.retiros_30_dias} retiros. ` +
      `${indicadores.pasivo_vacaciones_mas_20_dias} colaboradores superan los 20 días disponibles de vacaciones.`;
  }

  return ejecutarAgente(AGENT_IDS.ANALYTICS, {
    question: 'Redacta el resumen ejecutivo de estos indicadores en 3 a 5 frases.',
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
    .select('id,tipo,estado,fecha_solicitud,fecha_inicio,fecha_fin,detalle,colaborador_id,colaborador:colaboradores(nombre,email)')
    .eq('estado', 'pendiente')
    .order('fecha_solicitud', { ascending: true })
    .limit(20);
  if (pendingError) throw pendingError;

  return {
    latest: latest || null,
    history: history || [],
    solicitudes_pendientes: pending || []
  };
}

module.exports = { generarReporteDiario, obtenerDashboard, redactarResumen };
