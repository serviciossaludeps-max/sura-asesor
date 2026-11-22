/* SPD 2025: tabla de tarifas y comisión de ciclo >= 1 con tasa del año de pago (7 % en 2025).
   Ejecutar: node tests/pago_spd_2025.test.js */
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
function t(nombre, fn) { try { fn(); pass++; console.log('PASS  ' + nombre); } catch (e) { fail++; console.log('FAIL  ' + nombre + '\n      ' + e.message); } }

t('tabla SPD 2025 sin IVA = valores confirmados por el PO', () => {
  const s = MP.tablasDelAnio(2025).SPD.sinIVA;
  assert.deepStrictEqual(s, { MENSUAL: 87603, TRIMESTRAL: 257633, SEMESTRAL: 501848, ANUAL: 956465 });
});
t('SPD 2026 no cambia (sigue en 92.070 mensual sin IVA)', () => {
  assert.strictEqual(MP.tablasDelAnio(2026).SPD.sinIVA.MENSUAL, 92070);
});
t('SPD ciclo 1 con aniversario en 2025 y pago 2025: base de tabla 2025 x 7 % = 6.132', () => {
  const r = E1.comisionPoliza({ producto: 'SPD', periodicidad: 'MENSUAL', fechaExp: '2024-06-01' }, '2025-07-10');
  assert.strictEqual(r.estado, 'OK');
  assert.strictEqual(r.comisionPorAsegurado[0].base, 87603);
  assert.strictEqual(r.comisionPorAsegurado[0].pct, 0.07);
  assert.strictEqual(r.comision, 6132);
});
t('SPD ciclo 1 con aniversario en 2026 sigue usando la tabla 2026 (8 %)', () => {
  const r = E1.comisionPoliza({ producto: 'SPD', periodicidad: 'MENSUAL', fechaExp: '2025-06-01' }, '2026-07-10');
  assert.strictEqual(r.estado, 'OK');
  assert.strictEqual(r.comisionPorAsegurado[0].base, 92070);
});

console.log('\nResultado: ' + pass + ' PASS · ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
