/**
 * E1c · Resolver de tarifa del periodo (TarifaResolver)
 * src/business-core/motors/pago/tarifa-resolver.js
 *
 * Diseño v1.3 §3.2 y §4 (valorTarifa). Pura: sin DOM ni Firestore.
 *  - Ciclo 0 (meses 1-12): valor guardado al vender (F-3). Por asegurado: primaTotal (con IVA).
 *  - Ciclo >= 1: tarifa vigente del año de la renovación, por asegurado (tablas del año).
 *  - SPD: una tarifa para la póliza, con vigencia validada.
 *  - valorTarifa de la póliza = Σ valor por asegurado.
 * Si falta un dato o la tabla del año, bloquea con motivo. Nunca usa tablas de otro año.
 */
(function (global) {
  'use strict';

  const MODULO_FLAG = {
    'Básico': null, 'Atención Domiciliaria': 'emd', 'Alto Costo': 'altoCosto',
    'Cirugía Ambulatoria': 'cirugia', 'Maternidad': 'maternidad'
  };

  function iva() {
    return (global.BusinessConfig && global.BusinessConfig.constants && global.BusinessConfig.constants.IVA_FACTOR) || 1.05;
  }
  function bloqueado(motivo, extra) {
    return Object.assign({ estado: 'BLOQUEADO', motivo, valorTarifa: null, detalle: [] }, extra || {});
  }
  function anioDe(f) { return parseInt(String(f).slice(0, 4), 10); }

  function valorRenovacion(poliza, a, r, tables) {
    const mp = global.MotorProducto;
    if (poliza.producto === 'SPTI') {
      if (!poliza.plan) return { motivo: 'FALTA_PLAN' };
      const p = mp.calcularPrecioSPTI({ plan: poliza.plan, edad: r.edad, periodicidad: poliza.periodicidad }, tables);
      return p ? { valor: p.valor } : { motivo: 'TARIFA_NO_RESUELTA' };
    }
    if (poliza.producto === 'PSM') {
      const flags = { emd: false, altoCosto: false, cirugia: false, maternidad: false };
      for (const m of (a.modulos || ['Básico'])) {
        if (!Object.prototype.hasOwnProperty.call(MODULO_FLAG, m)) return { motivo: 'MODULO_DESCONOCIDO' };
        if (MODULO_FLAG[m]) flags[MODULO_FLAG[m]] = true;
      }
      const p = mp.calcularPrecioPSM(Object.assign({ edad: r.edad, periodicidad: poliza.periodicidad }, flags), tables);
      return p ? { valor: p.valor } : { motivo: 'TARIFA_NO_RESUELTA' };
    }
    // PAC60
    const p = mp.calcularPrecioPAC60({ edad: r.edad, conAnexo: !!a.conAnexo, periodicidad: poliza.periodicidad, contexto: 'ADMINISTRATIVO' }, tables);
    return p ? { valor: p.valor } : { motivo: 'TARIFA_NO_RESUELTA' };
  }

  function tarifaPeriodo(poliza, fecha) {
    const mp = global.MotorProducto;
    const resolver = global.MotorPagoE1 && global.MotorPagoE1.resolverEdadReferencia;
    if (!mp) return bloqueado('MOTOR_PRODUCTO_NO_DISPONIBLE');
    if (!resolver) return bloqueado('RESOLVER_NO_DISPONIBLE');
    if (!poliza || !poliza.producto || !poliza.periodicidad) return bloqueado('POLIZA_INCOMPLETA');
    const ancla = poliza.fechaExpOriginal || poliza.fechaExp;
    if (!ancla) return bloqueado('FALTA_ANCLA');
    const ciclo = mp.cicloDeFecha(ancla, fecha);
    if (ciclo === null || ciclo === undefined) return bloqueado('FECHA_INVALIDA');

    if (poliza.producto === 'SPD') {
      if (ciclo === 0) {
        const v = poliza.primaTotal || (poliza.primaTotalSinIVA > 0 ? Math.round(poliza.primaTotalSinIVA * iva()) : 0);
        if (!(v > 0)) return bloqueado('FALTA_VALOR_GUARDADO');
        return { estado: 'OK', valorTarifa: v, ciclo, detalle: [{ rol: 'POLIZA', valor: v, fuente: 'GUARDADO' }] };
      }
      const fechaRef = mp.aniversarioEn(ancla, ciclo);
      const tables = mp.tablasDelAnio(anioDe(fechaRef));
      if (!tables || !tables.SPD) return bloqueado('TABLA_ANIO_NO_DISPONIBLE');
      const spd = tables.SPD;
      if (fechaRef < spd.vigenciaDesde || fechaRef > spd.vigenciaHasta) return bloqueado('SPD_FUERA_DE_VIGENCIA', { fechaReferencia: fechaRef });
      const base = spd.sinIVA && spd.sinIVA[poliza.periodicidad];
      if (!base) return bloqueado('TARIFA_NO_RESUELTA');
      const v = Math.round(base * iva());
      return { estado: 'OK', valorTarifa: v, ciclo, detalle: [{ rol: 'POLIZA', valor: v, fuente: 'TABLA_ANIO' }] };
    }

    const aseg = Array.isArray(poliza.asegurados) ? poliza.asegurados : [];
    if (aseg.length === 0) return bloqueado('SIN_ASEGURADOS');
    const detalle = [];
    for (let i = 0; i < aseg.length; i++) {
      const a = aseg[i];
      const rol = a.rol || (i === 0 ? 'TITULAR' : 'ADICIONAL');
      const r = resolver(a, poliza, fecha);
      if (r.estado !== 'OK') return bloqueado(r.motivo, { rol });
      let valor, fuente;
      if (ciclo === 0) {
        const guardado = a.primaTotal || (a.primaTotalSinIVA > 0 ? Math.round(a.primaTotalSinIVA * iva()) : 0);
        if (!(guardado > 0)) return bloqueado('FALTA_VALOR_GUARDADO', { rol });
        valor = guardado; fuente = 'GUARDADO';
      } else {
        const tables = mp.tablasDelAnio(anioDe(r.fechaReferencia));
        if (!tables) return bloqueado('TABLA_ANIO_NO_DISPONIBLE', { rol });
        const v = valorRenovacion(poliza, a, r, tables);
        if (v.motivo) return bloqueado(v.motivo, { rol });
        valor = v.valor; fuente = 'TABLA_ANIO';
      }
      detalle.push({ rol, edadReferencia: r.edad, valor, fuente });
    }
    const total = detalle.reduce((acc, d) => acc + d.valor, 0);
    return { estado: 'OK', valorTarifa: total, ciclo, detalle };
  }

  global.MotorPagoE1 = Object.assign(global.MotorPagoE1 || {}, { tarifaPeriodo });
})(typeof window !== 'undefined' ? window : globalThis);
