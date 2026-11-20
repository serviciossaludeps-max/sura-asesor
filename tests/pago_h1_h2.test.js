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

// ── Pruebas del cobro escalonado (interfaz H-1/H-2) ──
t('1 cobro completo sin montoRecibido: 22.276 (7 % de 318.240, C-1 por asegurado)', () => {
  const r = E1.comisionPoliza(poliza(), '2026-09-22');
  assert.strictEqual(r.estado, 'OK'); assert.strictEqual(r.comision, 22276); assert.strictEqual(r.cobroParcial, null);
});
t('2 cobro completo con montoRecibido igual al periodo: no cambia', () => {
  const r = E1.comisionPoliza(poliza(), '2026-09-22', { montoRecibido: con(2 * B) });
  assert.strictEqual(r.comision, 22276); assert.strictEqual(r.cobroParcial, null);
});
t('3 cobro parcial de 159.120 asignado al asegurado 1001: pago 11.138 solo para 1001', () => {
  const r = E1.comisionPoliza(poliza(), '2026-09-11', cobro(B, '1001', 'r1'));
  assert.strictEqual(r.estado, 'OK'); assert.strictEqual(r.comision, 11138);
  assert.strictEqual(porRef(r, '1001').comision, 11138); assert.strictEqual(porRef(r, '1002').comision, 0);
});
t('4 cobro parcial de 143.208 asignado al asegurado 1002: pago 10.025 (C-1 individual, no 10.024)', () => {
  const r = E1.comisionPoliza(poliza(), '2026-09-11', cobro(143208, '1002', 'r2'));
  assert.strictEqual(r.comision, 10025);
  assert.strictEqual(porRef(r, '1002').comision, 10025); assert.strictEqual(porRef(r, '1001').comision, 0);
  assert.strictEqual(porRef(r, '1002').baseCobradaPago, 143208);
});
t('5 monto recibido invalido -> BLOQUEADO', () => {
  const r = E1.comisionPoliza(poliza(), '2026-09-11', { montoRecibido: -5, aseguradoRef: '1001', periodoDesde: PERIODO });
  assert.strictEqual(r.estado, 'BLOQUEADO'); assert.strictEqual(r.motivo, 'MONTO_RECIBIDO_INVALIDO');
});
t('6 cobro parcial sin asegurado identificado -> BLOQUEADO FALTA_ASEGURADO (no se asigna por posicion)', () => {
  const r = E1.comisionPoliza(poliza(), '2026-09-11', { montoRecibido: con(143208), periodoDesde: PERIODO });
  assert.strictEqual(r.estado, 'BLOQUEADO'); assert.strictEqual(r.motivo, 'FALTA_ASEGURADO'); assert.strictEqual(r.comision, null);
});

// ── H-1: asignación del cobro al asegurado correcto ──
t('H1-a cobro asignado a 1002 no altera la comision de 1001 (0 en este pago)', () => {
  const r = E1.comisionPoliza(poliza(), '2026-09-11', cobro(143208, '1002', 'h1a'));
  assert.strictEqual(porRef(r, '1001').comision, 0); assert.strictEqual(porRef(r, '1001').baseCobradaPago, 0);
});
t('H1-b resultado independiente del orden de los asegurados en el arreglo', () => {
  const p1 = E1.comisionPoliza(poliza(), '2026-09-11', cobro(143208, '1002', 'h1b'));
  const inv = poliza(); inv.asegurados = inv.asegurados.slice().reverse();
  const p2 = E1.comisionPoliza(inv, '2026-09-11', cobro(143208, '1002', 'h1b'));
  assert.strictEqual(p1.comision, p2.comision); assert.strictEqual(porRef(p2, '1002').comision, 10025);
});
t('H1-c asegurado asignado inexistente -> ASEGURADO_NO_ENCONTRADO', () => {
  const r = E1.comisionPoliza(poliza(), '2026-09-11', cobro(143208, '9999', 'h1c'));
  assert.strictEqual(r.motivo, 'ASEGURADO_NO_ENCONTRADO');
});
t('H1-d documentos duplicados en la poliza -> IDENTIFICADOR_DUPLICADO', () => {
  const p = poliza(); p.asegurados[1].doc = '1001';
  const r = E1.comisionPoliza(p, '2026-09-11', cobro(143208, '1001', 'h1d'));
  assert.strictEqual(r.motivo, 'IDENTIFICADOR_DUPLICADO');
});
t('H1-e asegurado sin documento -> FALTA_ASEGURADO', () => {
  const p = poliza(); p.asegurados[1].doc = null;
  const r = E1.comisionPoliza(p, '2026-09-11', cobro(143208, '1002', 'h1e'));
  assert.strictEqual(r.motivo, 'FALTA_ASEGURADO');
});
t('H1-f cobro parcial sin periodoDesde -> FALTA_PERIODO_COBRO', () => {
  const r = E1.comisionPoliza(poliza(), '2026-09-11', { montoRecibido: con(143208), aseguradoRef: '1002', id: 'h1f' });
  assert.strictEqual(r.motivo, 'FALTA_PERIODO_COBRO');
});

