const INTENTS = {
  POLICY: 'politica',
  PERSONAL: 'dato_personal',
  MIXED: 'mixta',
  RESTRICTED: 'restringida',
  OUT_OF_SCOPE: 'fuera_de_alcance'
};

const { AGENT_IDS } = require('./agents.service');

const POLICY_TOPICS = /\b(pol[ií]tica|pol[ií]ticas|vacaciones?|feriados?|permisos?|licencias?|incapacidades?|jornada|teletrabajo|salario|remuneraci[oó]n|beneficios?|conducta|[eé]tica|privacidad|aguinaldo|horas extra)\b/i;
const POLICY_REQUEST = /\b(pol[ií]tica|procedimiento|regla(?:s)?|requisito(?:s)?|derecho(?:s)?|normativa|seg[uú]n|c[oó]mo|cu[aá]ndo|puedo|corresponde|por ley)\b/i;
const PERSONAL_RECORD = /\b(saldo|vacaciones?|permisos?|solicitudes?|incapacidades?|departamento|cargo|fecha de ingreso|perfil|datos|salario|sueldo|n[oó]mina)\b/i;
const THIRD_PARTY_NAME_RECORD = /\b(?:datos|perfil|saldo|vacaciones?|solicitud|sueldo|salario|n[oó]mina)\s+de\s+(?!(?:mi|mis|m[ií]o|m[ií]a|nuestro|nuestra|la|el|las|los|otro|otra|tercero|tercera|vacaciones?|permisos?|licencias?|solicitudes?|incapacidades?|perfil|usuario|todos?|todas?)\b)[a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)?\b/i;

function clasificarConsulta(question) {
  const text = typeof question === 'string' ? question.toLowerCase() : '';
  const thirdParty = /\b(?:del empleado|de la empleada|de otro empleado|de otra persona|de terceros?)\b/i.test(text) ||
    THIRD_PARTY_NAME_RECORD.test(text) ||
    /\b(?:qué|cuánto|cuántos|cuál).*(?:tiene|gana|solicitó)\s+(?:el|la)\s+(?:empleado|empleada|colaborador|colaboradora)\b/i.test(text);
  if (thirdParty) return INTENTS.RESTRICTED;

  const ownPersonal = /\b(?:mi|mis|mío|mía)\b/i.test(text) && PERSONAL_RECORD.test(text) ||
    /\bme\s+(?:quedan|corresponden|corresponde|asignaron)\b/i.test(text) ||
    /\b(?:tengo|dispongo)\b.*\b(?:saldo|vacaciones?|solicitudes?|permisos?|incapacidades?|perfil|salario|sueldo)\b/i.test(text);
  const policy = POLICY_TOPICS.test(text);
  const policyRequest = POLICY_REQUEST.test(text);

  if (ownPersonal && policy && policyRequest) return INTENTS.MIXED;
  if (ownPersonal) return INTENTS.PERSONAL;
  if (policy) return INTENTS.POLICY;
  if (/\b(cambiar|borrar|eliminar|actualizar|insertar|crear|pagar|contraseña|terceros)\b/i.test(text)) {
    return INTENTS.RESTRICTED;
  }
  return INTENTS.OUT_OF_SCOPE;
}

function seleccionarAgente(question, intent = clasificarConsulta(question)) {
  if (intent === INTENTS.POLICY || intent === INTENTS.MIXED) return AGENT_IDS.POLICIES;
  if (intent !== INTENTS.PERSONAL) return AGENT_IDS.COORDINATOR;

  const requestsQuestion = /\b(vacaciones?|saldo|solicitudes?|permisos?|licencias?|incapacidades?|ausencias?)\b/i.test(question);
  return requestsQuestion ? AGENT_IDS.REQUESTS : AGENT_IDS.PROFILE;
}

module.exports = { clasificarConsulta, seleccionarAgente, INTENTS };
