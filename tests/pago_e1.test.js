/* Pruebas E1 · deterministas, sin dependencias externas. Ejecutar: node tests/pago_e1.test.js
   Requiere el repositorio con: business-config/{constants,commissions,pricing}.js,
   src/business-core/motors/producto/index.js y src/business-core/motors/pago/index.js. */
const path = require('path');
const assert = require('assert');
const REPO = process.env.SS_REPO || path.join(__dirname, '..');
global.window = globalThis;
window.BusinessConfig = {};
require(path.join(REPO, 'business-config/constants.js'));
require(path.join(REPO, 'business-config/commissions.js'));
require(path.join(REPO, 'business-config/pricing.js'));
require(path.join(REPO, 'src/business-core/motors/producto/index.js'));
require(path.join(REPO, 'src/business-core/motors/pago/index.js'));
require(path.join(REPO, 'src/business-core/motors/pago/resolver-edad.js'));
require(path.join(REPO, 'src/business-core/motors/pago/comision-asegurados.js'));
const R = globalThis.MotorPagoE1.resolverEdadReferencia;
const C = globalThis.MotorPagoE1.comisionPoliza;
const MP = globalThis.MotorProducto;

let pass = 0, fail = 0;
function t(nombre, fn) {
  try { fn(); pass++; console.log('PASS  ' + nombre); }
  catch (e) { fail++; console.log('FAIL  ' + nombre + '\n      ' + e.message); }
}

// ---------- R-EDAD (resolver) ----------
t('R-EDAD ciclo 0, venta nueva: edad a fechaExp', () => {
  const r = R({ fechaNac: '1985-03-10' }, { fechaExp: '2025-03-10' }, '2025-06-10');
  assert.deepStrictEqual([r.estado, r.edad, r.ciclo], ['OK', 40, 0]);
});
t('R-EDAD ciclo 0, importada: usa fechaExpOriginal', () => {
  const r = R({ fechaNac: '1985-03-10' }, { fechaExp: '2025-09-01', fechaExpOriginal: '2024-03-10' }, '2025-02-10');
  assert.deepStrictEqual([r.estado, r.edad, r.ciclo], ['OK', 39, 0]);
});
t('Frontera del mes 13: un día antes sigue en ciclo 0', () => {
  const r = R({ fechaNac: '1985-03-10' }, { fechaExp: '2025-03-10' }, '2026-03-09');
  assert.deepStrictEqual([r.ciclo, r.edad], [0, 40]);
});
t('Frontera del mes 13: en el aniversario entra al ciclo 1 con edad de renovación', () => {
  const r = R({ fechaNac: '1985-03-10' }, { fechaExp: '2025-03-10' }, '2026-03-10');
  assert.deepStrictEqual([r.estado, r.ciclo, r.edad, r.fechaReferencia], ['OK', 1, 41, '2026-03-10']);
});
t('Ciclo 2 (mes 25): edad a la renovación del ciclo 2', () => {
  const r = R({ fechaNac: '1985-03-10' }, { fechaExp: '2025-03-10' }, '2027-03-10');
  assert.deepStrictEqual([r.ciclo, r.edad], [2, 42]);
});
t('Bloquea sin fecha de nacimiento', () => {
  const r = R({}, { fechaExp: '2025-03-10' }, '2025-06-10');
  assert.deepStrictEqual([r.estado, r.motivo], ['BLOQUEADO', 'FALTA_FECHA_NACIMIENTO']);
});
t('Bloquea sin ancla', () => {
  const r = R({ fechaNac: '1985-03-10' }, {}, '2025-06-10');
  assert.deepStrictEqual([r.estado, r.motivo], ['BLOQUEADO', 'FALTA_ANCLA']);
});
t('Bloquea con fecha de pago inválida (30 de febrero)', () => {
  const r = R({ fechaNac: '1985-03-10' }, { fechaExp: '2025-03-10' }, '2026-02-30');
  assert.deepStrictEqual([r.estado, r.motivo], ['BLOQUEADO', 'FECHA_INVALIDA']);
});

