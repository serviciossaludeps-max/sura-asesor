/* Pruebas E1c · TarifaResolver, PagoValidador y ReversionCalc. Ejecutar: node tests/pago_e1c.test.js
   Requiere el repositorio con business-config/, src/business-core/motors/producto/index.js,
   src/business-core/motors/pago/index.js y los módulos E1/E1b/E1c en src/business-core/motors/pago/. */
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

let pass = 0, fail = 0;
function t(nombre, fn) {
  try { fn(); pass++; console.log('PASS  ' + nombre); }
  catch (e) { fail++; console.log('FAIL  ' + nombre + '\n      ' + e.message); }
}

// ---------- TarifaResolver ----------
t('Tarifa ciclo 0 con valor guardado (primaTotal) por asegurado', () => {
  const p = { producto: 'SPTI', plan: 'CLASICO', periodicidad: 'MENSUAL', fechaExp: '2025-03-10',
    asegurados: [{ fechaNac: '1985-03-10', primaTotal: 147480 }] };
  const r = M.tarifaPeriodo(p, '2025-04-10');
  assert.deepStrictEqual([r.estado, r.valorTarifa, r.ciclo], ['OK', 147480, 0]);
  assert.strictEqual(r.detalle[0].fuente, 'GUARDADO');
});
t('Tarifa SPTI ciclo 1: Clásico 41 años = 161.309 con IVA (tabla 2026)', () => {
  const p = { producto: 'SPTI', plan: 'CLASICO', periodicidad: 'MENSUAL', fechaExp: '2025-03-10',
    asegurados: [{ fechaNac: '1985-03-10' }] };
  assert.strictEqual(M.tarifaPeriodo(p, '2026-03-10').valorTarifa, 161309);
});
t('Tarifa PSM ciclo 1 con dos asegurados: suma por módulo = 954.174', () => {
  const p = { producto: 'PSM', periodicidad: 'MENSUAL', fechaExp: '2025-03-10', asegurados: [
    { fechaNac: '1985-03-10', modulos: ['Básico'] },
    { fechaNac: '1974-03-10', modulos: ['Básico', 'Alto Costo'] }
  ]};
  const r = M.tarifaPeriodo(p, '2026-03-10');
  assert.strictEqual(r.valorTarifa, 317053 + 637121);
  assert.deepStrictEqual(r.detalle.map(d => d.valor), [317053, 637121]);
});
t('Tarifa PAC60 ciclo 1: el anexo se cobra solo al asegurado que lo tiene', () => {
  const p = { producto: 'PAC60', periodicidad: 'MENSUAL', fechaExp: '2025-03-10', asegurados: [
    { fechaNac: '1961-03-10', conAnexo: false }, { fechaNac: '1961-03-10', conAnexo: true }
  ]};
  const r = M.tarifaPeriodo(p, '2026-03-10');
  assert.deepStrictEqual(r.detalle.map(d => d.valor), [358398, 387195]);
});
t('Tarifa SPD ciclo 1 en vigencia = 96.674 (tabla 2026 con IVA)', () => {
  const p = { producto: 'SPD', periodicidad: 'MENSUAL', fechaExp: '2025-05-10', primaTotalSinIVA: 100000, asegurados: [{}] };
  assert.strictEqual(M.tarifaPeriodo(p, '2026-05-10').valorTarifa, 96674);
});
t('Tarifa SPD ciclo 1 fuera de vigencia queda BLOQUEADA', () => {
  const p = { producto: 'SPD', periodicidad: 'MENSUAL', fechaExp: '2025-03-10', primaTotalSinIVA: 100000, asegurados: [{}] };
  assert.strictEqual(M.tarifaPeriodo(p, '2026-03-10').motivo, 'SPD_FUERA_DE_VIGENCIA');
});
t('Tarifa ciclo 1 en un año sin tabla queda BLOQUEADA (no usa 2026)', () => {
  const p = { producto: 'SPTI', plan: 'CLASICO', periodicidad: 'MENSUAL', fechaExp: '2025-03-10',
    asegurados: [{ fechaNac: '1985-03-10' }] };
  const r = M.tarifaPeriodo(p, '2027-03-10');
  assert.strictEqual(r.estado, 'BLOQUEADO');
  assert.strictEqual(r.motivo, 'TABLA_ANIO_NO_DISPONIBLE');
});
t('Tarifa sin valor guardado en ciclo 0 queda BLOQUEADA', () => {
  const p = { producto: 'SPTI', plan: 'CLASICO', periodicidad: 'MENSUAL', fechaExp: '2025-03-10',
    asegurados: [{ fechaNac: '1985-03-10' }] };
  assert.strictEqual(M.tarifaPeriodo(p, '2025-04-10').motivo, 'FALTA_VALOR_GUARDADO');
});

