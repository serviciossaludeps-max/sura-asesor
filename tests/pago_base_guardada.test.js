/* Opción A · base guardada SPTI del primer ciclo validada contra la tabla SIN IVA.
   Ejecutar: node tests/pago_base_guardada.test.js */
const path = require('path');
const assert = require('assert');
const REPO = process.env.SS_REPO || path.join(__dirname, '..');
global.window = globalThis;
window.BusinessConfig = {};
for (const f of ['constants', 'commissions', 'pricing']) require(path.join(REPO, 'business-config', f + '.js'));
require(path.join(REPO, 'src/business-core/motors/producto/index.js'));
require(path.join(REPO, 'src/business-core/motors/pago/index.js'));
for (const f of ['resolver-edad', 'comision-asegurados']) require(path.join(REPO, 'src/business-core/motors/pago', f + '.js'));
const E1 = globalThis.MotorPagoE1, MP = globalThis.MotorProducto;

let pass = 0, fail = 0;
function t(nombre, fn) {
  try { fn(); pass++; console.log('PASS  ' + nombre); }
  catch (e) { fail++; console.log('FAIL  ' + nombre + '\n      ' + e.message); }
}
// Valores tomados de las tablas, no escritos a mano
const sin = (anio, plan, rango, campo) => MP.tablasDelAnio(anio).SPTI_SIN_IVA[plan][rango][campo];
const con = (v) => Math.round(v * 1.05);

t('base guardada = tabla SIN IVA de 2026 -> OK, base usada y comisión 7 %', () => {
  const v = sin(2026, 'PREFERENCIAL', '0-40', 'mensual');
  const r = E1.comisionPoliza({ producto: 'SPTI', plan: 'PREFERENCIAL', periodicidad: 'MENSUAL', fechaExp: '2026-03-10', primaTotalSinIVA: v, asegurados: [{ fechaNac: '1990-01-01' }] }, '2026-04-10');
  assert.strictEqual(r.estado, 'OK');
  assert.strictEqual(r.comisionPorAsegurado[0].base, v);
  assert.strictEqual(r.comision, Math.round(v * 0.07));
});
t('base guardada = tabla CON IVA (dato incorrecto) -> BLOQUEADA, sin valor parcial', () => {
  const v = sin(2026, 'PREFERENCIAL', '0-40', 'mensual');
  const r = E1.comisionPoliza({ producto: 'SPTI', plan: 'PREFERENCIAL', periodicidad: 'MENSUAL', fechaExp: '2026-03-10', primaTotalSinIVA: con(v), asegurados: [{ fechaNac: '1990-01-01' }] }, '2026-04-10');
  assert.strictEqual(r.estado, 'BLOQUEADO');
  assert.strictEqual(r.motivo, 'BASE_GUARDADA_INCONSISTENTE');
  assert.strictEqual(r.comision, null);
});
t('base guardada a 1 peso de la tabla (redondeo) -> OK', () => {
  const v = sin(2025, 'PREFERENCIAL', '41-50', 'mensual');
  const r = E1.comisionPoliza({ producto: 'SPTI', plan: 'PREFERENCIAL', periodicidad: 'MENSUAL', fechaExp: '2025-06-12', primaTotalSinIVA: v + 1, asegurados: [{ fechaNac: '1982-01-01' }] }, '2025-07-10');
  assert.strictEqual(r.estado, 'OK');
});
t('enero 2026 (oferta): base de la tabla 2025 se acepta', () => {
  const v = sin(2025, 'PREFERENCIAL', '0-40', 'mensual');
  const r = E1.comisionPoliza({ producto: 'SPTI', plan: 'PREFERENCIAL', periodicidad: 'MENSUAL', fechaExp: '2026-01-10', primaTotalSinIVA: v, asegurados: [{ fechaNac: '1990-01-01' }] }, '2026-02-10');
  assert.strictEqual(r.estado, 'OK');
});
t('fuera de enero 2026: la tabla 2025 ya no se acepta -> BLOQUEADA', () => {
  const v = sin(2025, 'PREFERENCIAL', '0-40', 'mensual');
  const r = E1.comisionPoliza({ producto: 'SPTI', plan: 'PREFERENCIAL', periodicidad: 'MENSUAL', fechaExp: '2026-03-10', primaTotalSinIVA: v, asegurados: [{ fechaNac: '1990-01-01' }] }, '2026-04-10');
  assert.strictEqual(r.motivo, 'BASE_GUARDADA_INCONSISTENTE');
});
t('ciclo >= 1 no usa la base guardada: no cambia', () => {
  const r = E1.comisionPoliza({ producto: 'SPTI', plan: 'PREFERENCIAL', periodicidad: 'MENSUAL', fechaExp: '2025-03-10', primaTotalSinIVA: con(999999), asegurados: [{ fechaNac: '1985-03-10' }] }, '2026-04-10');
  assert.strictEqual(r.estado, 'OK');
  assert.notStrictEqual(r.comisionPorAsegurado[0].fuenteBase, 'GUARDADO');
});
t('PSM no cambia por esta regla (solo SPTI)', () => {
  const r = E1.comisionPoliza({ producto: 'PSM', periodicidad: 'MENSUAL', fechaExp: '2026-03-10', asegurados: [{ fechaNac: '1990-01-01', primaTotalSinIVA: 100000 }] }, '2026-04-10');
  assert.notStrictEqual(r.motivo, 'BASE_GUARDADA_INCONSISTENTE');
});

console.log(`\nResultado: ${pass} PASS · ${fail} FAIL`);
process.exit(fail ? 1 : 0);
