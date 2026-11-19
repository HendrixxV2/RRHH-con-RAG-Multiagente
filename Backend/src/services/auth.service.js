const { supabase } = require('../../config/supabase');

async function resolverActor(req) {
  const authorization = req.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice(7).trim();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      const authError = new Error('Sesión inválida o expirada');
      authError.status = 401;
      throw authError;
    }

    const email = data.user.email;
    if (email) {
      const { data: empleado } = await supabase
        .from('colaboradores')
        .select('id,nombre,email,rol,departamento,cargo')
        .eq('email', email)
        .maybeSingle();
      if (empleado) return empleado;
    }

    const actor = {
      id: data.user.user_metadata?.employee_id || null,
      nombre: data.user.user_metadata?.name || 'Colaborador',
      email,
      rol: data.user.user_metadata?.role === 'rrhh' ? 'rrhh' : 'colaborador'
    };
    if (!actor.id) {
      const authError = new Error('La cuenta no está vinculada a un colaborador');
      authError.status = 403;
      throw authError;
    }
    return actor;
  }

  if (process.env.NODE_ENV === 'production') {
    const authError = new Error('Se requiere autenticación');
    authError.status = 401;
    throw authError;
  }

  const id = req.get('x-user-id') || 'EMP-001';
  const rol = req.get('x-user-role') === 'rrhh' ? 'rrhh' : 'colaborador';
  const { data: empleado } = await supabase
    .from('colaboradores')
    .select('id,nombre,email,rol,departamento,cargo')
    .eq('id', id)
    .maybeSingle();

  if (empleado) return empleado;
  return { id, nombre: 'Usuario de demostración', email: null, rol };
}

module.exports = { resolverActor };
