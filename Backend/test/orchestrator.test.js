const test = require('node:test');
const assert = require('node:assert/strict');
const { clasificarConsulta, INTENTS } = require('../src/services/orchestrator.service');

test('clasifica consultas de políticas', () => {
  assert.equal(clasificarConsulta('¿Cómo funcionan las vacaciones?'), INTENTS.POLICY);
});

test('clasifica datos personales propios', () => {
  assert.equal(clasificarConsulta('¿Cuál es mi saldo de vacaciones?'), INTENTS.PERSONAL);
});

test('clasifica preguntas personales con políticas como mixtas', () => {
  assert.equal(
    clasificarConsulta('¿Cuál es mi saldo de vacaciones y cómo funciona la política para solicitarlas?'),
    INTENTS.MIXED
  );
  assert.equal(clasificarConsulta('¿Qué datos hay en mi perfil?'), INTENTS.PERSONAL);
});

test('rechaza consultas sobre terceros', () => {
  assert.equal(clasificarConsulta('¿Cuánto gana el empleado Juan Pérez?'), INTENTS.RESTRICTED);
  assert.equal(clasificarConsulta('¿Cuál es el saldo de vacaciones de Juan Pérez?'), INTENTS.RESTRICTED);
});
