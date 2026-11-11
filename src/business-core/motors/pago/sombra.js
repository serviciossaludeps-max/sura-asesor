/**
 * E2 · Modo sombra (offline)
 * src/business-core/motors/pago/sombra.js
 *
 * Diseño v1.3 §7.1. Compara el motor (comisionPoliza) con la comisión registrada en cada pago.
 * Puro: no escribe nada, no llama a Firestore ni al DOM.
 *
 * Clasificación automática solo para lo verificable:
 *   COINCIDE       -> motor = registrado
 *   NO_EVALUABLE   -> falta un dato (motivo del motor)
 *   DIFERENCIA     -> motor != registrado; requiere clasificación A/C/D por el PO
 */
(function (global) {
  'use strict';

  function adaptarVenta(v) {
    const multi = Array.isArray(v.asegurados) && v.asegurados.length > 0;
    const aseg = [{
      rol: 'TITULAR',
      fechaNac: v.fechaNac,
      modulos: v.modulos,
      conAnexo: v.conAnexo,
      // Con adicionales, la prima sin IVA del titular no es individual en el registro: no se asume.
      primaTotalSinIVA: multi ? undefined : v.primaTotalSinIVA,
      primaTotal: multi ? undefined : v.primaTotal
    }];
    (v.asegurados || []).forEach(a => aseg.push({
      rol: 'ADICIONAL',
      fechaNac: a.fechaNac,
      modulos: a.modulos,
      conAnexo: a.conAnexo,
      primaTotalSinIVA: a.primaTotalSinIVA,
      primaTotal: a.primaTotal
    }));
    return {
      producto: v.producto,
      plan: v.plan,
      periodicidad: v.periodicidad,
      fechaExp: v.fechaExp,
      fechaExpOriginal: v.fechaExpOriginal,
      importada: !!v.importada,
      sura: v.importada ? { pagadaHasta: v.pagadaHasta, pagoMaxPendiente: v.pagoMaxPendiente, corteSura: v.corteSura } : undefined,
      primaTotalSinIVA: v.primaTotalSinIVA,
      asegurados: aseg
    };
  }

  function evaluarVenta(v) {
    const pagos = Array.isArray(v.pagos) ? v.pagos : [];
    const poliza = adaptarVenta(v);
    return pagos.map(p => {
      const base = { ventaId: v.id, pagoFecha: p.fecha || null };
      if (!p.fecha) return Object.assign(base, { resultado: 'NO_EVALUABLE', motivo: 'FALTA_FECHA_PAGO' });
      if (p.comision === undefined || p.comision === null) {
        return Object.assign(base, { resultado: 'NO_EVALUABLE', motivo: 'FALTA_COMISION_REGISTRADA' });
      }
      const r = global.MotorPagoE1.comisionPoliza(poliza, p.fecha);
      if (r.estado !== 'OK') return Object.assign(base, { resultado: 'NO_EVALUABLE', motivo: r.motivo, rol: r.rol });
      const diferencia = r.comision - p.comision;
      return Object.assign(base, {
        resultado: diferencia === 0 ? 'COINCIDE' : 'DIFERENCIA',
        motor: r.comision, registrado: p.comision, diferencia
      });
    });
  }

  function resumir(filas) {
    const r = { total: filas.length, COINCIDE: 0, NO_EVALUABLE: 0, DIFERENCIA: 0, noEvaluablePorMotivo: {}, diferencias: [] };
    filas.forEach(f => {
      r[f.resultado] = (r[f.resultado] || 0) + 1;
      if (f.resultado === 'NO_EVALUABLE') r.noEvaluablePorMotivo[f.motivo] = (r.noEvaluablePorMotivo[f.motivo] || 0) + 1;
      if (f.resultado === 'DIFERENCIA') r.diferencias.push({ ventaId: f.ventaId, pagoFecha: f.pagoFecha, motor: f.motor, registrado: f.registrado, diferencia: f.diferencia });
    });
    r.porClasificar = r.diferencias.length;
    r.criterioSinDiferenciasSinClasificar = r.porClasificar === 0;
    r.porcentajeNoEvaluable = r.total ? Math.round(1000 * r.NO_EVALUABLE / r.total) / 10 : 0;
    return r;
  }

  global.MotorPagoE2 = { adaptarVenta, evaluarVenta, resumir };
})(typeof window !== 'undefined' ? window : globalThis);
