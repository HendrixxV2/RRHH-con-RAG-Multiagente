const { supabase } = require('../../config/supabase');
const { generarEmbeddings } = require('./embedding.service');
const { clasificarConsulta, seleccionarAgente, INTENTS } = require('./orchestrator.service');
const {
  consultarDatosColaborador,
  resumirDatosPersonales,
  resumirPerfilPersonal,
  resumirSolicitudesPersonales
} = require('./employee-data.service');
const { ejecutarAgente, obtenerAgente, coordinarConsulta, AGENT_IDS } = require('./agents.service');

const MAX_QUESTION_LENGTH = 4000;

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
  const fallbackAgentId = seleccionarAgente(cleanQuestion, intent);
  const agentId = intent === INTENTS.PERSONAL
    ? await coordinarConsulta({
      question: cleanQuestion,
      candidateIds: [AGENT_IDS.PROFILE, AGENT_IDS.REQUESTS],
      fallbackId: fallbackAgentId
    })
    : fallbackAgentId;
  let answer;
  let sources = [];

  if (intent === INTENTS.RESTRICTED) {
    answer = 'No puedo consultar ni revelar datos personales de terceros. Puedo ayudarte con tus propios datos o con una consulta general de políticas.';
  } else if (intent === INTENTS.OUT_OF_SCOPE) {
    answer = 'Esta consulta está fuera de mi alcance como asistente de Recursos Humanos. Solo puedo atender políticas internas y datos personales del usuario autenticado.';
  } else if (intent === INTENTS.PERSONAL) {
    const personalData = await consultarDatosColaborador(actor);
    const context = agentId === AGENT_IDS.REQUESTS
      ? resumirSolicitudesPersonales(personalData)
      : resumirPerfilPersonal(personalData);
    answer = await ejecutarAgente(agentId, { question: cleanQuestion, context });
  } else {
    let personalText = '';
    if (intent === INTENTS.MIXED) {
      const personalData = await consultarDatosColaborador(actor);
      personalText = resumirDatosPersonales(personalData);
    }

    const matches = await buscarContexto(cleanQuestion);
    if (matches.length === 0) {
      answer = personalText
        ? `${personalText}\n\nNo encontré información adicional relevante en las políticas indexadas.`
        : 'No encontré información relevante en los documentos indexados.';
    } else {
      sources = matches.map((match, index) => ({
        index: index + 1,
        fileId: match.file_id,
        fileName: match.metadata?.nombre_doc || match.file_id,
        section: match.metadata?.sección || 'General',
        version: match.metadata?.versión || null,
        link: match.metadata?.enlace || null,
        similarity: match.similarity
      }));
      const context = matches.map((match, index) =>
        `[${index + 1}] ${match.metadata?.nombre_doc || match.file_id}\nSección: ${match.metadata?.sección || 'General'}\n${match.content}`
      ).join('\n\n');

      answer = await ejecutarAgente(agentId, {
        question: cleanQuestion,
        context: `${context}${personalText ? `\n\nDatos propios del usuario autenticado:\n${personalText}` : ''}`,
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

  return { answer, sources, intent, agent: obtenerAgente(agentId) };
}

module.exports = { responderPregunta };
