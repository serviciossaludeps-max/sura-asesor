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
 * SPTI: base sin IVA de la tabla del año de la fecha de referencia (corrige E1c: antes usaba la 2026).
 * Reutiliza MotorPago (calcularPorcentajeComision), MotorProducto
 * (cicloDeFecha, aniversarioEn, tablasDelAnio, calcularPrecioPSM, calcularPrecioPAC60)
 * y MotorPagoE1.resolverEdadReferencia. No reimplementa BR-009 ni BR-016.
 */
(function (global) {
  'use strict';

  const REGLA_VERSION = 'E2.0';
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

  // Base sin IVA de SPTI desde las tablas del año indicado (no desde la tabla 2026 fija).
  function baseSPTI(tables, poliza, edad) {
    const campo = { MENSUAL: 'mensual', TRIMESTRAL: 'trimestre', SEMESTRAL: 'semestre', ANUAL: 'anual' }[poliza.periodicidad];
    const rango = global.MotorProducto.getRangoEdadSPTI(edad);
    const celda = tables && tables.SPTI_SIN_IVA && tables.SPTI_SIN_IVA[poliza.plan] && tables.SPTI_SIN_IVA[poliza.plan][rango];
    const b = celda && campo ? celda[campo] : undefined;
    return b > 0 ? b : null;
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

    const pct = mpago.calcularPorcentajeComision('SPD', null, fechaPago || new Date());   // tasa del año de pago
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
  // Opción A (decisión del PO): en SPTI, la base guardada del primer ciclo debe coincidir con la tabla SIN IVA
  // de la fecha de referencia (tolerancia 1 peso por redondeo). Enero 2026 admite también la tabla 2025 (oferta).
  // Si no coincide, la comisión queda BLOQUEADA: no se calcula con un valor que puede ser la prima con IVA.
  function validarBaseGuardadaSPTI(poliza, r, guardada, mp) {
    const campo = { MENSUAL: 'mensual', TRIMESTRAL: 'trimestre', SEMESTRAL: 'semestre', ANUAL: 'anual' }[poliza.periodicidad];
    const rango = mp.getRangoEdadSPTI(r.edad);
    const anios = [anioDe(r.fechaReferencia)];
    if (/^2026-01-/.test(String(r.fechaReferencia))) anios.push(2025);
    const esperados = [];
    anios.forEach(an => {
      const tb = mp.tablasDelAnio(an);
      const celda = tb && tb.SPTI_SIN_IVA && tb.SPTI_SIN_IVA[poliza.plan] && tb.SPTI_SIN_IVA[poliza.plan][rango];
      const v = celda && campo ? celda[campo] : undefined;
      if (v > 0) esperados.push(v);
    });
    if (!esperados.length) return { ok: false, motivo: 'TABLA_NO_DISPONIBLE', guardada, rango };
    if (esperados.some(v => Math.abs(guardada - v) <= 1)) return { ok: true };
    return { ok: false, motivo: 'NO_COINCIDE_TABLA_SIN_IVA', guardada, esperados, rango };
  }

  function comisionPoliza(poliza, fechaPago, opts) {
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

    const fechaRefPago = fechaPago || new Date();   // la tasa SPTI depende del año de pago
    // Opción 2 (aprobada): venta individual sin array de asegurados. El titular es el único asegurado y sus datos
    // viven a nivel de venta (doc, fechaNac, modulos, conAnexo, primaTotalSinIVA). Igual que el adaptador de la sombra E2.
    // Si la venta declara más de un asegurado y no hay array, no se puede inferir a los demás: bloqueo explícito.
    const tieneArray = Array.isArray(poliza.asegurados) && poliza.asegurados.length > 0;
    if (!tieneArray && Number(poliza.numAsegurados) > 1) return bloqueado('ASEGURADOS_NO_REGISTRADOS');
    const aseg = tieneArray ? poliza.asegurados : [{
      rol: 'TITULAR', doc: poliza.doc, fechaNac: poliza.fechaNac, modulos: poliza.modulos,
      conAnexo: poliza.conAnexo, primaTotalSinIVA: poliza.primaTotalSinIVA, primaTotal: poliza.primaTotal
    }];

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
          if (poliza.producto === 'SPTI') {
            if (!poliza.plan) return bloqueado('FALTA_PLAN', { rol });
            if (!poliza.periodicidad) return bloqueado('FALTA_PERIODICIDAD', { rol });
            const v = validarBaseGuardadaSPTI(poliza, r, guardada, mp);
            if (!v.ok) return bloqueado('BASE_GUARDADA_INCONSISTENTE', { rol, detalle: v });
          }
          base = guardada; fuenteBase = 'GUARDADO';
        } else if (poliza.producto === 'SPTI') {
          if (!poliza.plan) return bloqueado('FALTA_PLAN', { rol });
          if (!poliza.periodicidad) return bloqueado('FALTA_PERIODICIDAD', { rol });
          const tb0 = mp.tablasDelAnio(anioDe(r.fechaReferencia));
          if (!tb0) return bloqueado('TABLA_ANIO_NO_DISPONIBLE', { rol });
          base = baseSPTI(tb0, poliza, r.edad);
          if (!base) return bloqueado('BASE_NO_DISPONIBLE', { rol });
          fuenteBase = 'TABLA_ANIO';
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
          const b = baseSPTI(tables, poliza, r.edad);
          res = b ? { base: b, fuente: 'TABLA_ANIO' } : { motivo: 'BASE_NO_DISPONIBLE' };
        } else if (poliza.producto === 'PSM') {
          res = baseRenovacionPSM(a, r.edad, poliza.periodicidad, tables);
        } else {
          res = baseRenovacionPAC60(a, r.edad, poliza.periodicidad, tables);
        }
        if (res.motivo) return bloqueado(res.motivo, { rol });
        base = res.base; fuenteBase = res.fuente;
      }
      if (!base || base <= 0) return bloqueado('BASE_NO_DISPONIBLE', { rol });

      const pct = mpago.calcularPorcentajeComision(poliza.producto, r.edad, fechaRefPago);
      if (pct === null || pct === undefined) return bloqueado('PORCENTAJE_NO_DISPONIBLE', { rol });

      detalle.push({
        rol, aseguradoRef: (a.doc !== undefined && a.doc !== null && String(a.doc) !== '') ? String(a.doc) : null,
        edadReferencia: r.edad, fechaReferencia: r.fechaReferencia, ciclo: r.ciclo,
        base, fuenteBase, pct
      });
    }

    // ── Cobros (H-1 y H-2) ──────────────────────────────────────────────────────────────
    // H-1: un cobro parcial pertenece a UN asegurado identificado por su documento (aseguradoRef).
    //      No se reparte proporcionalmente entre asegurados. Sin identificador confiable: bloqueo explícito.
    // H-2: por asegurado y periodo, comisionAcumulada = round(min(baseAcumulada, baseEsperada) × pct);
    //      pago = comisionAcumulada − comisionYaPagada (cobros previos del mismo asegurado y periodo).
    // C-1: cada asegurado se redondea individualmente; el pago de la póliza es la suma de los individuales.
    const IVA = (global.BusinessConfig && global.BusinessConfig.constants && global.BusinessConfig.constants.IVA_FACTOR) || 1.05;
    const cobro = opts || {};
    const previos = Array.isArray(cobro.cobrosPrevios) ? cobro.cobrosPrevios : [];
    const vacio = (x) => x === undefined || x === null || x === '';

    let monto = null;
    if (!vacio(cobro.montoRecibido)) {
      monto = Number(cobro.montoRecibido);
      if (!isFinite(monto) || monto <= 0) return bloqueado('MONTO_RECIBIDO_INVALIDO');
    }
    const baseEsperadaTotal = detalle.reduce((acc, d) => acc + d.base, 0);
    const baseCobrada = monto !== null ? Math.round(monto / IVA) : null;
    const esParcial = baseCobrada !== null && baseCobrada < baseEsperadaTotal;

    if (esParcial || previos.length > 0) {
      const refs = detalle.map(d => d.aseguradoRef);
      if (refs.some(ref => ref === null)) return bloqueado('FALTA_ASEGURADO');
      if (new Set(refs).size !== refs.length) return bloqueado('IDENTIFICADOR_DUPLICADO');
      if (vacio(cobro.periodoDesde)) return bloqueado('FALTA_PERIODO_COBRO');
    }
    if (esParcial) {
      if (vacio(cobro.aseguradoRef)) return bloqueado('FALTA_ASEGURADO');
      if (!detalle.some(d => d.aseguradoRef === String(cobro.aseguradoRef))) return bloqueado('ASEGURADO_NO_ENCONTRADO');
    }
    for (const p of previos) {
      if (vacio(p.aseguradoRef) || vacio(p.periodoDesde)) return bloqueado('COBRO_PREVIO_INCOMPLETO');
    }

    // Idempotencia: un cobro que ya figura entre los previos (mismo id) no se cuenta dos veces.
    const idActual = vacio(cobro.id) ? null : String(cobro.id);
    const previosValidos = previos.filter(p => idActual === null || String(p.id) !== idActual);
    const periodo = vacio(cobro.periodoDesde) ? null : String(cobro.periodoDesde);

    const resultado = [];
    let totalPago = 0;
    for (const d of detalle) {
      const mis = previosValidos.filter(p => String(p.aseguradoRef) === String(d.aseguradoRef) && String(p.periodoDesde) === String(periodo));
      const baseCobradaPrev = mis.reduce((acc, p) => acc + (Number(p.baseCobrada) || 0), 0);
      const comisionYaPagada = mis.reduce((acc, p) => acc + (Number(p.comision) || 0), 0);

      let baseCobradaPago, baseAcumulada;
      if (esParcial) {
        // H-1: solo el asegurado asignado recibe base de este cobro; los demás no se alteran.
        baseCobradaPago = String(d.aseguradoRef) === String(cobro.aseguradoRef) ? baseCobrada : 0;
        baseAcumulada = baseCobradaPrev + baseCobradaPago;
      } else {
        // Cobro completo: el período del asegurado queda cubierto; se paga lo que falte.
        baseCobradaPago = Math.max(0, d.base - baseCobradaPrev);
        baseAcumulada = baseCobradaPrev + baseCobradaPago;
      }
      const tope = Math.min(baseAcumulada, d.base);                // H-2: nunca sobre la base esperada
      const comisionAcumulada = Math.round(tope * d.pct);          // C-1: redondeo individual
      const pagoNuevo = comisionAcumulada - comisionYaPagada;
      if (pagoNuevo < 0) return bloqueado('COMISION_ACUMULADA_INCONSISTENTE', { rol: d.rol });

      resultado.push({
        rol: d.rol, aseguradoRef: d.aseguradoRef,
        edadReferencia: d.edadReferencia, fechaReferencia: d.fechaReferencia, ciclo: d.ciclo,
        base: d.base, fuenteBase: d.fuenteBase, pct: d.pct,
        baseCobradaPrev, baseCobradaPago, baseAcumulada,
        excedenteBase: Math.max(0, baseAcumulada - d.base),
        comisionAcumulada, comisionYaPagada, comision: pagoNuevo
      });
      totalPago += pagoNuevo;
    }

    const cobroParcial = esParcial ? {
      id: idActual, aseguradoRef: String(cobro.aseguradoRef), periodoDesde: periodo,
      montoRecibido: monto, baseCobrada, baseEsperadaTotal
    } : null;
    return { estado: 'OK', comision: totalPago, comisionPorAsegurado: resultado, motivo: null, reglaVersion: REGLA_VERSION, cobroParcial };
  }

  global.MotorPagoE1 = Object.assign(global.MotorPagoE1 || {}, { comisionPoliza, REGLA_VERSION });
})(typeof window !== 'undefined' ? window : globalThis);
