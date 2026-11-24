/* E3 · Sombra en CRM: coincidencias, diferencias, no evaluables, idempotencia y ausencia de escrituras.
   Ejecutar: node tests/pago_e3_sombra.test.js */
const path = require('path');
const assert = require('assert');
const REPO = process.env.SS_REPO || path.join(__dirname, '..');
global.window = globalThis;
window.BusinessConfig = {};
for (const f of ['constants', 'commissions', 'pricing']) require(path.join(REPO, 'business-config', f + '.js'));
require(path.join(REPO, 'src/business-core/motors/producto/index.js'));
require(path.join(REPO, 'src/business-core/motors/pago/index.js'));
for (const f of ['resolver-edad', 'comision-asegurados', 'sombra', 'e3-sombra']) require(path.join(REPO, 'src/business-core/motors/pago', f + '.js'));
const E3 = globalThis.MotorPagoE3, MP = globalThis.MotorProducto;
let pass = 0, fail = 0;
function t(nombre, fn) { try { fn(); pass++; console.log('PASS  ' + nombre); } catch (e) { fail++; console.log('FAIL  ' + nombre + '\n      ' + e.message); } }
const B = MP.tablasDelAnio(2026).SPTI_SIN_IVA.PREFERENCIAL['0-40'].mensual; // 159.120

const VENTA_SPTI = { id: 'v1', poliza: '1001', producto: 'SPTI', plan: 'PREFERENCIAL', periodicidad: 'MENSUAL',
  fechaExp: '2026-08-22', doc: '1001', fechaNac: '1990-01-01', primaTotalSinIVA: B, numAsegurados: 1 };
const VENTA_PAC60 = { id: 'v2', poliza: '5001', producto: 'PAC60', periodicidad: 'MENSUAL', fechaExp: '2026-03-10',
  doc: '5001', fechaNac: '1957-05-10', conAnexo: true, primaTotalSinIVA: 368757, numAsegurados: 1 };
const VENTA_PSM_GRUPO = { id: 'v3', poliza: '1735191', producto: 'PSM', periodicidad: 'MENSUAL', fechaExp: '2026-09-07',
  doc: '1', fechaNac: '1994-01-04', modulos: ['Basico'],
  asegurados: [ { doc: '1', fechaNac: '1994-01-04', modulos: ['Basico'] }, { doc: '2', fechaNac: '2024-06-15', modulos: ['Basico'] } ] };

function estado(ventas, pagos) { return JSON.stringify({ ventas, pagos }); }

t('E1 pago legado que coincide con el motor: COINCIDE (SPTI individual 11.138)', () => {
  const r = E3.ejecutar([VENTA_SPTI], { v1: [{ id: 'p1', fecha: '2026-09-22T12:00:00.000Z', comision: 11138 }] });
  assert.strictEqual(r.estado, 'OK'); assert.strictEqual(r.resumen.COINCIDE, 1);
});
t('E2 pago legado con diferencia: DIFERENCIA con su magnitud (registrado 11.200 vs motor 11.138 = +62)', () => {
  const r = E3.ejecutar([VENTA_SPTI], { v1: [{ id: 'p2', fecha: '2026-09-22', comision: 11200 }] });
  assert.strictEqual(r.resumen.DIFERENCIA, 1); assert.strictEqual(r.filas[0].diferencia, 62); assert.strictEqual(r.filas[0].motor, 11138);
});
t('E3 PAC60 individual con anexo: 18.438 coincide (caso real verificado)', () => {
  const r = E3.ejecutar([VENTA_PAC60], { v2: [{ id: 'p3', fecha: '2026-04-10', comision: 18438 }] });
  assert.strictEqual(r.resumen.COINCIDE, 1);
});
t('E4 PSM de grupo sin base individual: NO_EVALUABLE FALTA_BASE_GUARDADA (no se estima)', () => {
  const r = E3.ejecutar([VENTA_PSM_GRUPO], { v3: [{ id: 'p4', fecha: '2026-10-07', comision: 63544 }] });
  assert.strictEqual(r.resumen.NO_EVALUABLE, 1); assert.strictEqual(r.filas[0].motivo, 'FALTA_BASE_GUARDADA');
  assert.strictEqual(r.filas[0].motor, undefined);
});
t('E5 sin motor cargado: NO_DISPONIBLE explicito, nunca un calculo alterno', () => {
  const guardado = global.MotorPagoE1; global.MotorPagoE1 = undefined;
  try {
    const r = E3.ejecutar([VENTA_SPTI], { v1: [{ id: 'p5', fecha: '2026-09-22', comision: 11138 }] });
    assert.strictEqual(r.estado, 'NO_DISPONIBLE'); assert.strictEqual(r.motivo, 'MOTOR_PAGO_E1_NO_CARGADO');
    assert.strictEqual(r.filas.length, 0);
  } finally { global.MotorPagoE1 = guardado; }
});
t('E6 idempotencia: dos ejecuciones con el mismo estado dan el mismo resultado', () => {
  const pagos = { v1: [{ id: 'p6', fecha: '2026-09-22', comision: 11200 }], v2: [{ id: 'p7', fecha: '2026-04-10', comision: 18438 }] };
  const a = E3.ejecutar([VENTA_SPTI, VENTA_PAC60], pagos), b = E3.ejecutar([VENTA_SPTI, VENTA_PAC60], pagos);
  assert.strictEqual(JSON.stringify(a), JSON.stringify(b));
});
t('E7 sin escrituras: el estado de ventas y pagos queda idéntico tras ejecutar', () => {
  const ventas = [VENTA_SPTI, VENTA_PAC60, VENTA_PSM_GRUPO];
  const pagos = { v1: [{ id: 'p8', fecha: '2026-09-22', comision: 11200 }], v2: [{ id: 'p9', fecha: '2026-04-10', comision: 18438 }], v3: [{ id: 'p10', fecha: '2026-10-07', comision: 63544 }] };
  const antes = estado(ventas, pagos);
  E3.ejecutar(ventas, pagos);
  assert.strictEqual(estado(ventas, pagos), antes);
});
t('E8 venta sin pagos no genera filas; pagos de otra venta no se mezclan', () => {
  const r = E3.ejecutar([VENTA_SPTI, VENTA_PAC60], { v2: [{ id: 'p11', fecha: '2026-04-10', comision: 18438 }] });
  assert.strictEqual(r.pagosEvaluados, 1); assert.strictEqual(r.filas[0].ventaId, 'v2');
});