// ---------- PagoValidador ----------
const SPTI_OK = { producto: 'SPTI', plan: 'CLASICO', periodicidad: 'MENSUAL', fechaExp: '2025-03-10',
  asegurados: [{ fechaNac: '1985-03-10', primaTotal: 147480 }] };
t('Validador: primer pago OK, periodo 10-mar a 10-abr, sin diferencia', () => {
  const r = M.validarPago(SPTI_OK, [], { fecha: '2025-04-10', montoRecibido: 147480, altaKey: 'k1' });
  assert.deepStrictEqual([r.estado, r.periodo.desde, r.periodo.hasta, r.diferenciaCobro], ['OK', '2025-03-10', '2025-04-10', 0]);
});
t('Validador: montoRecibido distinto no bloquea, queda como diferenciaCobro', () => {
  const r = M.validarPago(SPTI_OK, [], { fecha: '2025-04-10', montoRecibido: 150000 });
  assert.deepStrictEqual([r.estado, r.diferenciaCobro], ['OK', 2520]);
});
t('Validador: misma altaKey es DUPLICADO (idempotencia)', () => {
  const r = M.validarPago(SPTI_OK, [{ altaKey: 'k1', periodoDesde: '2025-03-10' }],
    { fecha: '2025-05-10', montoRecibido: 147480, altaKey: 'k1' });
  assert.strictEqual(r.estado, 'DUPLICADO');
});
t('Validador: periodo ya pagado queda PERIODO_YA_PAGADO', () => {
  const r = M.validarPago(SPTI_OK, [{ periodoDesde: '2025-04-10' }], { fecha: '2025-05-10', montoRecibido: 147480 });
  assert.strictEqual(r.estado, 'PERIODO_YA_PAGADO');
});
t('Validador: pago compensado no cuenta para el siguiente periodo', () => {
  const r = M.validarPago(SPTI_OK, [{ periodoDesde: '2025-03-10', compensado: true }], { fecha: '2025-04-10', montoRecibido: 147480 });
  assert.strictEqual(r.periodo.desde, '2025-03-10');
});
t('Validador: monto cero se rechaza', () => {
  assert.strictEqual(M.validarPago(SPTI_OK, [], { fecha: '2025-04-10', montoRecibido: 0 }).motivo, 'MONTO_INVALIDO');
});
t('Validador: fecha inválida se rechaza', () => {
  assert.strictEqual(M.validarPago(SPTI_OK, [], { fecha: '2025-02-30', montoRecibido: 147480 }).motivo, 'FECHA_INVALIDA');
});
t('Validador: importada sin dato de SURA queda BLOQUEADA (BR-020)', () => {
  assert.strictEqual(M.validarPago({ ...SPTI_OK, importada: true }, [], { fecha: '2025-04-10', montoRecibido: 147480 }).motivo, 'SIN_DATO_SURA');
});
t('Validador: no escribe ni modifica pagos existentes', () => {
  const pagos = [{ periodoDesde: '2025-03-10' }];
  const antes = JSON.stringify(pagos);
  M.validarPago(SPTI_OK, pagos, { fecha: '2025-05-10', montoRecibido: 147480 });
  assert.strictEqual(JSON.stringify(pagos), antes);
});

// ---------- ReversionCalc ----------
t('Reversión: evento de compensación con motivo, sin borrar el pago', () => {
  const r = M.compensarPago({ id: 'p1', montoRecibido: 147480, comision: 10000 }, 'Error de digitación');
  assert.deepStrictEqual([r.estado, r.evento.tipo, r.evento.pagoId, r.borraRegistro], ['OK', 'COMPENSACION', 'p1', false]);
  assert.strictEqual(r.evento.estadoComision, 'REVERSADA_SIN_LIQUIDAR');
});
t('Reversión: comisión ya liquidada queda PENDIENTE_LIQUIDACION (D4 c)', () => {
  const r = M.compensarPago({ id: 'p1', montoRecibido: 147480, comision: 10000, comisionLiquidada: true }, 'Duplicado');
  assert.strictEqual(r.evento.estadoComision, 'PENDIENTE_LIQUIDACION');
});
t('Reversión: sin motivo se rechaza', () => {
  assert.strictEqual(M.compensarPago({ id: 'p1' }, '   ').motivo, 'MOTIVO_OBLIGATORIO');
});
t('Reversión: segunda compensación del mismo pago se rechaza', () => {
  assert.strictEqual(M.compensarPago({ id: 'p1', compensado: true }, 'otra vez').motivo, 'YA_COMPENSADO');
});
t('Reversión: pago inexistente se rechaza', () => {
  assert.strictEqual(M.compensarPago(null, 'x').motivo, 'PAGO_NO_EXISTE');
});

console.log(`\nResultado: ${pass} PASS · ${fail} FAIL`);
process.exit(fail ? 1 : 0);
