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
const sin = (anio, plan, rango, campo) => MP.tablasDelAnio(anio).SPTI_SIN_IVA[plan][rango][campo];
const con = (v) => Math.round(v * 1.05);
const B = sin(2026, 'PREFERENCIAL', '0-40', 'mensual');   // 159.120 sin IVA por asegurado
const PERIODO = '2026-08-22';
function poliza(extra) {
  return Object.assign({ producto: 'SPTI', plan: 'PREFERENCIAL', periodicidad: 'MENSUAL', fechaExp: '2026-08-22',
    asegurados: [ { doc: '1001', fechaNac: '1990-01-01', primaTotalSinIVA: B }, { doc: '1002', fechaNac: '1992-01-01', primaTotalSinIVA: B } ] }, extra || {});
}
function cobro(sinIva, ref, id) { return { montoRecibido: con(sinIva), aseguradoRef: ref, periodoDesde: PERIODO, id: id }; }
const porRef = (r, ref) => r.comisionPorAsegurado.find(d => d.aseguradoRef === ref);

t('cobro completo sin montoRecibido: 22.276', () => {
  const r = E1.comisionPoliza(poliza(), '2026-09-22');
  assert.strictEqual(r.comision, 22276); assert.strictEqual(r.cobroParcial, null);
});
t('cobro completo con montoRecibido igual al periodo: no cambia', () => {
  const r = E1.comisionPoliza(poliza(), '2026-09-22', { montoRecibido: con(2 * B) });
  assert.strictEqual(r.comision, 22276); assert.strictEqual(r.cobroParcial, null);
});
t('cobro parcial de 159.120 asignado a 1001: 11.138 solo para 1001', () => {
  const r = E1.comisionPoliza(poliza(), '2026-09-11', cobro(B, '1001', 'e1'));
  assert.strictEqual(r.comision, 11138); assert.strictEqual(porRef(r, '1002').comision, 0);
});
t('cobro parcial de 143.208 asignado a 1002: 10.025', () => {
  const r = E1.comisionPoliza(poliza(), '2026-09-11', cobro(143208, '1002', 'e2'));
  assert.strictEqual(r.comision, 10025);
});
t('monto recibido invalido -> BLOQUEADO', () => {
  const r = E1.comisionPoliza(poliza(), '2026-09-11', { montoRecibido: -5, aseguradoRef: '1001', periodoDesde: PERIODO });
  assert.strictEqual(r.estado, 'BLOQUEADO'); assert.strictEqual(r.motivo, 'MONTO_RECIBIDO_INVALIDO');
});
t('cobro parcial sin asegurado identificado -> FALTA_ASEGURADO', () => {
  const r = E1.comisionPoliza(poliza(), '2026-09-11', { montoRecibido: con(143208), periodoDesde: PERIODO });
  assert.strictEqual(r.motivo, 'FALTA_ASEGURADO');
});

console.log('\nResultado: ' + pass + ' PASS · ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
