const { supabase } = require('../../config/supabase');
const { generarEmbeddings } = require('./embedding.service');
const { clasificarConsulta, INTENTS } = require('./orchestrator.service');
const { consultarDatosColaborador, resumirDatosPersonales } = require('./employee-data.service');

const MAX_HISTORY_MESSAGES = 8;
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

async function consultarDeepSeek(messages) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('Falta configurar DEEPSEEK_API_KEY en Backend/.env');

  const baseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-flash',
      messages,
      temperature: 0.2,
      max_tokens: 1200,
      stream: false
    })
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(`DeepSeek respondió ${response.status}: ${result.error?.message || 'error desconocido'}`);
  }

  const answer = result.choices?.[0]?.message?.content;
  if (typeof answer !== 'string' || !answer.trim()) {
    throw new Error('DeepSeek devolvió una respuesta vacía');
  }
  return answer.trim();
}

async function responderPregunta(question, history = [], actor = null) {
  const startedAt = Date.now();
  if (typeof question !== 'string' || !question.trim() || question.length > MAX_QUESTION_LENGTH) {
    throw new TypeError(`La pregunta debe tener entre 1 y ${MAX_QUESTION_LENGTH} caracteres`);
  }

  const cleanQuestion = question.trim();
  const intent = clasificarConsulta(cleanQuestion);
  let answer;
  let sources = [];

  if (intent === INTENTS.RESTRICTED) {
    answer = 'No puedo consultar ni revelar datos personales de terceros. Puedo ayudarte con tus propios datos o con una consulta general de políticas.';
  } else if (intent === INTENTS.OUT_OF_SCOPE) {
    answer = 'Esta consulta está fuera de mi alcance como asistente de Recursos Humanos. Solo puedo atender políticas internas y datos personales del usuario autenticado.';
  } else {
    let personalText = '';
    if (intent === INTENTS.PERSONAL || intent === INTENTS.MIXED) {
      const personalData = await consultarDatosColaborador(actor);
      personalText = resumirDatosPersonales(personalData);
    }

    if (intent === INTENTS.PERSONAL) {
      answer = personalText;
    } else {
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

        const priorMessages = Array.isArray(history)
          ? history
            .filter(message =>
              message &&
              ['user', 'assistant'].includes(message.role) &&
              typeof message.content === 'string'
            )
            .slice(-MAX_HISTORY_MESSAGES)
            .map(message => ({ role: message.role, content: message.content.slice(0, MAX_QUESTION_LENGTH) }))
          : [];

        const policyAnswer = await consultarDeepSeek([
          {
            role: 'system',
            content: 'Responde en español como asistente de Recursos Humanos. Basa la respuesta únicamente en el contexto documental. Si el contexto no responde la pregunta, dilo claramente. Cita cada afirmación factual con el número de fuente entre corchetes, por ejemplo [1]. No inventes políticas ni normas. No reveles datos de terceros.'
          },
          ...priorMessages,
          {
            role: 'user',
            content: `Pregunta: ${cleanQuestion}\n\nContexto recuperado:\n${context}${personalText ? `\n\nDatos propios del usuario autenticado:\n${personalText}` : ''}`
          }
        ]);
        answer = policyAnswer;
      }
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

  return { answer, sources, intent };
}

module.exports = { responderPregunta };
