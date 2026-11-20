const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const { responderPregunta } = require('./src/services/chat.service');
const { resolverActor } = require('./src/services/auth.service');
const { consultarDatosColaborador } = require('./src/services/employee-data.service');
const { generarReporteDiario, obtenerDashboard } = require('./src/services/analyst.service');
const { ingestirCarpetaDrive } = require('./src/services/ingest.service');

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
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/chat', async (req, res) => {
  try {
    const actor = await resolverActor(req);
    const { question, history } = req.body || {};
    const result = await responderPregunta(question, history, actor);
    res.json(result);
  } catch (error) {
    console.error('❌ Error en /api/chat:', error.message);
    const status = error.status || (error instanceof TypeError ? 400 : 500);
    res.status(status).json({ error: error.message });
  }
});

app.get('/api/me', async (req, res) => {
  try {
    const actor = await resolverActor(req);
    const datos = await consultarDatosColaborador(actor);
    res.json({ actor, datos });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

async function requireRRHH(req, res, next) {
  try {
    const actor = await resolverActor(req);
    if (actor.rol !== 'rrhh') return res.status(403).json({ error: 'Acceso exclusivo para RRHH' });
    req.actor = actor;
    next();
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}

app.get('/api/dashboard', requireRRHH, async (req, res) => {
  try {
    res.json(await obtenerDashboard());
  } catch (error) {
    console.error('❌ Error en /api/dashboard:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/analyst/run', requireRRHH, async (req, res) => {
  try {
    res.json(await generarReporteDiario());
  } catch (error) {
    console.error('❌ Error ejecutando analista:', error.message);
    res.status(500).json({ error: error.message });
  }
});

function programarTareaDiaria(nombre, hora, tarea) {
  let ultimaEjecucion;
  let siguienteIntento = 0;
  let enCurso = false;

  setInterval(async () => {
    const now = new Date();
    const partes = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Costa_Rica',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(now).map(({ type, value }) => [type, value]));
    const fecha = `${partes.year}-${partes.month}-${partes.day}`;
    if (Number(partes.hour) >= hora && ultimaEjecucion !== fecha && !enCurso && now.getTime() >= siguienteIntento) {
      enCurso = true;
      try {
        const resultado = await tarea();
        ultimaEjecucion = fecha;
        siguienteIntento = 0;
        console.log(`✅ ${nombre} completado:`, resultado);
      } catch (error) {
        siguienteIntento = now.getTime() + 15 * 60 * 1000;
        console.error(`❌ Falló ${nombre}:`, error.message);
      } finally {
        enCurso = false;
      }
    }
  }, 60 * 1000);
}

function ejecutarAnalistaEnHorario() {
  programarTareaDiaria('Reporte diario de RR. HH.', 7, generarReporteDiario);
}

function sincronizarDriveEnHorario() {
  programarTareaDiaria('Sincronización diaria de Drive', 6, ingestirCarpetaDrive);
}

if (require.main === module) {
  app.listen(port, () => console.log(`✅ API RRHH disponible en http://localhost:${port}`));
  ejecutarAnalistaEnHorario();
  sincronizarDriveEnHorario();
}

module.exports = app;
