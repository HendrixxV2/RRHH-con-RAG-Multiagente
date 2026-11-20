const { supabase } = require('../../config/supabase');
const { generarEmbeddings } = require('./embedding.service');
const { clasificarConsulta, seleccionarAgente, INTENTS } = require('./orchestrator.service');
const {
  consultarDatosColaborador,
  resumirPerfilPersonal,
  resumirSolicitudesPersonales
} = require('./employee-data.service');
const { ejecutarAgente, obtenerAgente, coordinarConsulta, AGENT_IDS } = require('./agents.service');

const MAX_QUESTION_LENGTH = 4000;
const LOW_SIMILARITY_THRESHOLD = 0.45;
const LOW_CONFIDENCE_ANSWER = 'No encontré una coincidencia suficientemente confiable en las políticas indexadas. Si necesitas confirmarlo, solicita revisión a Recursos Humanos.';
const NO_POLICY_ANSWER = 'No encontré información relevante en las políticas indexadas. Si necesitas confirmarlo, solicita revisión a Recursos Humanos.';

async function buscarContexto(question) {
  const [embedding] = await generarEmbeddings([question]);
  const { data, error } = await supabase.rpc('match_documentos_chunks', {
    query_embedding: embedding,
    match_count: 5,
    match_threshold: 0.25
  });

  if (error) throw new Error(`Falló la búsqueda vectorial en Supabase: ${error.message}`);
  return data || [];
}

function filtrarCoincidenciasConfiables(matches) {
  return matches.filter(match => Number(match.similarity) >= LOW_SIMILARITY_THRESHOLD);
}

function mapearFuentes(matches) {
  return matches.map((match, index) => ({
    index: index + 1,
    fileId: match.file_id,
    fileName: match.metadata?.nombre_doc || match.file_id,
    section: match.metadata?.sección || 'General',
    version: match.metadata?.versión || null,
    link: match.metadata?.enlace || null,
    similarity: match.similarity
  }));
}

function construirContextoPoliticas(matches) {
  return matches.map((match, index) =>
    `[${index + 1}] ${match.metadata?.nombre_doc || match.file_id}\nSección: ${match.metadata?.sección || 'General'}\n${match.content}`
  ).join('\n\n');
}

async function registrarConsulta({ actor, question, answer, intent, sources, latenciaMs }) {
  const { error } = await supabase.from('consultas_chat').insert({
    colaborador_id: actor?.id || null,
    pregunta: question,
    respuesta: answer,
    intent,
    fuentes: sources,
    latencia_ms: latenciaMs
  });
  if (error) console.error('No se pudo registrar la consulta:', error.message);
}

async function responderPregunta(question, history = [], actor = null) {
  const startedAt = Date.now();
  if (typeof question !== 'string' || !question.trim() || question.length > MAX_QUESTION_LENGTH) {
    throw new TypeError(`La pregunta debe tener entre 1 y ${MAX_QUESTION_LENGTH} caracteres`);
  }

  const cleanQuestion = question.trim();
  const intent = clasificarConsulta(cleanQuestion);
  const policyAgentId = AGENT_IDS.POLICIES;
  let personalAgentId = null;
  if ([INTENTS.PERSONAL, INTENTS.MIXED].includes(intent)) {
    personalAgentId = await coordinarConsulta({
      question: cleanQuestion,
      candidateIds: [AGENT_IDS.PROFILE, AGENT_IDS.REQUESTS],
      fallbackId: seleccionarAgente(cleanQuestion, INTENTS.PERSONAL)
    });
  }

  let agentId = policyAgentId;
  let answer;
  let sources = [];

  if (intent === INTENTS.RESTRICTED) {
    agentId = AGENT_IDS.COORDINATOR;
    answer = 'No puedo consultar ni revelar datos personales de terceros. Puedo ayudarte con tus propios datos o con una consulta general de políticas.';
  } else if (intent === INTENTS.OUT_OF_SCOPE) {
    agentId = AGENT_IDS.COORDINATOR;
    answer = 'Esta consulta está fuera de mi alcance como asistente de Recursos Humanos. Solo puedo atender políticas internas y datos personales del usuario autenticado.';
  } else if (intent === INTENTS.PERSONAL) {
    agentId = personalAgentId;
    const personalData = await consultarDatosColaborador(actor);
    const context = agentId === AGENT_IDS.REQUESTS
      ? resumirSolicitudesPersonales(personalData)
      : resumirPerfilPersonal(personalData);
    answer = await ejecutarAgente(agentId, { question: cleanQuestion, context });
  } else if (intent === INTENTS.MIXED) {
    const [personalData, matches] = await Promise.all([
      consultarDatosColaborador(actor),
      buscarContexto(cleanQuestion)
    ]);
    const reliableMatches = filtrarCoincidenciasConfiables(matches);
    sources = mapearFuentes(reliableMatches);

    const personalContext = personalAgentId === AGENT_IDS.REQUESTS
      ? resumirSolicitudesPersonales(personalData)
      : resumirPerfilPersonal(personalData);
    const policyPromise = reliableMatches.length
      ? ejecutarAgente(policyAgentId, {
        question: cleanQuestion,
        context: construirContextoPoliticas(reliableMatches)
      })
      : Promise.resolve(matches.length ? LOW_CONFIDENCE_ANSWER : NO_POLICY_ANSWER);
    const [personalAnswer, policyAnswer] = await Promise.all([
      ejecutarAgente(personalAgentId, { question: cleanQuestion, context: personalContext }),
      policyPromise
    ]);
    answer = `Políticas:\n${policyAnswer}\n\nTus datos:\n${personalAnswer}`;
  } else {
    const matches = await buscarContexto(cleanQuestion);
    const reliableMatches = filtrarCoincidenciasConfiables(matches);
    if (!reliableMatches.length) {
      answer = matches.length ? LOW_CONFIDENCE_ANSWER : NO_POLICY_ANSWER;
    } else {
      sources = mapearFuentes(reliableMatches);
      answer = await ejecutarAgente(policyAgentId, {
        question: cleanQuestion,
        context: construirContextoPoliticas(reliableMatches),
        history
      });
    }
  }

  await registrarConsulta({
    actor,
    question: cleanQuestion,
    answer,
    intent,
    sources,
    latenciaMs: Date.now() - startedAt
  });

  return {
    answer,
    sources,
    intent,
    agent: obtenerAgente(agentId),
    ...(personalAgentId ? { agents: [obtenerAgente(policyAgentId), obtenerAgente(personalAgentId)] } : {})
  };
}

module.exports = {
  responderPregunta,
  filtrarCoincidenciasConfiables,
  LOW_SIMILARITY_THRESHOLD
};
