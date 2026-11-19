const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const { responderPregunta } = require('./src/services/chat.service');

const app = express();
const port = Number(process.env.PORT) || 3001;
const allowedOrigins = new Set(
  (process.env.FRONTEND_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
);

app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && !allowedOrigins.has(origin)) {
    return res.status(403).json({ error: 'Origen no permitido' });
  }
  if (origin) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/chat', async (req, res) => {
  try {
    const { question, history } = req.body || {};
    const result = await responderPregunta(question, history);
    res.json(result);
  } catch (error) {
    console.error('❌ Error en /api/chat:', error.message);
    const status = error instanceof TypeError ? 400 : 500;
    res.status(status).json({ error: error.message });
  }
});

if (require.main === module) {
  app.listen(port, () => console.log(`✅ API RRHH disponible en http://localhost:${port}`));
}

module.exports = app;
