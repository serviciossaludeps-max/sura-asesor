/**
 * E1c/E1d · Validador de pagos (PagoValidador)
 * src/business-core/motors/pago/pago-validador.js
 *
 * Pura: no escribe nada; devuelve el resultado para que el llamador decida.
 *  - Idempotencia: misma altaKey -> DUPLICADO.
 *  - No importada: periodo [ancla + n*intervalo, ancla + (n+1)*intervalo], n = pagos vigentes.
 *  - Importada (E1d): periodo desde la cartera SURA (periodoSiguienteImportada).
 *  - Periodo ya pagado -> PERIODO_YA_PAGADO.
 *  - montoRecibido distinto de valorTarifa no bloquea: diferenciaCobro.
 */
(function (global) {
  'use strict';

  const INTERVALO = { MENSUAL: 1, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12 };

  function validarPago(poliza, pagosExistentes, nuevoPago) {
    const mp = global.MotorProducto;
    const tarifa = global.MotorPagoE1 && global.MotorPagoE1.tarifaPeriodo;
    if (!mp) return { estado: 'BLOQUEADO', motivo: 'MOTOR_PRODUCTO_NO_DISPONIBLE' };
    if (!tarifa) return { estado: 'BLOQUEADO', motivo: 'TARIFA_NO_DISPONIBLE' };
    if (!poliza || !nuevoPago) return { estado: 'RECHAZADO', motivo: 'POLIZA_O_PAGO_FALTANTE' };
    if (!(nuevoPago.montoRecibido > 0)) return { estado: 'RECHAZADO', motivo: 'MONTO_INVALIDO' };
    const ancla = poliza.fechaExpOriginal || poliza.fechaExp;
    if (!ancla) return { estado: 'BLOQUEADO', motivo: 'FALTA_ANCLA' };
    if (mp.cicloDeFecha(ancla, nuevoPago.fecha) === null) return { estado: 'RECHAZADO', motivo: 'FECHA_INVALIDA' };
    const pagos = Array.isArray(pagosExistentes) ? pagosExistentes : [];
    if (nuevoPago.altaKey && pagos.some(p => p.altaKey === nuevoPago.altaKey)) {
      return { estado: 'DUPLICADO', motivo: 'ALTA_KEY_REPETIDA', altaKey: nuevoPago.altaKey };
    }

    let desde, hasta;
    if (poliza.importada) {
      const per = global.MotorPagoE1.periodoSiguienteImportada
        ? global.MotorPagoE1.periodoSiguienteImportada(poliza, pagos)
        : { estado: 'BLOQUEADO', motivo: 'PERIODO_IMPORTADA_NO_DISPONIBLE' };
      if (per.estado !== 'OK') return { estado: 'BLOQUEADO', motivo: per.motivo };
      desde = per.desde; hasta = per.hasta;
    } else {
      const intervalo = INTERVALO[poliza.periodicidad];
      if (!intervalo) return { estado: 'BLOQUEADO', motivo: 'PERIODICIDAD_INVALIDA' };
      const vigentes = pagos.filter(p => !p.compensado).length;
      desde = mp.sumarMesesFinDeMes(ancla, vigentes * intervalo);
      hasta = mp.sumarMesesFinDeMes(ancla, (vigentes + 1) * intervalo);
    }

    if (pagos.some(p => p.periodoDesde === desde && !p.compensado)) {
      return { estado: 'PERIODO_YA_PAGADO', motivo: 'PERIODO_YA_PAGADO', periodo: { desde, hasta } };
    }
    const t = tarifa(poliza, desde);
    if (t.estado !== 'OK') return { estado: 'BLOQUEADO', motivo: t.motivo, periodo: { desde, hasta } };
    return {
      estado: 'OK', motivo: null,
      periodo: { desde, hasta, ciclo: t.ciclo },
      valorTarifa: t.valorTarifa,
      montoRecibido: nuevoPago.montoRecibido,
      diferenciaCobro: nuevoPago.montoRecibido - t.valorTarifa,
      altaKey: nuevoPago.altaKey || null
    };
  }

  global.MotorPagoE1 = Object.assign(global.MotorPagoE1 || {}, { validarPago });
})(typeof window !== 'undefined' ? window : globalThis);
