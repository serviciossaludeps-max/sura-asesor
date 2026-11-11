/**
 * E1b · Comisión por asegurado (I-2 + C-1 + C-3 + SPD)
 * src/business-core/motors/pago/comision-asegurados.js
 *
 * Decisiones que aplica:
 *   - I-2 / C-1: comision_i = Math.round(base_i * pct_i); comision_poliza = Σ comision_i.
 *   - C-3 (PSM): la prima de cada asegurado es individual, según los módulos que compró.
 *   - SPD: una sola tarifa para la póliza (no aplica la regla de asegurados).
 *   - Si un asegurado está bloqueado, toda la póliza queda BLOQUEADA (sin valor parcial).
 *
 * PAC60 con varios asegurados: cada uno con su anexo y su base (igual que PSM).
 * Reutiliza MotorPago (calcularPorcentajeComision, calcularBaseComision), MotorProducto
 * (cicloDeFecha, aniversarioEn, tablasDelAnio, calcularPrecioPSM, calcularPrecioPAC60)
 * y MotorPagoE1.resolverEdadReferencia. No reimplementa BR-009 ni BR-016.
 */
(function (global) {
  'use strict';

  const REGLA_VERSION = 'E1c.0';
  const PRODUCTOS_E1B = ['SPTI', 'PSM', 'PAC60', 'SPD'];
  // Etiquetas de módulo guardadas por el CRM -> flag de calcularPrecioPSM
  const MODULO_FLAG = {
    'Básico': null,
    'Atención Domiciliaria': 'emd',
    'Alto Costo': 'altoCosto',
    'Cirugía Ambulatoria': 'cirugia',
    'Maternidad': 'maternidad'
  };

  function bloqueado(motivo, extra) {
    return Object.assign({
      estado: 'BLOQUEADO', motivo, comision: null, comisionPorAsegurado: [], reglaVersion: REGLA_VERSION
    }, extra || {});
  }

  function anclaDe(poliza) {
    return poliza.fechaExpOriginal || poliza.fechaExp || null;
  }

  function anioDe(fecha) {
    return parseInt(String(fecha).slice(0, 4), 10);
  }

  // ---------- SPD: una tarifa para la póliza ----------
  function comisionSPD(poliza, fechaPago) {
    const mp = global.MotorProducto, mpago = global.MotorPago;
    const ancla = anclaDe(poliza);
    if (!ancla) return bloqueado('FALTA_ANCLA');
    const ciclo = mp.cicloDeFecha(ancla, fechaPago);
    if (ciclo === null || ciclo === undefined) return bloqueado('FECHA_INVALIDA');
    if (!poliza.periodicidad) return bloqueado('FALTA_PERIODICIDAD');

    let base, fuenteBase, fechaReferencia = ancla;
    if (ciclo === 0) {
      base = poliza.primaTotalSinIVA;
      fuenteBase = 'GUARDADO';
      if (!(base > 0)) return bloqueado('FALTA_BASE_GUARDADA');
    } else {
      fechaReferencia = mp.aniversarioEn(ancla, ciclo);
      const tables = mp.tablasDelAnio(anioDe(fechaReferencia));
      if (!tables) return bloqueado('TABLA_ANIO_NO_DISPONIBLE');
      const spd = tables.SPD;
      if (!spd) return bloqueado('TABLA_ANIO_NO_DISPONIBLE');
      if (fechaReferencia < spd.vigenciaDesde || fechaReferencia > spd.vigenciaHasta) {
        return bloqueado('SPD_FUERA_DE_VIGENCIA', { fechaReferencia });
      }
      base = spd.sinIVA && spd.sinIVA[poliza.periodicidad];
      fuenteBase = 'TABLA_ANIO';
      if (!base) return bloqueado('TARIFA_NO_RESUELTA');
    }

    const pct = mpago.calcularPorcentajeComision('SPD');
    if (pct === null || pct === undefined) return bloqueado('PORCENTAJE_NO_DISPONIBLE');
    const detalle = [{
      rol: 'POLIZA', edadReferencia: null, fechaReferencia, ciclo, base, fuenteBase, pct,
      comision: Math.round(base * pct)
    }];
    return { estado: 'OK', comision: detalle[0].comision, comisionPorAsegurado: detalle, motivo: null, reglaVersion: REGLA_VERSION };
  }

  // ---------- Base de un asegurado en ciclo >= 1 (PSM / PAC60) ----------
  function baseRenovacionPSM(a, edad, periodicidad, tables) {
    const flags = { emd: false, altoCosto: false, cirugia: false, maternidad: false };
    for (const m of (a.modulos || ['Básico'])) {
      if (!Object.prototype.hasOwnProperty.call(MODULO_FLAG, m)) return { motivo: 'MODULO_DESCONOCIDO' };
      if (MODULO_FLAG[m]) flags[MODULO_FLAG[m]] = true;
    }
    const p = global.MotorProducto.calcularPrecioPSM(Object.assign({ edad, periodicidad }, flags), tables);
    if (!p) return { motivo: 'TARIFA_NO_RESUELTA' };
    return { base: Math.round(p.valor / tables.PSM_IVA), fuente: 'TABLA_ANIO' };
  }

  function baseRenovacionPAC60(a, edad, periodicidad, tables) {
    const p = global.MotorProducto.calcularPrecioPAC60(
      { edad, conAnexo: !!a.conAnexo, periodicidad, contexto: 'ADMINISTRATIVO' }, tables);
    if (!p) return { motivo: 'TARIFA_NO_RESUELTA' };
    const iva = (global.BusinessConfig && global.BusinessConfig.constants && global.BusinessConfig.constants.IVA_FACTOR) || 1.05;
    return { base: Math.round(p.valor / iva), fuente: 'TABLA_ANIO' };
  }

  // ---------- Póliza con asegurados (SPTI, PSM, PAC60) ----------
  function comisionPoliza(poliza, fechaPago) {
    const mpago = global.MotorPago;
    const mp = global.MotorProducto;
    const resolver = global.MotorPagoE1 && global.MotorPagoE1.resolverEdadReferencia;
    if (!poliza || !poliza.producto) return bloqueado('POLIZA_INCOMPLETA');
    if (!mpago) return bloqueado('MOTOR_PAGO_NO_DISPONIBLE');
    if (!mp) return bloqueado('MOTOR_PRODUCTO_NO_DISPONIBLE');
    if (!resolver) return bloqueado('RESOLVER_NO_DISPONIBLE');
    if (PRODUCTOS_E1B.indexOf(poliza.producto) < 0) {
      return bloqueado('PRODUCTO_NO_SOPORTADO', { producto: poliza.producto });
    }
    if (poliza.producto === 'SPD') return comisionSPD(poliza, fechaPago);

    const aseg = Array.isArray(poliza.asegurados) ? poliza.asegurados : [];
    if (aseg.length === 0) return bloqueado('SIN_ASEGURADOS');

    const detalle = [];
    for (let i = 0; i < aseg.length; i++) {
      const a = aseg[i];
      const rol = a.rol || (i === 0 ? 'TITULAR' : 'ADICIONAL');
      const r = resolver(a, poliza, fechaPago);
      if (r.estado !== 'OK') return bloqueado(r.motivo, { rol });

      let base, fuenteBase;
      if (r.ciclo === 0) {
        // Primer ciclo: prima guardada al vender (F-3). Póliza de un asegurado puede usar la del grupo.
        const guardada = a.primaTotalSinIVA || (aseg.length === 1 ? poliza.primaTotalSinIVA : 0) || 0;
        if (guardada > 0) {
          base = guardada; fuenteBase = 'GUARDADO';
        } else if (poliza.producto === 'SPTI') {
          if (!poliza.plan) return bloqueado('FALTA_PLAN', { rol });
          if (!poliza.periodicidad) return bloqueado('FALTA_PERIODICIDAD', { rol });
          base = mpago.calcularBaseComision({ producto: 'SPTI', plan: poliza.plan, periodicidad: poliza.periodicidad, edad: r.edad });
          fuenteBase = 'TABLA';
        } else {
          return bloqueado('FALTA_BASE_GUARDADA', { rol });
        }
      } else {
        // Ciclo >= 1: tarifa vigente del año de la renovación, por asegurado.
        if (!poliza.periodicidad) return bloqueado('FALTA_PERIODICIDAD', { rol });
        const tables = mp.tablasDelAnio(anioDe(r.fechaReferencia));
        if (!tables) return bloqueado('TABLA_ANIO_NO_DISPONIBLE', { rol });
        let res;
        if (poliza.producto === 'SPTI') {
          if (!poliza.plan) return bloqueado('FALTA_PLAN', { rol });
          base = mpago.calcularBaseComision({ producto: 'SPTI', plan: poliza.plan, periodicidad: poliza.periodicidad, edad: r.edad });
          res = base > 0 ? { base, fuente: 'TABLA_ANIO' } : { motivo: 'BASE_NO_DISPONIBLE' };
        } else if (poliza.producto === 'PSM') {
          res = baseRenovacionPSM(a, r.edad, poliza.periodicidad, tables);
        } else {
          res = baseRenovacionPAC60(a, r.edad, poliza.periodicidad, tables);
        }
        if (res.motivo) return bloqueado(res.motivo, { rol });
        base = res.base; fuenteBase = res.fuente;
      }
      if (!base || base <= 0) return bloqueado('BASE_NO_DISPONIBLE', { rol });

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
