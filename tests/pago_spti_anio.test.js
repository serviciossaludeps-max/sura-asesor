/* Pruebas · tasa SPTI por año de pago (6 % en 2024–2025, 7 % en 2026) y comisión por asegurado.
   Ejecutar: node tests/pago_spti_anio.test.js */
const path = require('path');
const assert = require('assert');
const REPO = process.env.SS_REPO || path.join(__dirname, '..');
global.window = globalThis;
window.BusinessConfig = {};
for (const f of ['constants', 'commissions', 'pricing']) require(path.join(REPO, 'business-config', f + '.js'));
require(path.join(REPO, 'src/business-core/motors/producto/index.js'));
require(path.join(REPO, 'src/business-core/motors/pago/index.js'));
for (const f of ['resolver-edad', 'comision-asegurados']) require(path.join(REPO, 'src/business-core/motors/pago', f + '.js'));
const MPago = globalThis.MotorPago, E1 = globalThis.MotorPagoE1;

let pass = 0, fail = 0;
function t(nombre, fn) {
  try { fn(); pass++; console.log('PASS  ' + nombre); }
  catch (e) { fail++; console.log('FAIL  ' + nombre + '\n      ' + e.message); }
}

// --- tasa SPTI por año de pago ---
t('SPTI sin fecha de pago conserva el 7 % anterior (compatibilidad con el CRM)', () => {
  assert.strictEqual(MPago.calcularPorcentajeComision('SPTI', 35), 0.07);
});
t('SPTI pagado en 2024 -> 6 %', () => assert.strictEqual(MPago.calcularPorcentajeComision('SPTI', 35, '2024-03-10'), 0.06));
t('SPTI pagado en 2025 -> 6 % (incluye fecha tipo Date)', () => {
  assert.strictEqual(MPago.calcularPorcentajeComision('SPTI', 35, '2025-11-28'), 0.06);
  assert.strictEqual(MPago.calcularPorcentajeComision('SPTI', 35, new Date(2025, 5, 1)), 0.06);
});
t('SPTI pagado en 2026 -> 7 %', () => assert.strictEqual(MPago.calcularPorcentajeComision('SPTI', 35, '2026-07-14'), 0.07));
t('SPTI pagado en un año sin tasa definida -> null (no se inventa)', () => assert.strictEqual(MPago.calcularPorcentajeComision('SPTI', 35, '2027-01-05'), null));
t('PSM no cambia por la fecha: 40 años 12 %, 55 años 6 % (BR-016)', () => {
  assert.strictEqual(MPago.calcularPorcentajeComision('PSM', 40, '2025-05-01'), 0.12);
  assert.strictEqual(MPago.calcularPorcentajeComision('PSM', 55, '2025-05-01'), 0.06);
});
t('PAC60 no cambia por la fecha: 5 %', () => assert.strictEqual(MPago.calcularPorcentajeComision('PAC60', 65, '2025-05-01'), 0.05));
t('SPD no cambia por la fecha: 8 %', () => assert.strictEqual(MPago.calcularPorcentajeComision('SPD', null, '2025-05-01'), 0.08));

// --- comisión por asegurado SPTI, tasa del año de pago ---
const GRUPO = { producto: 'SPTI', plan: 'CLASICO', periodicidad: 'MENSUAL', fechaExp: '2025-03-10', asegurados: [
  { fechaNac: '1985-03-10', primaTotalSinIVA: 140457 },
  { fechaNac: '1990-06-01', primaTotalSinIVA: 140457 }
]};
t('grupo SPTI pagado en 2025: cada asegurado 6 % y suma 16.854', () => {
  const r = E1.comisionPoliza(GRUPO, '2025-04-10');
  assert.strictEqual(r.estado, 'OK');
  assert.deepStrictEqual(r.comisionPorAsegurado.map(d => d.pct), [0.06, 0.06]);
  assert.strictEqual(r.comision, 16854);
});
t('grupo SPTI, primer ciclo pagado en 2026: cada asegurado 7 % y suma 19.664', () => {
  const g26 = Object.assign({}, GRUPO, { fechaExp: '2026-01-10' });
  const r = E1.comisionPoliza(g26, '2026-02-10');
  assert.strictEqual(r.estado, 'OK');
  assert.deepStrictEqual(r.comisionPorAsegurado.map(d => d.pct), [0.07, 0.07]);
  assert.strictEqual(r.comision, 19664);
});
t('grupo SPTI, segundo ciclo pagado en 2026: tabla 2026 a la renovación (41 y 35 años) = 20.586', () => {
  const r = E1.comisionPoliza(GRUPO, '2026-04-10');
  assert.strictEqual(r.estado, 'OK');
  assert.deepStrictEqual(r.comisionPorAsegurado.map(d => d.comision), [10754, 9832]);
  assert.strictEqual(r.comision, 20586);
});
t('grupo SPTI pagado en un año sin tasa: BLOQUEADO, sin valor parcial', () => {
  const r = E1.comisionPoliza(GRUPO, '2027-04-10');
  assert.notStrictEqual(r.estado, 'OK');
  assert.strictEqual(r.comision, null);
});

console.log(`\nResultado: ${pass} PASS · ${fail} FAIL`);
process.exit(fail ? 1 : 0);