// ---------- Comisión por asegurado (I-2 + C-1) ----------
t('SPTI ciclo 0 con bases guardadas: dos asegurados suman 19.664 (caso Angie sintético)', () => {
  const p = { producto: 'SPTI', plan: 'CLASICO', periodicidad: 'MENSUAL', fechaExp: '2025-03-10', asegurados: [
    { fechaNac: '1985-03-10', primaTotalSinIVA: 140457 },
    { fechaNac: '1990-06-01', primaTotalSinIVA: 140457 }
  ]};
  const r = C(p, '2025-04-10');
  assert.strictEqual(r.estado, 'OK');
  assert.strictEqual(r.comision, 19664);
  assert.deepStrictEqual(r.comisionPorAsegurado.map(d => d.comision), [9832, 9832]);
});
t('SPTI ciclo 0 sin base guardada: usa la tabla del año del ancla (2026)', () => {
  const p = { producto: 'SPTI', plan: 'CLASICO', periodicidad: 'MENSUAL', fechaExp: '2026-03-10',
    asegurados: [{ fechaNac: '1986-03-10' }] };
  const r = C(p, '2026-04-10');
  assert.strictEqual(r.comision, 9832);
  assert.strictEqual(r.comisionPorAsegurado[0].fuenteBase, 'TABLA_ANIO');
});
t('SPTI ciclo 1: edad a la renovación (41) y tabla 41-50 = 10.754', () => {
  const p = { producto: 'SPTI', plan: 'CLASICO', periodicidad: 'MENSUAL', fechaExp: '2025-03-10',
    asegurados: [{ fechaNac: '1985-03-10' }] };
  const r = C(p, '2026-03-10');
  assert.strictEqual(r.comision, 10754);
  assert.strictEqual(r.comisionPorAsegurado[0].edadReferencia, 41);
});
t('I-2: cada asegurado usa su propia edad y base en el ciclo 1', () => {
  const p = { producto: 'SPTI', plan: 'CLASICO', periodicidad: 'MENSUAL', fechaExp: '2025-03-10', asegurados: [
    { fechaNac: '1985-03-10' }, { fechaNac: '1996-03-10' }
  ]};
  const r = C(p, '2026-03-10');
  assert.deepStrictEqual(r.comisionPorAsegurado.map(d => d.edadReferencia), [41, 30]);
  assert.strictEqual(r.comision, 10754 + 9832);
});
t('PSM titular 50 años: 12 % (BR-016)', () => {
  const p = { producto: 'PSM', fechaExp: '2025-03-10', asegurados: [{ fechaNac: '1975-03-10', primaTotalSinIVA: 100000 }] };
  assert.strictEqual(C(p, '2025-04-10').comision, 12000);
});
t('PSM titular 51 años: 6 % (BR-016)', () => {
  const p = { producto: 'PSM', fechaExp: '2025-03-10', asegurados: [{ fechaNac: '1974-03-10', primaTotalSinIVA: 100000 }] };
  assert.strictEqual(C(p, '2025-04-10').comision, 6000);
});
t('PSM sin base guardada en ciclo 0 queda BLOQUEADO', () => {
  const p = { producto: 'PSM', fechaExp: '2025-03-10', asegurados: [{ fechaNac: '1975-03-10' }] };
  assert.strictEqual(C(p, '2025-04-10').motivo, 'FALTA_BASE_GUARDADA');
});
t('SPTI sin plan queda BLOQUEADO', () => {
  const p = { producto: 'SPTI', periodicidad: 'MENSUAL', fechaExp: '2025-03-10', asegurados: [{ fechaNac: '1985-03-10' }] };
  assert.strictEqual(C(p, '2025-04-10').motivo, 'FALTA_PLAN');
});
t('Si un asegurado está bloqueado, la póliza entera queda BLOQUEADA (sin valor parcial)', () => {
  const p = { producto: 'SPTI', plan: 'CLASICO', periodicidad: 'MENSUAL', fechaExp: '2026-03-10', asegurados: [
    { fechaNac: '1985-03-10' }, { }
  ]};
  const r = C(p, '2026-04-10');
  assert.deepStrictEqual([r.estado, r.comision, r.motivo, r.comisionPorAsegurado.length], ['BLOQUEADO', null, 'FALTA_FECHA_NACIMIENTO', 0]);
});
t('Sin MotorProducto, bloquea sin respaldo silencioso', () => {
  const guardado = globalThis.MotorProducto;
  delete globalThis.MotorProducto;
  try {
    const r = C({ producto: 'SPTI', plan: 'CLASICO', periodicidad: 'MENSUAL', fechaExp: '2025-03-10',
      asegurados: [{ fechaNac: '1985-03-10' }] }, '2025-04-10');
    assert.strictEqual(r.motivo, 'MOTOR_PRODUCTO_NO_DISPONIBLE');
  } finally { globalThis.MotorProducto = guardado; }
});

