const { supabase } = require('../../config/supabase');
const { generarEmbeddings } = require('./embedding.service');

const MAX_HISTORY_MESSAGES = 8;
const MAX_QUESTION_LENGTH = 4000;

async function buscarContexto(question) {
  const [embedding] = await generarEmbeddings([question]);
  const { data, error } = await supabase.rpc('match_document_chunks', {
    query_embedding: embedding,
    match_count: 5,
    match_threshold: 0.25
  });

  if (error) throw new Error(`Falló la búsqueda vectorial en Supabase: ${error.message}`);
  return data || [];
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

async function responderPregunta(question, history = []) {
  if (typeof question !== 'string' || !question.trim() || question.length > MAX_QUESTION_LENGTH) {
    throw new TypeError(`La pregunta debe tener entre 1 y ${MAX_QUESTION_LENGTH} caracteres`);
  }

  const matches = await buscarContexto(question.trim());
  if (matches.length === 0) {
    return { answer: 'No encontré información relevante en los documentos indexados.', sources: [] };
  }

  const sources = matches.map((match, index) => ({
    index: index + 1,
    fileId: match.file_id,
    fileName: match.file_name,
    similarity: match.similarity
  }));
  const context = matches.map((match, index) =>
    `[${index + 1}] ${match.file_name}\n${match.content}`
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

  const answer = await consultarDeepSeek([
    {
      role: 'system',
      content: 'Responde en español como asistente de Recursos Humanos. Basa la respuesta únicamente en el contexto documental. Si el contexto no responde la pregunta, dilo claramente. Cita cada afirmación factual con el número de fuente entre corchetes, por ejemplo [1]. No inventes políticas ni normas.'
    },
    ...priorMessages,
    {
      role: 'user',
      content: `Pregunta: ${question.trim()}\n\nContexto recuperado:\n${context}`
    }
  ]);

  return { answer, sources };
}

module.exports = { responderPregunta };
