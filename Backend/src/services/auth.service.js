const { supabase } = require('../../config/supabase');

async function resolverActor(req, database = supabase) {
  const authorization = req.get('authorization');
  if (authorization && /^Bearer\s+/i.test(authorization)) {
    const token = authorization.replace(/^Bearer\s+/i, '').trim();
    const { data, error } = await database.auth.getUser(token);
    if (error || !data?.user) {
      const authError = new Error('Sesión inválida o expirada');
      authError.status = 401;
      throw authError;
    }

    const email = data.user.email?.trim().toLowerCase();
    if (!email) {
      const authError = new Error('La cuenta no tiene un correo asociado a un colaborador');
      authError.status = 403;
      throw authError;
    }

    const { data: empleado, error: lookupError } = await database
      .from('colaboradores')
      .select('id,nombre,email,rol,departamento,cargo')
      .eq('email', email)
      .maybeSingle();
    if (lookupError) {
      const lookupErrorResponse = new Error('No fue posible verificar la cuenta de colaborador');
      lookupErrorResponse.status = 500;
      throw lookupErrorResponse;
    }
    if (!empleado) {
      const authError = new Error('La cuenta no está vinculada a un colaborador');
      authError.status = 403;
      throw authError;
    }
    return empleado;
  }

  if (process.env.NODE_ENV === 'production') {
    const authError = new Error('Se requiere autenticación');
    authError.status = 401;
    throw authError;
  }

  const id = req.get('x-user-id') || 'EMP-001';
  const rol = req.get('x-user-role') === 'rrhh' ? 'rrhh' : 'colaborador';
  const { data: empleado } = await database
    .from('colaboradores')
    .select('id,nombre,email,rol,departamento,cargo')
    .eq('id', id)
    .maybeSingle();

  if (empleado) return empleado;
  return { id, nombre: 'Usuario de demostración', email: null, rol };
}

module.exports = { resolverActor };
