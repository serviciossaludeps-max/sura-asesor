/**
 * E1c · Validador de pagos (PagoValidador)
 * src/business-core/motors/pago/pago-validador.js
 *
 * Diseño v1.3 §3.2, §6.5 y §7.2. Pura: no escribe nada; devuelve el resultado para que el llamador decida.
 *  - Idempotencia: misma altaKey -> DUPLICADO.
 *  - Periodo: [ancla + n*intervalo, ancla + (n+1)*intervalo], n = pagos vigentes (no compensados).
 *  - Mismo periodo ya pagado -> PERIODO_YA_PAGADO.
 *  - montoRecibido distinto de valorTarifa no bloquea: se registra como diferenciaCobro.
 *  - Importadas: BLOQUEADO hasta que se implemente su periodo desde la cartera SURA.
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
    if (poliza.importada) return { estado: 'BLOQUEADO', motivo: 'IMPORTADA_PERIODO_PENDIENTE' };
    const pagos = Array.isArray(pagosExistentes) ? pagosExistentes : [];
    if (nuevoPago.altaKey && pagos.some(p => p.altaKey === nuevoPago.altaKey)) {
      return { estado: 'DUPLICADO', motivo: 'ALTA_KEY_REPETIDA', altaKey: nuevoPago.altaKey };
    }
    const vigentes = pagos.filter(p => !p.compensado);
    const intervalo = INTERVALO[poliza.periodicidad];
    if (!intervalo) return { estado: 'BLOQUEADO', motivo: 'PERIODICIDAD_INVALIDA' };
    const desde = mp.sumarMesesFinDeMes(ancla, vigentes.length * intervalo);
    const hasta = mp.sumarMesesFinDeMes(ancla, (vigentes.length + 1) * intervalo);
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
