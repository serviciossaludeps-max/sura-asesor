/* Cobro parcial/escalonado (comision sobre lo cobrado) y PSM/PAC60 de grupo sin base guardada.
   Ejecutar: node tests/pago_cobro_escalonado.test.js */
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

// Caso 1729322: 2 asegurados, PREFERENCIAL 0-40, base 159.120 cada uno (318.240 completo)
const B = sin(2026, 'PREFERENCIAL', '0-40', 'mensual');
const POLIZA = { producto: 'SPTI', plan: 'PREFERENCIAL', periodicidad: 'MENSUAL', fechaExp: '2026-08-22',
  asegurados: [ { fechaNac: '1990-01-01', primaTotalSinIVA: B }, { fechaNac: '1992-01-01', primaTotalSinIVA: B } ] };

t('cobro completo (sin montoRecibido): comision sobre el periodo (7 % de 318.240 = 22.276)', () => {
  const r = E1.comisionPoliza(POLIZA, '2026-09-22');
  assert.strictEqual(r.estado, 'OK');
  assert.strictEqual(r.comision, 22276);
  assert.strictEqual(r.cobroParcial, null);
});
t('cobro completo con montoRecibido igual al periodo: no cambia', () => {
  const r = E1.comisionPoliza(POLIZA, '2026-09-22', { montoRecibido: con(2 * B) });
  assert.strictEqual(r.comision, 22276);
  assert.strictEqual(r.cobroParcial, null);
});
t('cobro parcial de 159.120 (la mitad): comision 7 % de la base cobrada', () => {
  const r = E1.comisionPoliza(POLIZA, '2026-09-11', { montoRecibido: con(B) });
  assert.strictEqual(r.estado, 'OK');
  assert.strictEqual(r.cobroParcial.baseCobrada, B);
  assert.deepStrictEqual(r.comisionPorAsegurado.map(d => d.base), [B / 2, B / 2]);
  assert.strictEqual(r.comision, 11138);
});
t('cobro parcial de 143.208 sin IVA: base cobrada exacta y suma por asegurado', () => {
  const r = E1.comisionPoliza(POLIZA, '2026-09-11', { montoRecibido: con(143208) });
  assert.strictEqual(r.cobroParcial.baseCobrada, 143208);
  const suma = r.comisionPorAsegurado.reduce((a, d) => a + d.base, 0);
  assert.strictEqual(suma, 143208);
  assert.strictEqual(r.comision, r.comisionPorAsegurado.reduce((a, d) => a + d.comision, 0));
});
t('montoRecibido invalido -> BLOQUEADO, no se calcula con un valor inventado', () => {
  const r = E1.comisionPoliza(POLIZA, '2026-09-11', { montoRecibido: -5 });
  assert.strictEqual(r.estado, 'BLOQUEADO');
  assert.strictEqual(r.motivo, 'MONTO_RECIBIDO_INVALIDO');
  assert.strictEqual(r.comision, null);
});
t('PSM de 2 asegurados sin base guardada: sigue BLOQUEADO (regla vigente, no se asume la tarifa)', () => {
  const p = { producto: 'PSM', periodicidad: 'MENSUAL', fechaExp: '2026-09-07',
    asegurados: [ { fechaNac: '1994-01-04', modulos: ['Basico'] }, { fechaNac: '2024-06-15', modulos: ['Basico'] } ] };
  const r = E1.comisionPoliza(p, '2026-10-07');
  assert.strictEqual(r.estado, 'BLOQUEADO');
  assert.strictEqual(r.motivo, 'FALTA_BASE_GUARDADA');
});

console.log('\nResultado: ' + pass + ' PASS · ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
