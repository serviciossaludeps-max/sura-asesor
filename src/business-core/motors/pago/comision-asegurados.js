/**
 * E1 · Comisión por asegurado (I-2 + C-1)
 * src/business-core/motors/pago/comision-asegurados.js
 *
 * Diseño: DISENO_TECNICO_FASE1_MOTORPAGO v1.3 §1.2, §3.2 y §4.
 *   comision_i = Math.round(base_i * pct_i)   // edad y base propias de cada asegurado
 *   comision_poliza = Σ comision_i
 * Si un solo asegurado está bloqueado, toda la póliza queda BLOQUEADA (sin valor parcial).
 *
 * Reutiliza MotorPago.calcularPorcentajeComision (BR-009/BR-016) y calcularBaseComision.
 * No reimplementa ninguna regla de porcentaje.
 */
(function (global) {
  'use strict';

  const REGLA_VERSION = 'E1.0';
  const PRODUCTOS_E1 = ['SPTI', 'PSM', 'PAC60'];

  function bloqueado(motivo, extra) {
    return Object.assign({
      estado: 'BLOQUEADO', motivo, comision: null, comisionPorAsegurado: [], reglaVersion: REGLA_VERSION
    }, extra || {});
  }

  function comisionPoliza(poliza, fechaPago) {
    const mpago = global.MotorPago;
    const resolver = global.MotorPagoE1 && global.MotorPagoE1.resolverEdadReferencia;
    if (!poliza || !poliza.producto) return bloqueado('POLIZA_INCOMPLETA');
    if (!mpago) return bloqueado('MOTOR_PAGO_NO_DISPONIBLE');
    if (!resolver) return bloqueado('RESOLVER_NO_DISPONIBLE');
    if (PRODUCTOS_E1.indexOf(poliza.producto) < 0) {
      return bloqueado('PRODUCTO_PENDIENTE_E1B', { producto: poliza.producto });
    }
    const aseg = Array.isArray(poliza.asegurados) ? poliza.asegurados : [];
    if (aseg.length === 0) return bloqueado('SIN_ASEGURADOS');
    if (aseg.length > 1 && poliza.producto !== 'SPTI') {
      return bloqueado(poliza.producto === 'PSM' ? 'C3_PENDIENTE' : 'PAC60_MULTI_PENDIENTE');
    }

    const detalle = [];
    for (let i = 0; i < aseg.length; i++) {
      const a = aseg[i];
      const rol = a.rol || (i === 0 ? 'TITULAR' : 'ADICIONAL');
      const r = resolver(a, poliza, fechaPago);
      if (r.estado !== 'OK') return bloqueado(r.motivo, { rol });
      if (r.ciclo >= 1 && poliza.producto !== 'SPTI') {
        return bloqueado('CICLO_2_PENDIENTE_E1B', { rol });
      }

      const guardada = a.primaTotalSinIVA || (aseg.length === 1 ? poliza.primaTotalSinIVA : 0) || 0;
      let base, fuenteBase;
      if (r.ciclo === 0 && guardada > 0) {
        base = guardada; fuenteBase = 'GUARDADO';
      } else if (poliza.producto !== 'SPTI') {
        return bloqueado('FALTA_BASE_GUARDADA', { rol });
      } else {
        if (!poliza.plan) return bloqueado('FALTA_PLAN', { rol });
        if (!poliza.periodicidad) return bloqueado('FALTA_PERIODICIDAD', { rol });
        base = mpago.calcularBaseComision({
          producto: 'SPTI', plan: poliza.plan, periodicidad: poliza.periodicidad, edad: r.edad
        });
        fuenteBase = 'TABLA';
        if (!base || base <= 0) return bloqueado('BASE_NO_DISPONIBLE', { rol });
      }

      const pct = mpago.calcularPorcentajeComision(poliza.producto, r.edad);
      if (pct === null || pct === undefined) return bloqueado('PORCENTAJE_NO_DISPONIBLE', { rol });

      detalle.push({
        rol, edadReferencia: r.edad, fechaReferencia: r.fechaReferencia, ciclo: r.ciclo,
        base, fuenteBase, pct, comision: Math.round(base * pct)
      });
    }

    const total = detalle.reduce((acc, d) => acc + d.comision, 0);
    return { estado: 'OK', comision: total, comisionPorAsegurado: detalle, motivo: null, reglaVersion: REGLA_VERSION };
  }

  global.MotorPagoE1 = Object.assign(global.MotorPagoE1 || {}, { comisionPoliza, REGLA_VERSION });
})(typeof window !== 'undefined' ? window : globalThis);
