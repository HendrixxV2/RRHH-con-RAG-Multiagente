const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');

test('API health and chat validation are reachable', async t => {
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const health = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: 'http://localhost:5173' }
  });
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('access-control-allow-origin'), 'http://localhost:5173');

  const invalidChat = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: '' })
  });
  assert.equal(invalidChat.status, 400);

  const blockedOrigin = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: 'https://not-allowed.example' }
  });
  assert.equal(blockedOrigin.status, 403);
});
