/**
 * E3 · Sombra del MotorPago dentro del CRM.
 * Compara la comisión registrada en cada pago con comisionPoliza (MotorPagoE1).
 * PURA: no escribe en el estado, en localStorage, en Firestore ni en la UI. No cambia comisiones.
 * Pagos legados (sin montoRecibido ni cobrosPrevios) se evalúan como cobro completo.
 */
(function (global) {
  'use strict';

  // Opción B (aprobada por el PO, 23-nov-2026): importadas con adicionales en aseguradosImport y sin array
  // asegurados. El motor no lee aseguradosImport; quedan fuera de la sombra hasta que E3 defina su estructura.
  // SPD no se excluye: su tarifa es única por póliza y no depende de los asegurados.
  function esImportadaConAdicionalesFueraDeMotor(v) {
    if (v.producto !== 'SPTI' && v.producto !== 'PSM' && v.producto !== 'PAC60') return false;
    const sinArray = !Array.isArray(v.asegurados) || v.asegurados.length === 0;
    return sinArray && Array.isArray(v.aseguradosImport) && v.aseguradosImport.length > 0;
  }

  function ejecutar(ventas, pagosPorVenta) {
    const E1 = global.MotorPagoE1, E2 = global.MotorPagoE2;
    if (!E1) return { estado: 'NO_DISPONIBLE', motivo: 'MOTOR_PAGO_E1_NO_CARGADO', filas: [], resumen: {} };
    if (!E2) return { estado: 'NO_DISPONIBLE', motivo: 'SOMBRA_E2_NO_CARGADA', filas: [], resumen: {} };

    const filas = [];
    (ventas || []).forEach(v => {
      const pagos = (pagosPorVenta && pagosPorVenta[v.id]) || [];
      if (!pagos.length) return;
      let poliza = null, errorAdaptar = null;
      try { poliza = E2.adaptarVenta(v); } catch (e) { errorAdaptar = String(e && e.message || e); }
      pagos.forEach(p => {
        const fila = {
          ventaId: v.id, poliza: v.poliza || null, producto: v.producto || null,
          pagoId: p.id || null, pagoFecha: String(p.fecha || '').slice(0, 10),
          registrado: Number(p.comision)
        };
        if (esImportadaConAdicionalesFueraDeMotor(v)) {
          fila.resultado = 'NO_EVALUABLE'; fila.motivo = 'IMPORTADA_CON_ADICIONALES_FUERA_DE_MOTOR';
          filas.push(fila); return;
        }
        if (errorAdaptar) { fila.resultado = 'ERROR'; fila.motivo = 'ADAPTADOR: ' + errorAdaptar; filas.push(fila); return; }
        let r;
        try { r = E1.comisionPoliza(poliza, fila.pagoFecha); }
        catch (e) { fila.resultado = 'ERROR'; fila.motivo = 'EXCEPCION: ' + String(e && e.message || e); filas.push(fila); return; }
        if (r.estado !== 'OK') {
          fila.resultado = 'NO_EVALUABLE'; fila.motivo = r.motivo || 'SIN_MOTIVO';
        } else {
          fila.motor = r.comision;
          fila.diferencia = fila.registrado - r.comision;
          fila.resultado = fila.diferencia === 0 ? 'COINCIDE' : 'DIFERENCIA';
        }
        filas.push(fila);
      });
    });

    const resumen = { COINCIDE: 0, DIFERENCIA: 0, NO_EVALUABLE: 0, ERROR: 0, noEvaluablePorMotivo: {} };
    filas.forEach(f => {
      resumen[f.resultado] = (resumen[f.resultado] || 0) + 1;
      if (f.resultado === 'NO_EVALUABLE') resumen.noEvaluablePorMotivo[f.motivo] = (resumen.noEvaluablePorMotivo[f.motivo] || 0) + 1;
    });
    return { estado: 'OK', modo: 'SOMBRA_E3_SOLO_LECTURA', pagosEvaluados: filas.length, resumen, filas };
  }

  global.MotorPagoE3 = { ejecutar };
})(typeof window !== 'undefined' ? window : globalThis);