t('E9 importada SPTI con adicional en aseguradosImport y sin array: NO_EVALUABLE IMPORTADA_CON_ADICIONALES_FUERA_DE_MOTOR', () => {
  const v = Object.assign({}, VENTA_SPTI, { id: 'v9', poliza: '090001626273', asegurados: [], aseguradosImport: [{ doc: '1033677151', fechaNac: '2004-02-16' }] });
  const r = E3.ejecutar([v], { v9: [{ id: 'p12', fecha: '2026-10-30', comision: 22253 }] });
  assert.strictEqual(r.resumen.NO_EVALUABLE, 1);
  assert.strictEqual(r.filas[0].motivo, 'IMPORTADA_CON_ADICIONALES_FUERA_DE_MOTOR');
});
t('E10 SPD con adicional en aseguradosImport NO se excluye (tarifa unica por poliza)', () => {
  const v = { id: 'v10', poliza: '090001595427', producto: 'SPD', periodicidad: 'MENSUAL', fechaExp: '2026-08-22', asegurados: [], aseguradosImport: [{ doc: '9', fechaNac: '2000-01-01' }] };
  const r = E3.ejecutar([v], { v10: [{ id: 'p13', fecha: '2026-09-22', comision: 1 }] });
  assert.notStrictEqual(r.filas[0].motivo, 'IMPORTADA_CON_ADICIONALES_FUERA_DE_MOTOR');
});
t('E11 SPTI importada solo titular (sin aseguradosImport) sigue evaluándose', () => {
  const r = E3.ejecutar([VENTA_SPTI], { v1: [{ id: 'p14', fecha: '2026-09-22', comision: 11138 }] });
  assert.strictEqual(r.resumen.COINCIDE, 1);
});

// Caso de prueba: el motor da 11.138 para el pago del 22/09; el CRM registró 17.679 (diferencia de 6.541).
const AJ_PRUEBA = { id: 'AJ-PRUEBA-1', poliza: '1001', comisionPagada: 17679, comisionCorrecta: 11138, diferencia: -6541, estado: 'PENDIENTE_LIQUIDACION' };
t('E12 diferencia con ajuste pendiente que coincide: DIFERENCIA_CON_AJUSTE (no cuenta como nueva)', () => {
  const v = Object.assign({}, VENTA_SPTI, { id: 'v12', ajustesComision: [Object.assign({}, AJ_PRUEBA)] });
  const r = E3.ejecutar([v], { v12: [{ id: 'p15', fecha: '2026-09-22', comision: 17679 }] });
  assert.strictEqual(r.filas[0].resultado, 'DIFERENCIA_CON_AJUSTE'); assert.strictEqual(r.filas[0].ajuste, 'AJ-PRUEBA-1');
  assert.strictEqual(r.resumen.DIFERENCIA_CON_AJUSTE, 1); assert.strictEqual(r.resumen.DIFERENCIA, 0);
});
t('E13 un mismo ajuste no cubre dos pagos (sin doble conteo)', () => {
  const v = Object.assign({}, VENTA_SPTI, { id: 'v13', ajustesComision: [Object.assign({}, AJ_PRUEBA)] });
  const r = E3.ejecutar([v], { v13: [{ id: 'p16', fecha: '2026-09-22', comision: 17679 }, { id: 'p17', fecha: '2026-10-22', comision: 17679 }] });
  assert.strictEqual(r.resumen.DIFERENCIA_CON_AJUSTE, 1); assert.strictEqual(r.resumen.DIFERENCIA, 1);
});
t('E14 ajuste con valores distintos no se usa: queda DIFERENCIA', () => {
  const v = Object.assign({}, VENTA_SPTI, { id: 'v14', ajustesComision: [Object.assign({}, AJ_PRUEBA, { comisionPagada: 1 })] });
  const r = E3.ejecutar([v], { v14: [{ id: 'p18', fecha: '2026-09-22', comision: 17679 }] });
  assert.strictEqual(r.filas[0].resultado, 'DIFERENCIA');
});

console.log('\nResultado: ' + pass + ' PASS · ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
