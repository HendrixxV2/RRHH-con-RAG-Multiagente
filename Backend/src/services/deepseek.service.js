async function completarDeepSeek({ messages, temperature = 0.2, maxTokens = 1200 }) {
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
      temperature,
      max_tokens: maxTokens,
      stream: false
    })
  });

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(`DeepSeek respondió ${response.status} con un formato inválido`);
  }

  if (!result || typeof result !== 'object') {
    throw new Error(`DeepSeek respondió ${response.status} con un formato inválido`);
  }

  if (!response.ok) {
    throw new Error(`DeepSeek respondió ${response.status}: ${result.error?.message || 'error desconocido'}`);
  }

  const answer = result.choices?.[0]?.message?.content;
  if (typeof answer !== 'string' || !answer.trim()) {
    throw new Error('DeepSeek devolvió una respuesta vacía');
  }
  return answer.trim();
}

module.exports = { completarDeepSeek };
