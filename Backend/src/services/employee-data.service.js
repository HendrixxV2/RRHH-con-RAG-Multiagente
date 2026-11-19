const { supabase } = require('../../config/supabase');

async function consultarDatosColaborador(actor) {
  if (!actor?.id) throw new Error('No fue posible identificar al colaborador autenticado');

  const [profile, balances, requests, incapacity] = await Promise.all([
    supabase.from('colaboradores').select('id,nombre,email,rol,departamento,cargo,fecha_ingreso,activo').eq('id', actor.id).maybeSingle(),
    supabase.from('saldos_vacaciones').select('dias_disponibles,dias_usados,periodo').eq('colaborador_id', actor.id).order('periodo', { ascending: false }).limit(1),
    supabase.from('solicitudes').select('tipo,estado,fecha_solicitud,fecha_inicio,fecha_fin,detalle').eq('colaborador_id', actor.id).order('fecha_solicitud', { ascending: false }).limit(10),
    supabase.from('incapacidades').select('fecha_inicio,fecha_fin,tipo,dias').eq('colaborador_id', actor.id).order('fecha_inicio', { ascending: false }).limit(5)
  ]);

  for (const result of [profile, balances, requests, incapacity]) {
    if (result.error) throw new Error(`Falló una consulta de datos: ${result.error.message}`);
  }

  return {
    perfil: profile.data,
    vacaciones: balances.data?.[0] || null,
    solicitudes: requests.data || [],
    incapacidades: incapacity.data || []
  };
}

function resumirDatosPersonales(datos) {
  const lines = [];
  if (datos.vacaciones) {
    lines.push(`Tu saldo de vacaciones es de ${datos.vacaciones.dias_disponibles} días disponibles y ${datos.vacaciones.dias_usados} usados (${datos.vacaciones.periodo}).`);
  }
  if (datos.solicitudes.length) {
    const recientes = datos.solicitudes.slice(0, 3).map(item =>
      `${item.tipo}: ${item.estado}`
    );
    lines.push(`Tus solicitudes recientes son: ${recientes.join(', ')}.`);
  }
  if (datos.incapacidades.length) {
    lines.push(`Tienes ${datos.incapacidades.length} incapacidad(es) registrada(s) recientemente.`);
  }
  if (!lines.length) lines.push('No encontré datos personales registrados para tu usuario.');
  return lines.join('\n');
}

function resumirPerfilPersonal(datos) {
  const profile = datos.perfil;
  if (!profile) return 'No encontré un perfil registrado para tu usuario.';

  return [
    profile.departamento && `Departamento: ${profile.departamento}.`,
    profile.cargo && `Cargo: ${profile.cargo}.`,
    profile.fecha_ingreso && `Fecha de ingreso: ${profile.fecha_ingreso}.`,
    typeof profile.activo === 'boolean' && `Estado: ${profile.activo ? 'activo' : 'inactivo'}.`
  ].filter(Boolean).join('\n') || 'No encontré datos de perfil disponibles.';
}

function resumirSolicitudesPersonales(datos) {
  const lines = [];
  if (datos.vacaciones) {
    lines.push(`Vacaciones: ${datos.vacaciones.dias_disponibles} días disponibles y ${datos.vacaciones.dias_usados} usados (${datos.vacaciones.periodo}).`);
  }
  if (datos.solicitudes.length) {
    lines.push(`Solicitudes recientes: ${datos.solicitudes.slice(0, 5).map(item =>
      `${item.tipo}, estado ${item.estado}, solicitada el ${item.fecha_solicitud}${item.fecha_inicio ? `, fecha de inicio ${item.fecha_inicio}${item.fecha_fin ? ` y fecha de fin ${item.fecha_fin}` : ''}` : ''}`
    ).join('; ')}.`);
  }
  if (datos.incapacidades.length) {
    lines.push(`Incapacidades recientes: ${datos.incapacidades.slice(0, 5).map(item =>
      `${item.tipo}, ${item.dias} días, del ${item.fecha_inicio} al ${item.fecha_fin}`
    ).join('; ')}.`);
  }
  return lines.join('\n') || 'No encontré vacaciones, solicitudes ni incapacidades registradas para tu usuario.';
}

module.exports = {
  consultarDatosColaborador,
  resumirDatosPersonales,
  resumirPerfilPersonal,
  resumirSolicitudesPersonales
};
