const test = require('node:test');
const assert = require('node:assert/strict');
const { redactarResumen } = require('../src/services/analyst.service');

test('el resumen sin proveedor de IA mantiene cuatro frases ejecutivas', async () => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;

  try {
    const resumen = await redactarResumen({
      consultas_30_dias: 12,
      latencia_p90_ms: 900,
      ausencias_30_dias: 3,
      dias_ausencia_30_dias: 7,
      solicitudes_pendientes_mas_3_dias: 2,
      retiros_30_dias: 1,
      pasivo_vacaciones_mas_20_dias: 4
    });

    assert.equal((resumen.match(/\./g) || []).length, 4);
    assert.match(resumen, /12 consultas/);
  } finally {
    if (apiKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = apiKey;
  }
});
