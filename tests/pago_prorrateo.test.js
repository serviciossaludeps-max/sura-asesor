/* P-11: prorrateo por inicio de cobertura (primera cuota, convención 30/360, por asegurado).
   Ejecutar: node tests/pago_prorrateo.test.js */
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
const PERIODO = '2026-08-22';
const porRef = (r, ref) => r.comisionPorAsegurado.find(d => d.aseguradoRef === ref);
function poliza(inicioA, inicioB) {
  return { producto: 'SPTI', plan: 'PREFERENCIAL', periodicidad: 'MENSUAL', fechaExp: '2026-08-22',
    asegurados: [
      { doc: '1001', fechaNac: '1990-01-01', primaTotalSinIVA: B, inicioCobertura: inicioA },
      { doc: '1002', fechaNac: '1992-01-01', primaTotalSinIVA: B, inicioCobertura: inicioB } ] };
}

t('P1 caso 1729322: B inicia 25/08 -> base de cuota 143.208 (27/30 de 159.120)', () => {
  const r = E1.comisionPoliza(poliza('2026-08-22', '2026-08-25'), '2026-09-11');
  assert.strictEqual(r.estado, 'OK');
  const b = porRef(r, '1002');
  assert.strictEqual(b.base, 143208); assert.strictEqual(b.diasNoCubiertos, 3); assert.strictEqual(b.prorrateo, true);
  assert.strictEqual(b.fuenteBase.indexOf('+PRORRATEO') > 0, true);
});
t('P2 caso 1729322: cobro de B de 143.208 cubre TODA su cuota: pago 10.025', () => {
  const r = E1.comisionPoliza(poliza('2026-08-22', '2026-08-25'), '2026-09-11',
    { montoRecibido: con(143208), aseguradoRef: '1002', periodoDesde: PERIODO, id: 'p2' });
  assert.strictEqual(r.estado, 'OK'); assert.strictEqual(r.comision, 10025);
});
t('P3 sin saldo falso: un cobro posterior de 15.912 a B no genera pago (excedente, no 1.113)', () => {
  const prev = [{ id: 'p2', aseguradoRef: '1002', periodoDesde: PERIODO, baseCobrada: 143208, comision: 10025 }];
  const r = E1.comisionPoliza(poliza('2026-08-22', '2026-08-25'), '2026-10-05',
    { montoRecibido: con(15912), aseguradoRef: '1002', periodoDesde: PERIODO, id: 'p3', cobrosPrevios: prev });
  assert.strictEqual(r.comision, 0); assert.strictEqual(porRef(r, '1002').excedenteBase, 15912);
});
t('P4 A sin prorrateo (inicia con la cuota): base 159.120 y pago 11.138', () => {
  const r = E1.comisionPoliza(poliza('2026-08-22', '2026-08-22'), '2026-09-22');
  assert.strictEqual(porRef(r, '1001').base, B); assert.strictEqual(porRef(r, '1001').prorrateo, false);
});
t('P5 sin fecha de inicio: no se aplica prorrateo (comportamiento anterior)', () => {
  const p = poliza(undefined, undefined);
  const r = E1.comisionPoliza(p, '2026-09-22');
  assert.strictEqual(porRef(r, '1002').base, B); assert.strictEqual(r.comision, 22276);
});
t('P6 inicio fuera de la primera cuota (>= 30 días) -> INICIO_COBERTURA_FUERA_DE_CUOTA', () => {
  const r = E1.comisionPoliza(poliza('2026-08-22', '2026-09-22'), '2026-10-05');
  assert.strictEqual(r.estado, 'BLOQUEADO'); assert.strictEqual(r.motivo, 'INICIO_COBERTURA_FUERA_DE_CUOTA');
});
t('P7 fecha de inicio inválida -> FECHA_INICIO_COBERTURA_INVALIDA', () => {
  const r = E1.comisionPoliza(poliza('2026-08-22', '25/08/2026'), '2026-09-11');
  assert.strictEqual(r.motivo, 'FECHA_INICIO_COBERTURA_INVALIDA');
});
t('P8 convención 30/360: fechaExp 31/08 e inicio 01/09 -> 29 de 30 días: 159.120 × 29/30 = 153.816', () => {
  const p = { producto: 'SPTI', plan: 'PREFERENCIAL', periodicidad: 'MENSUAL', fechaExp: '2026-08-31',
    asegurados: [{ doc: '1001', fechaNac: '1990-01-01', primaTotalSinIVA: B, inicioCobertura: '2026-09-01' }] };
  const r = E1.comisionPoliza(p, '2026-09-20');
  assert.strictEqual(porRef(r, '1001').diasNoCubiertos, 1); assert.strictEqual(porRef(r, '1001').base, 153816);
});
t('P9 venta individual con inicio de cobertura: 143.208 x 7 % = 10.025', () => {
  const ind = { producto: 'SPTI', plan: 'PREFERENCIAL', periodicidad: 'MENSUAL', fechaExp: '2026-08-22',
    doc: '1001', fechaNac: '1990-01-01', primaTotalSinIVA: B, numAsegurados: 1, inicioCobertura: '2026-08-25' };
  const r = E1.comisionPoliza(ind, '2026-09-11');
  assert.strictEqual(r.estado, 'OK'); assert.strictEqual(r.comision, 10025);
});
t('P10 fecha de inicio igual a un mes completo después: no es primera cuota -> bloqueo', () => {
  const r = E1.comisionPoliza(poliza('2026-08-22', '2026-10-22'), '2026-11-05');
  assert.strictEqual(r.motivo, 'INICIO_COBERTURA_FUERA_DE_CUOTA');
});

console.log('\nResultado: ' + pass + ' PASS · ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
