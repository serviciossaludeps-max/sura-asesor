/* Pruebas E1d · pólizas importadas desde la cartera SURA. Ejecutar: node tests/pago_e1d.test.js
   Caso de referencia: datos del reporte SURA (recibos 80905728 y 81293278). Fecha de nacimiento
   real de la asegurada (21/05/1991). */
const path = require('path');
const assert = require('assert');
const REPO = process.env.SS_REPO || path.join(__dirname, '..');
global.window = globalThis;
window.BusinessConfig = {};
for (const f of ['constants', 'commissions', 'pricing']) require(path.join(REPO, 'business-config', f + '.js'));
require(path.join(REPO, 'src/business-core/motors/producto/index.js'));
require(path.join(REPO, 'src/business-core/motors/pago/index.js'));
for (const f of ['resolver-edad', 'comision-asegurados', 'tarifa-resolver', 'periodo-importada', 'pago-validador', 'reversion-calc']) {
  require(path.join(REPO, 'src/business-core/motors/pago', f + '.js'));
}
const M = globalThis.MotorPagoE1;
const MP = globalThis.MotorProducto;

let pass = 0, fail = 0;
function t(nombre, fn) {
  try { fn(); pass++; console.log('PASS  ' + nombre); }
  catch (e) { fail++; console.log('FAIL  ' + nombre + '\n      ' + e.message); }
}

const LUISA = {
  producto: 'SPTI', plan: 'PREFERENCIAL', periodicidad: 'MENSUAL', importada: true,
  fechaExp: '2024-11-18', fechaExpOriginal: '2024-11-18',
  sura: { pagadaHasta: '2026-10-18', pagoMaxPendiente: '2026-11-18', corteSura: '2026-10-25' },
  asegurados: [{ fechaNac: '1991-05-21' }]
};
// Pagos registrados antes del corte del reporte (ya reflejados en SURA)
const PAGOS_PREVIOS = [{ fecha: '2026-07-09' }, { fecha: '2026-08-09' }, { fecha: '2026-09-09' }];

// ---------- Periodo siguiente (BR-017, BR-018, BR-019) ----------
t('Periodo: pagos anteriores al corte no cuentan (n = 0)', () => {
  const r = M.periodoSiguienteImportada(LUISA, PAGOS_PREVIOS);
  assert.deepStrictEqual([r.estado, r.n, r.desde, r.hasta], ['OK', 0, '2026-10-18', '2026-11-18']);
});
t('Periodo: el próximo vencimiento sale del pago máximo pendiente de SURA', () => {
  assert.strictEqual(M.periodoSiguienteImportada(LUISA, PAGOS_PREVIOS).proximoVencimiento, '2026-11-18');
});
t('Periodo: un pago posterior al corte avanza el periodo (n = 1)', () => {
  const r = M.periodoSiguienteImportada(LUISA, [...PAGOS_PREVIOS, { fecha: '2026-10-30' }]);
  assert.deepStrictEqual([r.n, r.desde, r.hasta], [1, '2026-11-18', '2026-12-18']);
});
t('Periodo: pago compensado no avanza el periodo', () => {
  const r = M.periodoSiguienteImportada(LUISA, [...PAGOS_PREVIOS, { fecha: '2026-10-30', compensado: true }]);
  assert.strictEqual(r.n, 0);
});
t('Periodo: sin dato de SURA queda BLOQUEADO (BR-020)', () => {
  assert.strictEqual(M.periodoSiguienteImportada({ ...LUISA, sura: undefined }, PAGOS_PREVIOS).motivo, 'SIN_DATO_SURA');
});
t('Periodo: no importada no usa este cálculo', () => {
  assert.strictEqual(M.periodoSiguienteImportada({ ...LUISA, importada: false }, PAGOS_PREVIOS).motivo, 'NO_IMPORTADA');
});

// ---------- Validación de pagos de importadas ----------
const tablas2025 = !!MP.tablasDelAnio(2025);
t('Validador importada, periodo 18-oct a 18-nov-2026 = 160.812 (tabla 2025, si está cargada)', () => {
  const r = M.validarPago(LUISA, PAGOS_PREVIOS, { fecha: '2026-10-20', montoRecibido: 160812, altaKey: 'oct' });
  if (tablas2025) {
    assert.deepStrictEqual([r.estado, r.periodo.desde, r.valorTarifa, r.diferenciaCobro], ['OK', '2026-10-18', 160812, 0]);
  } else {
    assert.deepStrictEqual([r.estado, r.motivo], ['BLOQUEADO', 'TABLA_ANIO_NO_DISPONIBLE']);
  }
});
t('Validador importada, periodo 18-nov a 18-dic-2026 = 167.076 (tabla 2026)', () => {
  const r = M.validarPago(LUISA, [...PAGOS_PREVIOS, { fecha: '2026-10-30' }], { fecha: '2026-11-20', montoRecibido: 167076 });
  assert.deepStrictEqual([r.estado, r.periodo.desde, r.periodo.ciclo, r.valorTarifa], ['OK', '2026-11-18', 2, 167076]);
});
t('Validador importada: misma altaKey es DUPLICADO', () => {
  const pagos = [...PAGOS_PREVIOS, { fecha: '2026-10-30', altaKey: 'k1' }];
  assert.strictEqual(M.validarPago(LUISA, pagos, { fecha: '2026-11-20', montoRecibido: 167076, altaKey: 'k1' }).estado, 'DUPLICADO');
});
t('Validador importada: periodo ya pagado queda PERIODO_YA_PAGADO', () => {
  const pagos = [...PAGOS_PREVIOS, { fecha: '2026-10-30', periodoDesde: '2026-11-18' }];
  assert.strictEqual(M.validarPago(LUISA, pagos, { fecha: '2026-11-20', montoRecibido: 167076 }).estado, 'PERIODO_YA_PAGADO');
});
t('Validador importada sin dato de SURA queda BLOQUEADA (no inventa periodo)', () => {
  const r = M.validarPago({ ...LUISA, sura: undefined }, PAGOS_PREVIOS, { fecha: '2026-10-20', montoRecibido: 160812 });
  assert.strictEqual(r.motivo, 'SIN_DATO_SURA');
});
t('Validador importada: diferencia de cobro no bloquea', () => {
  const r = M.validarPago(LUISA, [...PAGOS_PREVIOS, { fecha: '2026-10-30' }], { fecha: '2026-11-20', montoRecibido: 170000 });
  assert.deepStrictEqual([r.estado, r.diferenciaCobro], ['OK', 2924]);
});

t('Comisión de Luisa en la renovación de 2025: 10.721 con la tabla 2025 (si está cargada)', () => {
  const r = M.comisionPoliza(LUISA, '2026-07-09');
  if (tablas2025) assert.strictEqual(r.comision, 10721);
  else assert.strictEqual(r.motivo, 'TABLA_ANIO_NO_DISPONIBLE');
});

console.log(`\nResultado: ${pass} PASS · ${fail} FAIL`);
process.exit(fail ? 1 : 0);
