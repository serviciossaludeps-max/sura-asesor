/* Opción 2: venta individual (sin array de asegurados) calculada como titular único.
   Ejecutar: node tests/pago_individual.test.js */
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
const B = MP.tablasDelAnio(2026).SPTI_SIN_IVA.PREFERENCIAL['0-40'].mensual; // 159.120
const con = (v) => Math.round(v * 1.05);

const SPTI_IND = { producto: 'SPTI', plan: 'PREFERENCIAL', periodicidad: 'MENSUAL', fechaExp: '2026-08-22',
  doc: '1001', fechaNac: '1990-01-01', primaTotalSinIVA: B, numAsegurados: 1 };
const PAC60_IND = { producto: 'PAC60', periodicidad: 'MENSUAL', fechaExp: '2026-03-10', doc: '5001',
  fechaNac: '1957-05-10', conAnexo: true, primaTotalSinIVA: 368757, numAsegurados: 1 };

t('I1 SPTI individual: comision 7 % de 159.120 = 11.138 (ya no SIN_ASEGURADOS)', () => {
  const r = E1.comisionPoliza(SPTI_IND, '2026-09-22');
  assert.strictEqual(r.estado, 'OK'); assert.strictEqual(r.comision, 11138);
  assert.strictEqual(r.comisionPorAsegurado.length, 1); assert.strictEqual(r.comisionPorAsegurado[0].rol, 'TITULAR');
});
t('I2 equivalencia: individual = misma poliza con un asegurado en array (mismo resultado)', () => {
  const conArray = Object.assign({}, SPTI_IND, { asegurados: [{ doc: '1001', fechaNac: '1990-01-01', primaTotalSinIVA: B }] });
  const a = E1.comisionPoliza(SPTI_IND, '2026-09-22'), b = E1.comisionPoliza(conArray, '2026-09-22');
  assert.strictEqual(a.comision, b.comision);
});
t('I3 PAC60 individual con conAnexo a nivel de venta: 5 % de 368.757 = 18.438 (caso real verificado)', () => {
  const r = E1.comisionPoliza(PAC60_IND, '2026-04-10');
  assert.strictEqual(r.estado, 'OK'); assert.strictEqual(r.comision, 18438);
});
t('I4 venta que declara 2 asegurados sin array -> ASEGURADOS_NO_REGISTRADOS (no se infiere)', () => {
  const r = E1.comisionPoliza(Object.assign({}, SPTI_IND, { numAsegurados: 2 }), '2026-09-22');
  assert.strictEqual(r.estado, 'BLOQUEADO'); assert.strictEqual(r.motivo, 'ASEGURADOS_NO_REGISTRADOS');
});
t('I5 cobro parcial individual con documento: 143.208 -> 10.025 asignado al titular', () => {
  const r = E1.comisionPoliza(SPTI_IND, '2026-09-11', { montoRecibido: con(143208), aseguradoRef: '1001', periodoDesde: '2026-08-22', id: 'i5' });
  assert.strictEqual(r.estado, 'OK'); assert.strictEqual(r.comision, 10025);
});
t('I6 cobro parcial individual sin documento del titular -> FALTA_ASEGURADO', () => {
  const sinDoc = Object.assign({}, SPTI_IND, { doc: undefined });
  const r = E1.comisionPoliza(sinDoc, '2026-09-11', { montoRecibido: con(143208), aseguradoRef: '1001', periodoDesde: '2026-08-22', id: 'i6' });
  assert.strictEqual(r.motivo, 'FALTA_ASEGURADO');
});
t('I7 SPTI individual sin plan sigue bloqueado (FALTA_PLAN)', () => {
  const r = E1.comisionPoliza(Object.assign({}, SPTI_IND, { plan: undefined }), '2026-09-22');
  assert.strictEqual(r.motivo, 'FALTA_PLAN');
});
t('I8 trazabilidad: fechaInicioRecibo no cambia la agrupacion (la clave es periodoDesde de la cuota)', () => {
  const prev = [{ id: 'r1', aseguradoRef: '1001', periodoDesde: '2026-08-22', baseCobrada: 143208, comision: 10025 }];
  const a = E1.comisionPoliza(SPTI_IND, '2026-10-05', { montoRecibido: con(15912), aseguradoRef: '1001', periodoDesde: '2026-08-22', id: 'r2', cobrosPrevios: prev });
  const b = E1.comisionPoliza(SPTI_IND, '2026-10-05', { montoRecibido: con(15912), aseguradoRef: '1001', periodoDesde: '2026-08-22', id: 'r2', fechaInicioRecibo: '2026-08-25', cobrosPrevios: prev });
  assert.strictEqual(a.comision, 1113); assert.strictEqual(b.comision, 1113);
});

console.log('\nResultado: ' + pass + ' PASS · ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