// ── H-2: acumulación por asegurado y periodo ──
t('H2-a caso 1729322: 143.208 (10.025) + 15.912 (1.113) = 11.138 total de B, no 11.139', () => {
  const r1 = E1.comisionPoliza(poliza(), '2026-09-11', cobro(143208, '1002', 'r1'));
  assert.strictEqual(r1.comision, 10025);
  const prev = [{ id: 'r1', aseguradoRef: '1002', periodoDesde: PERIODO, baseCobrada: 143208, comision: 10025 }];
  const r2 = E1.comisionPoliza(poliza(), '2026-10-05', Object.assign(cobro(15912, '1002', 'r2'), { cobrosPrevios: prev }));
  assert.strictEqual(r2.comision, 1113);
  assert.strictEqual(porRef(r2, '1002').comisionAcumulada, 11138);
  assert.strictEqual(r1.comision + r2.comision, 11138);
});
t('H2-b orden inverso (15.912 primero): pagos 1.114 + 10.024, total 11.138', () => {
  const a = E1.comisionPoliza(poliza(), '2026-09-05', cobro(15912, '1002', 'x1'));
  assert.strictEqual(a.comision, 1114);
  const prev = [{ id: 'x1', aseguradoRef: '1002', periodoDesde: PERIODO, baseCobrada: 15912, comision: 1114 }];
  const b = E1.comisionPoliza(poliza(), '2026-09-11', Object.assign(cobro(143208, '1002', 'x2'), { cobrosPrevios: prev }));
  assert.strictEqual(b.comision, 10024);
  assert.strictEqual(a.comision + b.comision, 11138);
});
t('H2-c varios cobros del mismo asegurado (50.000, 50.000, 59.120): 3.500 + 3.500 + 4.138 = 11.138', () => {
  const p1 = E1.comisionPoliza(poliza(), '2026-09-01', cobro(50000, '1001', 'm1'));
  const c1 = [{ id: 'm1', aseguradoRef: '1001', periodoDesde: PERIODO, baseCobrada: 50000, comision: p1.comision }];
  const p2 = E1.comisionPoliza(poliza(), '2026-09-10', Object.assign(cobro(50000, '1001', 'm2'), { cobrosPrevios: c1 }));
  const c2 = c1.concat([{ id: 'm2', aseguradoRef: '1001', periodoDesde: PERIODO, baseCobrada: 50000, comision: p2.comision }]);
  const p3 = E1.comisionPoliza(poliza(), '2026-09-20', Object.assign(cobro(59120, '1001', 'm3'), { cobrosPrevios: c2 }));
  assert.deepStrictEqual([p1.comision, p2.comision, p3.comision], [3500, 3500, 4138]);
  assert.strictEqual(p1.comision + p2.comision + p3.comision, 11138);
});
t('H2-d tope: cobro adicional despues de cubrir el periodo paga 0 y reporta excedente', () => {
  const prev = [
    { id: 'a', aseguradoRef: '1002', periodoDesde: PERIODO, baseCobrada: 143208, comision: 10025 },
    { id: 'b', aseguradoRef: '1002', periodoDesde: PERIODO, baseCobrada: 15912, comision: 1113 }];
  const r = E1.comisionPoliza(poliza(), '2026-10-10', Object.assign(cobro(10000, '1002', 'c'), { cobrosPrevios: prev }));
  assert.strictEqual(r.comision, 0);
  assert.strictEqual(porRef(r, '1002').excedenteBase, 10000);
});
t('H2-e repetir el mismo calculo no cambia el resultado (determinista, sin duplicar)', () => {
  const prev = [{ id: 'r1', aseguradoRef: '1002', periodoDesde: PERIODO, baseCobrada: 143208, comision: 10025 }];
  const args = [poliza(), '2026-10-05', Object.assign(cobro(15912, '1002', 'r2'), { cobrosPrevios: prev })];
  const a = E1.comisionPoliza(...args), b = E1.comisionPoliza(...args);
  assert.strictEqual(a.comision, 1113); assert.strictEqual(b.comision, 1113);
});
t('H2-f el cobro que ya figura entre los previos (mismo id) no se cuenta dos veces', () => {
  const prev = [
    { id: 'r1', aseguradoRef: '1002', periodoDesde: PERIODO, baseCobrada: 143208, comision: 10025 },
    { id: 'r2', aseguradoRef: '1002', periodoDesde: PERIODO, baseCobrada: 15912, comision: 1113 }];
  const r = E1.comisionPoliza(poliza(), '2026-10-05', Object.assign(cobro(15912, '1002', 'r2'), { cobrosPrevios: prev }));
  assert.strictEqual(r.comision, 1113);
});
t('H2-g cobro completo despues de un parcial paga solo lo que falta (1002: 11.138 - 10.025 = 1.113)', () => {
  const prev = [{ id: 'r1', aseguradoRef: '1002', periodoDesde: PERIODO, baseCobrada: 143208, comision: 10025 }];
  const r = E1.comisionPoliza(poliza(), '2026-10-22', { cobrosPrevios: prev, periodoDesde: PERIODO, id: 'full' });
  assert.strictEqual(porRef(r, '1001').comision, 11138);
  assert.strictEqual(porRef(r, '1002').comision, 1113);
  assert.strictEqual(r.comision, 12251);
});
t('H2-h cobros previos de otro periodo no cuentan', () => {
  const prev = [{ id: 'old', aseguradoRef: '1002', periodoDesde: '2026-07-22', baseCobrada: 143208, comision: 10025 }];
  const r = E1.comisionPoliza(poliza(), '2026-09-22', { cobrosPrevios: prev, periodoDesde: PERIODO, id: 'f' });
  assert.strictEqual(r.comision, 22276);
});
t('H2-i cobro previo sin asegurado identificado -> COBRO_PREVIO_INCOMPLETO', () => {
  const prev = [{ id: 'p', periodoDesde: PERIODO, baseCobrada: 143208, comision: 10025 }];
  const r = E1.comisionPoliza(poliza(), '2026-09-22', { cobrosPrevios: prev, periodoDesde: PERIODO, id: 'f' });
  assert.strictEqual(r.motivo, 'COBRO_PREVIO_INCOMPLETO');
});
t('H2-j serie de 5 cobros parciales de B: nunca supera 11.138 y el acumulado final es exacto', () => {
  const montos = [30000, 40000, 20000, 40000, 29120];   // suma 159.120
  let previos = [], acumulado = 0;
  montos.forEach((m, i) => {
    const r = E1.comisionPoliza(poliza(), '2026-09-' + String(i + 1).padStart(2, '0'),
      Object.assign(cobro(m, '1002', 'k' + i), { cobrosPrevios: previos }));
    assert.strictEqual(r.estado, 'OK');
    acumulado += r.comision;
    assert.ok(acumulado <= 11138, 'supera el tope en el cobro ' + i);
    previos = previos.concat([{ id: 'k' + i, aseguradoRef: '1002', periodoDesde: PERIODO, baseCobrada: m, comision: r.comision }]);
  });
  assert.strictEqual(acumulado, 11138);
});

// ── Regresión de reglas vigentes ──
t('R1 PSM de grupo sin base guardada sigue BLOQUEADO (regla vigente)', () => {
  const p = { producto: 'PSM', periodicidad: 'MENSUAL', fechaExp: '2026-09-07',
    asegurados: [ { doc: '1', fechaNac: '1994-01-04', modulos: ['Basico'] }, { doc: '2', fechaNac: '2024-06-15', modulos: ['Basico'] } ] };
  const r = E1.comisionPoliza(p, '2026-10-07');
  assert.strictEqual(r.estado, 'BLOQUEADO'); assert.strictEqual(r.motivo, 'FALTA_BASE_GUARDADA');
});
t('R2 SPD 2025 sigue disponible solo para 2025 (2024 y 2026 no cambian)', () => {
  const t24 = MP.tablasDelAnio(2024);
  assert.ok(!t24 || !t24.SPD, '2024 no debe tener SPD');
  assert.strictEqual(MP.tablasDelAnio(2026).SPD.sinIVA.MENSUAL, 92070);
});

console.log('\nResultado: ' + pass + ' PASS · ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
