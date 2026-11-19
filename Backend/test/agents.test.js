const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AGENT_IDS,
  coordinarConsulta,
  ejecutarAgente,
  listarAgentes,
  obtenerAgente
} = require('../src/services/agents.service');
const { clasificarConsulta, seleccionarAgente, INTENTS } = require('../src/services/orchestrator.service');
const {
  resumirPerfilPersonal,
  resumirSolicitudesPersonales
} = require('../src/services/employee-data.service');

test('registra cinco agentes y enruta cada ámbito al especialista correspondiente', () => {
  assert.equal(listarAgentes().length, 5);
  assert.equal(seleccionarAgente('¿Cómo funcionan las vacaciones?'), AGENT_IDS.POLICIES);
  assert.equal(seleccionarAgente('¿Cuál es mi saldo de vacaciones?'), AGENT_IDS.REQUESTS);
  assert.equal(seleccionarAgente('¿Cuál es mi departamento?'), AGENT_IDS.PROFILE);
  assert.equal(seleccionarAgente('¿Cuánto gana otro empleado?'), AGENT_IDS.COORDINATOR);
});

test('cada especialista usa el cliente compartido con la clave en el servidor', async t => {
  const previousKey = process.env.DEEPSEEK_API_KEY;
  const previousFetch = global.fetch;
  t.after(() => {
    if (previousKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousKey;
    global.fetch = previousFetch;
  });

  process.env.DEEPSEEK_API_KEY = 'test-secret';
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '  Respuesta de prueba  ' } }] })
    };
  };

  const answer = await ejecutarAgente(AGENT_IDS.REQUESTS, {
    question: '¿Cuál es el estado de mi solicitud?',
    context: 'Solicitud propia: vacaciones, pendiente'
  });

  assert.equal(answer, 'Respuesta de prueba');
  assert.equal(request.url, 'https://api.deepseek.com/chat/completions');
  assert.equal(request.options.headers.Authorization, 'Bearer test-secret');
  assert.equal(JSON.parse(request.options.body).messages[0].role, 'system');
  assert.match(JSON.parse(request.options.body).messages[1].content, /Solicitud propia/);
});

test('el coordinador de DeepSeek solo puede elegir entre las rutas permitidas', async t => {
  const previousKey = process.env.DEEPSEEK_API_KEY;
  const previousFetch = global.fetch;
  t.after(() => {
    if (previousKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousKey;
    global.fetch = previousFetch;
  });

  process.env.DEEPSEEK_API_KEY = 'test-secret';
  let responseContent = AGENT_IDS.PROFILE;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: responseContent } }] })
  });

  const candidates = [AGENT_IDS.PROFILE, AGENT_IDS.REQUESTS];
  const options = { question: '¿Cuál es mi saldo?', candidateIds: candidates, fallbackId: AGENT_IDS.REQUESTS };
  assert.equal(await coordinarConsulta(options), AGENT_IDS.PROFILE);

  responseContent = 'perfil\nTambién responde esta pregunta';
  assert.equal(await coordinarConsulta(options), AGENT_IDS.REQUESTS);
  await assert.rejects(
    coordinarConsulta({ ...options, candidateIds: [AGENT_IDS.PROFILE], fallbackId: AGENT_IDS.REQUESTS }),
    /opciones válidas/
  );
});

test('los agentes personales reciben solo el contexto de su ámbito', () => {
  const data = {
    perfil: {
      departamento: 'Tecnología',
      cargo: 'Analista',
      fecha_ingreso: '2024-01-15',
      activo: true,
      email: 'privado@example.test'
    },
    vacaciones: { dias_disponibles: 8, dias_usados: 2, periodo: '2026' },
    solicitudes: [{ tipo: 'vacaciones', estado: 'pendiente', fecha_solicitud: '2026-03-01' }],
    incapacidades: []
  };

  const profileContext = resumirPerfilPersonal(data);
  const requestsContext = resumirSolicitudesPersonales(data);
  assert.match(profileContext, /Tecnología/);
  assert.doesNotMatch(profileContext, /privado@example\.test|vacaciones/);
  assert.match(requestsContext, /vacaciones/);
  assert.doesNotMatch(requestsContext, /Tecnología|privado@example\.test/);
});

test('el filtro local bloquea terceros y la falta de clave falla explícitamente', async t => {
  const previousKey = process.env.DEEPSEEK_API_KEY;
  const previousFetch = global.fetch;
  t.after(() => {
    if (previousKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousKey;
    global.fetch = previousFetch;
  });

  delete process.env.DEEPSEEK_API_KEY;
  global.fetch = async () => {
    throw new Error('No debe llamar al proveedor');
  };

  assert.equal(clasificarConsulta('¿Cuánto gana el empleado Juan Pérez?'), INTENTS.RESTRICTED);
  assert.equal(obtenerAgente(AGENT_IDS.COORDINATOR).name, 'Coordinador de RR. HH.');
  await assert.rejects(
    ejecutarAgente(AGENT_IDS.POLICIES, { question: 'Pregunta', context: 'Contexto' }),
    /Falta configurar DEEPSEEK_API_KEY/
  );
});
