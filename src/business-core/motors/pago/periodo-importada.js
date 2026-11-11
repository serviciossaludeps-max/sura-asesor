/**
 * E1d · Periodo siguiente de una póliza importada (cartera SURA)
 * src/business-core/motors/pago/periodo-importada.js
 *
 * Reglas: BR-017 (solo cuentan los pagos con fecha >= corte del reporte),
 *         BR-018 (vencimiento desde el pago máximo pendiente), BR-019 (pagada hasta),
 *         BR-020 (sin dato de SURA no se calcula periodo).
 *   desde   = pagadaHasta + n × intervalo
 *   hasta   = pagadaHasta + (n+1) × intervalo
 *   próximo vencimiento = pagoMaxPendiente + n × intervalo
 * Pura: no escribe nada.
 */
(function (global) {
  'use strict';

  const INTERVALO = { MENSUAL: 1, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12 };

  function periodoSiguienteImportada(poliza, pagos) {
    const mp = global.MotorProducto;
    if (!mp) return { estado: 'BLOQUEADO', motivo: 'MOTOR_PRODUCTO_NO_DISPONIBLE' };
    if (!poliza || !poliza.importada) return { estado: 'BLOQUEADO', motivo: 'NO_IMPORTADA' };
    const s = poliza.sura || {};
    if (!s.pagadaHasta || !s.pagoMaxPendiente || !s.corteSura) {
      return { estado: 'BLOQUEADO', motivo: 'SIN_DATO_SURA' };
    }
    const intervalo = INTERVALO[poliza.periodicidad];
    if (!intervalo) return { estado: 'BLOQUEADO', motivo: 'PERIODICIDAD_INVALIDA' };

    const tras = (Array.isArray(pagos) ? pagos : []).filter(p => !p.compensado && p.fecha && p.fecha >= s.corteSura);
    const n = tras.length;
    const desde = mp.sumarMesesFinDeMes(s.pagadaHasta, n * intervalo);
    const hasta = mp.sumarMesesFinDeMes(s.pagadaHasta, (n + 1) * intervalo);
    const proximoVencimiento = mp.sumarMesesFinDeMes(s.pagoMaxPendiente, n * intervalo);
    if (!desde || !hasta || !proximoVencimiento) return { estado: 'BLOQUEADO', motivo: 'FECHA_INVALIDA' };
    return { estado: 'OK', motivo: null, desde, hasta, n, proximoVencimiento };
  }

  global.MotorPagoE1 = Object.assign(global.MotorPagoE1 || {}, { periodoSiguienteImportada });
})(typeof window !== 'undefined' ? window : globalThis);
