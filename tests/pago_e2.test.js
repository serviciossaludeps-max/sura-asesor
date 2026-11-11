/* Pruebas E2 · modo sombra con exportación sintética (sin datos reales). Ejecutar: node tests/pago_e2.test.js */
const path = require('path');
const assert = require('assert');
const REPO = process.env.SS_REPO || path.join(__dirname, '..');
global.window = globalThis;
window.BusinessConfig = {};
for (const f of ['constants', 'commissions', 'pricing']) require(path.join(REPO, 'business-config', f + '.js'));
require(path.join(REPO, 'src/business-core/motors/producto/index.js'));
require(path.join(REPO, 'src/business-core/motors/pago/index.js'));
for (const f of ['resolver-edad', 'comision-asegurados', 'tarifa-resolver', 'periodo-importada', 'pago-validador', 'reversion-calc', 'sombra']) {
  require(path.join(REPO, 'src/business-core/motors/pago', f + '.js'));
}
const S = globalThis.MotorPagoE2;
const MP = globalThis.MotorProducto;
const tablas2025 = !!MP.tablasDelAnio(2025);

let pass = 0, fail = 0;
function t(nombre, fn) {
  try { fn(); pass++; console.log('PASS  ' + nombre); }
  catch (e) { fail++; console.log('FAIL  ' + nombre + '\n      ' + e.message); }
}

const VENTA_LUISA = {
  id: 'L1', producto: 'SPTI', plan: 'PREFERENCIAL', periodicidad: 'MENSUAL', importada: true,
  fechaExp: '2024-11-18', fechaExpOriginal: '2024-11-18', fechaNac: '1991-05-21',
  pagadaHasta: '2026-10-18', pagoMaxPendiente: '2026-11-18', corteSura: '2026-10-25',
  pagos: [{ fecha: '2026-07-09', comision: 10721 }, { fecha: '2026-08-09', comision: 10721 }, { fecha: '2026-09-09', comision: 10721 }]
};
const VENTA_SPD = {
  id: 'S1', producto: 'SPD', periodicidad: 'MENSUAL', fechaExp: '2025-05-10', primaTotalSinIVA: 100000,
  pagos: [{ fecha: '2025-06-10', comision: 8000 }, { fecha: '2025-07-10', comision: 7500 }]
};
const VENTA_SIN_NACIMIENTO = {
  id: 'C1', producto: 'SPTI', plan: 'CLASICO', periodicidad: 'MENSUAL', fechaExp: '2026-03-10', primaTotalSinIVA: 140457,
  pagos: [{ fecha: '2026-04-10', comision: 9832 }]
};
const VENTA_PSM_MULTI = {
  id: 'P1', producto: 'PSM', periodicidad: 'MENSUAL', fechaExp: '2026-03-10', fechaNac: '1975-03-10', primaTotalSinIVA: 150000,
  asegurados: [{ fechaNac: '1980-03-10', modulos: ['Básico'], primaTotalSinIVA: 50000 }],
  pagos: [{ fecha: '2026-04-10', comision: 18000 }]
};
const VENTA_SIN_COMISION = {
  id: 'S2', producto: 'SPD', periodicidad: 'MENSUAL', fechaExp: '2025-05-10', primaTotalSinIVA: 100000,
  pagos: [{ fecha: '2025-06-10' }]
};
const EXPORT = { ventas: [VENTA_LUISA, VENTA_SPD, VENTA_SIN_NACIMIENTO, VENTA_PSM_MULTI, VENTA_SIN_COMISION] };

t('Sombra Luisa: con tabla 2025 coincide (10.721); sin ella, no evaluable por tabla', () => {
  const filas = S.evaluarVenta(VENTA_LUISA);
  if (tablas2025) assert.deepStrictEqual(filas.map(f => f.resultado), ['COINCIDE', 'COINCIDE', 'COINCIDE']);
  else assert.ok(filas.every(f => f.resultado === 'NO_EVALUABLE' && f.motivo === 'TABLA_ANIO_NO_DISPONIBLE'));
});
t('Sombra SPD: pago igual coincide; pago distinto queda como DIFERENCIA de 500', () => {
  const filas = S.evaluarVenta(VENTA_SPD);
  assert.deepStrictEqual([filas[0].resultado, filas[1].resultado, filas[1].diferencia], ['COINCIDE', 'DIFERENCIA', 500]);
});
t('Sombra: sin fecha de nacimiento es NO_EVALUABLE (no se estima)', () => {
  const f = S.evaluarVenta(VENTA_SIN_NACIMIENTO)[0];
  assert.deepStrictEqual([f.resultado, f.motivo], ['NO_EVALUABLE', 'FALTA_FECHA_NACIMIENTO']);
});
t('Sombra PSM con adicionales: titular sin prima individual es NO_EVALUABLE (no se asume)', () => {
  const f = S.evaluarVenta(VENTA_PSM_MULTI)[0];
  assert.deepStrictEqual([f.resultado, f.motivo], ['NO_EVALUABLE', 'FALTA_BASE_GUARDADA']);
});
t('Sombra: pago sin comisión registrada es NO_EVALUABLE', () => {
  const f = S.evaluarVenta(VENTA_SIN_COMISION)[0];
  assert.deepStrictEqual([f.resultado, f.motivo], ['NO_EVALUABLE', 'FALTA_COMISION_REGISTRADA']);
});
t('Resumen: cuenta por resultado y deja las diferencias para clasificar', () => {
  const filas = EXPORT.ventas.flatMap(v => S.evaluarVenta(v));
  const r = S.resumir(filas);
  assert.strictEqual(r.total, filas.length);
  assert.strictEqual(r.DIFERENCIA, 1);
  assert.strictEqual(r.porClasificar, 1);
  assert.strictEqual(r.criterioSinDiferenciasSinClasificar, false);
  assert.ok(r.noEvaluablePorMotivo.FALTA_FECHA_NACIMIENTO >= 1);
});
t('Sombra no modifica la exportación (solo lectura)', () => {
  const antes = JSON.stringify(EXPORT);
  EXPORT.ventas.flatMap(v => S.evaluarVenta(v));
  assert.strictEqual(JSON.stringify(EXPORT), antes);
});
t('Adaptador: importada toma el periodo SURA; venta con adicionales no asume prima del titular', () => {
  const p = S.adaptarVenta(VENTA_LUISA);
  assert.deepStrictEqual([p.importada, p.sura.pagadaHasta, p.sura.corteSura], [true, '2026-10-18', '2026-10-25']);
  const q = S.adaptarVenta(VENTA_PSM_MULTI);
  assert.strictEqual(q.asegurados[0].primaTotalSinIVA, undefined);
});

console.log(`\nResultado: ${pass} PASS · ${fail} FAIL`);
process.exit(fail ? 1 : 0);