// ---------- Propiedades del cálculo ----------
t('No modifica la entrada (no recalcula históricos)', () => {
  const p = { producto: 'SPTI', plan: 'CLASICO', periodicidad: 'MENSUAL', fechaExp: '2025-03-10',
    asegurados: [{ fechaNac: '1985-03-10', primaTotalSinIVA: 140457 }] };
  const antes = JSON.stringify(p);
  C(p, '2026-03-10');
  assert.strictEqual(JSON.stringify(p), antes);
});
t('Determinista: mismo input, mismo resultado', () => {
  const p = { producto: 'SPTI', plan: 'PREFERENCIAL', periodicidad: 'TRIMESTRAL', fechaExp: '2025-03-10',
    asegurados: [{ fechaNac: '1985-03-10' }] };
  assert.deepStrictEqual(C(p, '2026-03-10'), C(p, '2026-03-10'));
});
t('La suma de comisiones por asegurado es igual a la comisión de la póliza', () => {
  const p = { producto: 'SPTI', plan: 'CLASICO', periodicidad: 'MENSUAL', fechaExp: '2025-03-10', asegurados: [
    { fechaNac: '1985-03-10' }, { fechaNac: '1996-03-10' }, { fechaNac: '1970-03-10' }
  ]};
  const r = C(p, '2026-03-10');
  assert.strictEqual(r.comision, r.comisionPorAsegurado.reduce((a, d) => a + d.comision, 0));
});

// ---------- E1b: C-3 (PSM con varios asegurados) ----------
t('C-3: PSM con varios asegurados, cada uno con su base y su porcentaje por edad', () => {
  const p = { producto: 'PSM', fechaExp: '2025-03-10', asegurados: [
    { fechaNac: '1985-03-10', modulos: ['Básico'], primaTotalSinIVA: 100000 },
    { fechaNac: '1974-03-10', modulos: ['Básico', 'Alto Costo'], primaTotalSinIVA: 50000 }
  ]};
  const r = C(p, '2025-04-10');
  assert.strictEqual(r.estado, 'OK');
  assert.deepStrictEqual(r.comisionPorAsegurado.map(d => d.pct), [0.12, 0.06]);
  assert.strictEqual(r.comision, 12000 + 3000);
});
t('C-3: PSM ciclo 1, base por módulos a la tarifa 2026 (41 años, básico) = 36.235', () => {
  const p = { producto: 'PSM', periodicidad: 'MENSUAL', fechaExp: '2025-03-10', asegurados: [
    { fechaNac: '1985-03-10', modulos: ['Básico'] }
  ]};
  const r = C(p, '2026-03-10');
  assert.strictEqual(r.comision, 36235);
  assert.strictEqual(r.comisionPorAsegurado[0].fuenteBase, 'TABLA_ANIO');
});
t('C-3: PSM ciclo 1 con módulo desconocido queda BLOQUEADO', () => {
  const p = { producto: 'PSM', periodicidad: 'MENSUAL', fechaExp: '2025-03-10', asegurados: [
    { fechaNac: '1985-03-10', modulos: ['Modulo inventado'] }
  ]};
  assert.strictEqual(C(p, '2026-03-10').motivo, 'MODULO_DESCONOCIDO');
});
t('PSM ciclo 1 en un año sin tabla queda BLOQUEADO (no usa la tabla 2026)', () => {
  const p = { producto: 'PSM', periodicidad: 'MENSUAL', fechaExp: '2024-03-10', asegurados: [
    { fechaNac: '1985-03-10', modulos: ['Básico'] }
  ]};
  // Sin tabla PSM 2025 queda bloqueado; según la versión de pricing.js el motivo puede ser TABLA_ANIO_NO_DISPONIBLE o TARIFA_NO_RESUELTA.
  const r = C(p, '2025-03-10');
  assert.strictEqual(r.estado, 'BLOQUEADO');
  assert.ok(['TABLA_ANIO_NO_DISPONIBLE', 'TARIFA_NO_RESUELTA'].includes(r.motivo), r.motivo);
});

