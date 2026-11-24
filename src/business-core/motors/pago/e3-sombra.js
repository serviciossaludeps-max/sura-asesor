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
  // Opción A (aprobada por el PO, 23-nov-2026): pólizas canceladas con pagos sin fecha de nacimiento.
  // Se clasifican como NO_EVALUABLE aceptado. No se corrige ningún dato. Condición: verificar en el CRM
  // que el estado es cancelado y que no hay pagos posteriores a la cancelación.
  const POLIZAS_CANCELADAS_ACEPTADAS = ['1642318', '1648606', '1648600', '1648624', '1649227', '1668208', '1668200', '1670358', '090001630836', '090001593465', '090001614977'];
  function esCanceladaAceptada(v) { return POLIZAS_CANCELADAS_ACEPTADAS.indexOf(String(v.poliza)) !== -1; }

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
    const ajustesUsados = new Set();
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
        if (esCanceladaAceptada(v)) {
          fila.resultado = 'NO_EVALUABLE'; fila.motivo = 'POLIZA_CANCELADA_ACEPTADA_PO';
          filas.push(fila); return;
        }
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
          if (fila.resultado === 'DIFERENCIA') {
            // Error del CRM ya tratado: ajuste pendiente con la misma póliza, comisión pagada y comisión correcta.
            const aj = (v.ajustesComision || []).find(a => a && a.estado === 'PENDIENTE_LIQUIDACION'
              && a.poliza === fila.poliza && Number(a.comisionPagada) === fila.registrado
              && Number(a.comisionCorrecta) === r.comision && !ajustesUsados.has(a.id));
            if (aj) { fila.resultado = 'DIFERENCIA_CON_AJUSTE'; fila.ajuste = aj.id; ajustesUsados.add(aj.id); }
          }
        }
        filas.push(fila);
      });
    });

    const resumen = { COINCIDE: 0, DIFERENCIA: 0, DIFERENCIA_CON_AJUSTE: 0, NO_EVALUABLE: 0, ERROR: 0, noEvaluablePorMotivo: {} };
    filas.forEach(f => {
      resumen[f.resultado] = (resumen[f.resultado] || 0) + 1;
      if (f.resultado === 'NO_EVALUABLE') resumen.noEvaluablePorMotivo[f.motivo] = (resumen.noEvaluablePorMotivo[f.motivo] || 0) + 1;
    });
    return { estado: 'OK', modo: 'SOMBRA_E3_SOLO_LECTURA', pagosEvaluados: filas.length, resumen, filas };
  }

  global.MotorPagoE3 = { ejecutar };
})(typeof window !== 'undefined' ? window : globalThis);
