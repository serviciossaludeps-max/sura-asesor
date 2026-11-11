/**
 * E1c · Reversión por compensación (ReversionCalc)
 * src/business-core/motors/pago/reversion-calc.js
 *
 * Diseño v1.3 §3.3 y D4 (c): compensar, no borrar.
 *  - Exige motivo.
 *  - Un pago solo se compensa una vez (segunda compensación -> RECHAZADO).
 *  - Si la comisión ya está liquidada, el evento marca PENDIENTE_LIQUIDACION.
 *  - Devuelve el evento; no modifica el pago ni borra nada.
 */
(function (global) {
  'use strict';

  function compensarPago(pago, motivo) {
    if (!pago) return { estado: 'RECHAZADO', motivo: 'PAGO_NO_EXISTE' };
    if (pago.compensado) return { estado: 'RECHAZADO', motivo: 'YA_COMPENSADO' };
    const texto = motivo == null ? '' : String(motivo).trim();
    if (!texto) return { estado: 'RECHAZADO', motivo: 'MOTIVO_OBLIGATORIO' };
    const liquidada = !!pago.comisionLiquidada;
    return {
      estado: 'OK', motivo: null,
      evento: {
        tipo: 'COMPENSACION',
        pagoId: pago.id,
        motivo: texto,
        montoCompensado: pago.montoRecibido,
        comisionCompensada: pago.comision,
        estadoComision: liquidada ? 'PENDIENTE_LIQUIDACION' : 'REVERSADA_SIN_LIQUIDAR'
      },
      borraRegistro: false
    };
  }

  global.MotorPagoE1 = Object.assign(global.MotorPagoE1 || {}, { compensarPago });
})(typeof window !== 'undefined' ? window : globalThis);
