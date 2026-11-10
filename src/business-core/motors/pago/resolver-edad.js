/**
 * E1 · Resolver de edad de referencia (R-EDAD + I-1)
 * src/business-core/motors/pago/resolver-edad.js
 *
 * Diseño: DISENO_TECNICO_FASE1_MOTORPAGO v1.3 §1.1 y §11.
 * Pura: sin DOM ni Firestore. Usa MotorProducto (cicloDeFecha, aniversarioEn, edadEnFecha).
 *
 * Regla:
 *   ancla = fechaExpOriginal (si existe) o fechaExp
 *   ciclo k = cicloDeFecha(ancla, fechaPago)
 *   k = 0  -> edad a la fecha del ancla
 *   k >= 1 -> edad a la fecha de renovación del ciclo: aniversarioEn(ancla, k)
 * Nunca usa venta.edad. Sin fecha de nacimiento o sin ancla, bloquea con motivo.
 */
(function (global) {
  'use strict';

  function resolverEdadReferencia(asegurado, poliza, fechaPago) {
    const mp = global.MotorProducto;
    if (!mp) return { estado: 'BLOQUEADO', motivo: 'MOTOR_PRODUCTO_NO_DISPONIBLE' };
    if (!asegurado || !asegurado.fechaNac) return { estado: 'BLOQUEADO', motivo: 'FALTA_FECHA_NACIMIENTO' };
    const ancla = (poliza && (poliza.fechaExpOriginal || poliza.fechaExp)) || null;
    if (!ancla) return { estado: 'BLOQUEADO', motivo: 'FALTA_ANCLA' };
    const ciclo = mp.cicloDeFecha(ancla, fechaPago);
    if (ciclo === null || ciclo === undefined) return { estado: 'BLOQUEADO', motivo: 'FECHA_INVALIDA' };
    const fechaReferencia = ciclo === 0 ? ancla : mp.aniversarioEn(ancla, ciclo);
    const edad = mp.edadEnFecha(asegurado.fechaNac, fechaReferencia);
    if (edad === null || edad === undefined) return { estado: 'BLOQUEADO', motivo: 'EDAD_NO_CALCULABLE' };
    return { estado: 'OK', edad, ciclo, fechaReferencia };
  }

  global.MotorPagoE1 = Object.assign(global.MotorPagoE1 || {}, { resolverEdadReferencia });
})(typeof window !== 'undefined' ? window : globalThis);
