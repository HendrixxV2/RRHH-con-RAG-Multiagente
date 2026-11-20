const test = require('node:test');
const assert = require('node:assert/strict');
const { resolverActor } = require('../src/services/auth.service');

function requestWithAuthorization(authorization) {
  return {
    get(name) {
      return name.toLowerCase() === 'authorization' ? authorization : undefined;
    }
  };
}

function databaseFor({ user, employee = null, lookupError = null, authError = null }) {
  let queriedEmail;
  const database = {
    auth: {
      async getUser(token) {
        assert.equal(token, 'valid-token');
        return { data: { user }, error: authError };
      }
    },
    from(table) {
      assert.equal(table, 'colaboradores');
      return {
        select() {
          return this;
        },
        eq(column, value) {
          assert.equal(column, 'email');
          queriedEmail = value;
          return this;
        },
        async maybeSingle() {
          return { data: employee, error: lookupError };
        }
      };
    },
    get queriedEmail() {
      return queriedEmail;
    }
  };
  return database;
}

test('resuelve el rol desde colaboradores y normaliza el correo autenticado', async () => {
  const employee = { id: 'EMP-002', email: 'person@example.test', rol: 'colaborador' };
  const database = databaseFor({
    user: {
      email: '  Person@Example.Test ',
      user_metadata: { employee_id: 'EMP-001', role: 'rrhh' }
    },
    employee
  });

  const actor = await resolverActor(requestWithAuthorization('Bearer valid-token'), database);
  assert.equal(actor, employee);
  assert.equal(database.queriedEmail, 'person@example.test');
});

test('no confía en user_metadata para vincular una cuenta ni asignar un rol', async () => {
  const database = databaseFor({
    user: {
      email: 'unknown@example.test',
      user_metadata: { employee_id: 'EMP-001', role: 'rrhh' }
    }
  });

  await assert.rejects(
    resolverActor(requestWithAuthorization('Bearer valid-token'), database),
    error => error.status === 403 && /no está vinculada/.test(error.message)
  );
});

test('rechaza tokens inválidos y errores al consultar el perfil', async () => {
  const invalidDatabase = databaseFor({
    user: null,
    authError: new Error('invalid token')
  });
  await assert.rejects(
    resolverActor(requestWithAuthorization('Bearer valid-token'), invalidDatabase),
    error => error.status === 401
  );

  const failedLookup = databaseFor({
    user: { email: 'person@example.test' },
    lookupError: new Error('database unavailable')
  });
  await assert.rejects(
    resolverActor(requestWithAuthorization('Bearer valid-token'), failedLookup),
    error => error.status === 500
  );
});
