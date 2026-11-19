const INTENTS = {
  POLICY: 'politica',
  PERSONAL: 'dato_personal',
  MIXED: 'mixta',
  RESTRICTED: 'restringida',
  OUT_OF_SCOPE: 'fuera_de_alcance'
};

function clasificarConsulta(question) {
  const text = (question || '').toLowerCase();
  const ownPersonal = /\b(mi|mis|mío|mía|yo)\b|(?:cuál|cuantos?|cuánto).*(?:es|son).*(?:mi\s+saldo|mis\s+vacaciones)/.test(text);
  if (ownPersonal) return INTENTS.PERSONAL;
  const thirdParty = /(?:del empleado|de la empleada|de otro|datos de [a-záéíóúñ]+|saldo de [a-záéíóúñ]+|vacaciones de [a-záéíóúñ]+|solicitud de [a-záéíóúñ]+|sueldo de [a-záéíóúñ]+)|(?:qué|cuánto|cuántos).*(?:tiene|gana|solicitó)\s+(?:el|la)\b/.test(text);
  const personal = ownPersonal || /\b(mi|mis)\b|(?:cuántos?|qué|cuál).*(?:mis?\s+(?:vacaciones|saldo|permisos|solicitudes|incapacidades))/.test(text);
  if (thirdParty) return INTENTS.RESTRICTED;
  if (ownPersonal) return INTENTS.PERSONAL;
  const policy = /\b(política|políticas|vacaciones|permiso|licencia|incapacidad|jornada|teletrabajo|salario|remuneración|beneficio|conducta|ética|privacidad|feriado)\b/.test(text);

  if (personal && policy) return INTENTS.MIXED;
  if (personal) return INTENTS.PERSONAL;
  if (policy) return INTENTS.POLICY;
  if (/cambiar|borrar|eliminar|actualizar|insertar|crear|pagar|contraseña|terceros/.test(text)) return INTENTS.RESTRICTED;
  return INTENTS.OUT_OF_SCOPE;
}

module.exports = { clasificarConsulta, INTENTS };