// ---------- E1b: PAC60 ----------
t('PAC60 ciclo 1, 65 años sin anexo = 17.067 (tarifa 2026 administrativa)', () => {
  const p = { producto: 'PAC60', periodicidad: 'MENSUAL', fechaExp: '2025-03-10', asegurados: [
    { fechaNac: '1961-03-10', conAnexo: false }
  ]};
  assert.strictEqual(C(p, '2026-03-10').comision, 17067);
});
t('PAC60 con varios asegurados: cada uno con su anexo y su base (decisión E1c)', () => {
  const p = { producto: 'PAC60', periodicidad: 'MENSUAL', fechaExp: '2025-03-10', asegurados: [
    { fechaNac: '1961-03-10', conAnexo: false, primaTotalSinIVA: 300000 },
    { fechaNac: '1961-03-10', conAnexo: true, primaTotalSinIVA: 200000 }
  ]};
  const r = C(p, '2025-04-10');
  assert.strictEqual(r.estado, 'OK');
  assert.strictEqual(r.comision, 15000 + 10000);
  assert.deepStrictEqual(r.comisionPorAsegurado.map(d => d.pct), [0.05, 0.05]);
});
t('PAC60 ciclo 1 con varios asegurados: cada uno con su anexo (17.067 + 18.438)', () => {
  const p = { producto: 'PAC60', periodicidad: 'MENSUAL', fechaExp: '2025-03-10', asegurados: [
    { fechaNac: '1961-03-10', conAnexo: false },
    { fechaNac: '1961-03-10', conAnexo: true }
  ]};
  const r = C(p, '2026-03-10');
  assert.strictEqual(r.comision, 35505);
  assert.deepStrictEqual(r.comisionPorAsegurado.map(d => d.base), [341331, 368757]);
});

// ---------- E1b: SPD (una tarifa, sin regla de asegurados) ----------
t('SPD ciclo 0: una comisión de la póliza sobre la prima guardada (8 %)', () => {
  const p = { producto: 'SPD', periodicidad: 'MENSUAL', fechaExp: '2025-05-10', primaTotalSinIVA: 100000, asegurados: [{}] };
  const r = C(p, '2025-06-10');
  assert.deepStrictEqual([r.estado, r.comision, r.comisionPorAsegurado.length], ['OK', 8000, 1]);
});
t('SPD ciclo 1 con tabla 2026 vigente = 7.366 (92.070 × 8 %)', () => {
  const p = { producto: 'SPD', periodicidad: 'MENSUAL', fechaExp: '2025-05-10', primaTotalSinIVA: 100000, asegurados: [{}] };
  assert.strictEqual(C(p, '2026-05-10').comision, 7366);
});
t('SPD ciclo 1 fuera de vigencia queda BLOQUEADO', () => {
  const p = { producto: 'SPD', periodicidad: 'MENSUAL', fechaExp: '2025-03-10', primaTotalSinIVA: 100000, asegurados: [{}] };
  assert.strictEqual(C(p, '2026-03-10').motivo, 'SPD_FUERA_DE_VIGENCIA');
});
t('SPD no exige fecha de nacimiento (una tarifa para la póliza)', () => {
  const p = { producto: 'SPD', periodicidad: 'MENSUAL', fechaExp: '2025-05-10', primaTotalSinIVA: 100000, asegurados: [{}, {}] };
  assert.strictEqual(C(p, '2025-06-10').estado, 'OK');
});

console.log(`\nResultado: ${pass} PASS · ${fail} FAIL`);
process.exit(fail ? 1 : 0);
