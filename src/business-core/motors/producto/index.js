/**
 * MotorProducto — Business Core de Servicios Seguros
 * src/business-core/motors/producto/index.js
 *
 * Responsabilidad única (Documento de Arquitectura del Business Core v1.0,
 * Sección 3): determinar tarifa y prima aplicable a un producto/plan/
 * periodicidad. Responde "¿cuánto cuesta?" — nunca "¿cuánto se paga de
 * comisión?" (eso es MotorPago, sin dependencia entre ambos motores).
 *
 * BR que implementa: BR-013 (prima anual), BR-014 (tarifas/descuentos/IVA),
 * BR-015 — solo la parte de clasificación de rango (la elegibilidad de
 * venta nueva sigue siendo de MotorValidación).
 *
 * Depende únicamente de business-config (constants.js, pricing.js).
 * Sin DOM, sin Firestore, sin dependencia de MotorPago ni MotorValidación.
 *
 * Fuera de alcance deliberado (ver Inventario de MotorProducto):
 *   - SPD_TARIFAS: única copia existente (cotizar.html), sin duplicación
 *     real — no se centraliza aquí.
 *   - calcPrimaMensualSinIVA(): HALLAZGO-OP-003, tabla SPTI divergente
 *     usada en impacto de cancelación — permanece intacta hasta que el
 *     Product Owner confirme cuál valor es correcto.
 *
 * Carga requerida en el HTML consumidor, después de business-config:
 *   <script src="src/business-core/motors/producto/index.js"></script>
 */
(function (global) {
  'use strict';

  const PSM_RANGOS = [
    { key: '0-14', min: 0, max: 14 }, { key: '15-20', min: 15, max: 20 }, { key: '21-25', min: 21, max: 25 },
    { key: '26-30', min: 26, max: 30 }, { key: '31-40', min: 31, max: 40 }, { key: '41-45', min: 41, max: 45 },
    { key: '46-50', min: 46, max: 50 }, { key: '51-55', min: 51, max: 55 }, { key: '56-59', min: 56, max: 59 },
    { key: '60-65', min: 60, max: 65 }, { key: '66-70', min: 66, max: 70 }, { key: '71+', min: 71, max: 999 }
  ];
  const PERIODOS_MESES = { MENSUAL: 1, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12 };
  const CAMPO_POR_PERIODO = { MENSUAL: 'mensual', TRIMESTRAL: 'trimestre', SEMESTRAL: 'semestre', ANUAL: 'anual' };

  function _pricing() { return (global.BusinessConfig && global.BusinessConfig.pricing) || null; }
  function _constants() { return (global.BusinessConfig && global.BusinessConfig.constants) || null; }

  // ---------------------------------------------------------------------
  // Clasificación de rango (BR-014/BR-015 — solo clasificación, no elegibilidad)
  // ---------------------------------------------------------------------

  /** Réplica exacta de getRangoEdadSPTI() de crm.html (uso administrativo y de venta — sin divergencia de negocio en SPTI). */
  function getRangoEdadSPTI(edad) {
    const e = parseInt(edad, 10) || 0;
    if (e <= 40) return '0-40';
    if (e <= 50) return '41-50';
    if (e <= 59) return '51-59';
    return null;
  }

  function getRangoPSM(edad) {
    return PSM_RANGOS.find(r => edad >= r.min && edad <= r.max) || null;
  }

  /** Uso administrativo: 4 rangos (60-90+) — crm.html, cartera existente, renovaciones. */
  function getRangoPAC60Administrativo(edad) {
    if (edad >= 60 && edad <= 69) return '60-69';
    if (edad >= 70 && edad <= 79) return '70-79';
    if (edad >= 80 && edad <= 89) return '80-89';
    if (edad >= 90) return '90+';
    return null;
  }

  /** Venta nueva: 2 rangos (60-79) — BR-015. cotizar.html y cualquier flujo de venta nueva. */
  function getRangoPAC60VentaNueva(edad) {
    if (edad >= 60 && edad <= 69) return '60-69';
    if (edad >= 70 && edad <= 79) return '70-79';
    return null;
  }

  // ---------------------------------------------------------------------
  // Cálculo de precio por periodo (BR-014)
  // ---------------------------------------------------------------------

  /**
   * @param {{plan:string, edad:number|string, periodicidad:string, tarifaCongelada?:boolean}} p
   * @returns {{valor:number, dcto:number, mensual:number, rango:string}|null}
   */
  function calcularPrecioSPTI(p) {
    if (!p || p.tarifaCongelada) return null;
    const pricing = _pricing();
    const constants = _constants();
    if (!pricing || !pricing.SPTI_SIN_IVA || !pricing.computeSPTIConIVA || !constants || !constants.IVA_FACTOR) return null;
    const rango = getRangoEdadSPTI(p.edad);
    if (!rango || !pricing.SPTI_SIN_IVA[p.plan] || !pricing.SPTI_SIN_IVA[p.plan][rango]) return null;
    const tablaConIVA = pricing.computeSPTIConIVA(pricing.SPTI_SIN_IVA, constants.IVA_FACTOR);
    const tabla = tablaConIVA[p.plan][rango];
    const campo = CAMPO_POR_PERIODO[p.periodicidad] || 'mensual';
    const dctoCampo = { trimestre: 'dctoTrim', semestre: 'dctoSem', anual: 'dctoAnual' }[campo];
    if (tabla[campo] === undefined) return null;
    return { valor: tabla[campo], dcto: dctoCampo ? (tabla[dctoCampo] || 0) : 0, mensual: tabla.mensual, rango };
  }

  /**
   * @param {{edad:number, emd?:boolean, altoCosto?:boolean, cirugia?:boolean, maternidad?:boolean, periodicidad:string, asegurados?:Array<{rangoEdad:string}>}} p
   * @returns {{valor:number, dcto:number, mensual:number, rango:string}|null}
   */
  function calcularPrecioPSM(p) {
    if (!p) return null;
    const pricing = _pricing();
    if (!pricing || !pricing.PSM_TARIFAS || !pricing.PSM_IVA || !pricing.PSM_DCTOS) return null;
    const rango = getRangoPSM(p.edad);
    if (!rango) return null;
    const T = pricing.PSM_TARIFAS, IVA = pricing.PSM_IVA;

    let totalMensual = T.basico[rango.key] * IVA;
    if (p.emd) totalMensual += T.emd[rango.key] * IVA;
    if (p.altoCosto) totalMensual += T.altoCosto[rango.key] * IVA;
    if (p.cirugia) totalMensual += T.cirugia[rango.key] * IVA;
    // Maternidad: SIEMPRE se valida la edad aquí (15-45), sin importar el
    // flag recibido — replica calcDatosPSM()/calcularPersona(). El
    // consumidor de registro de pago NO debe pre-filtrar esto por su
    // cuenta; debe pasar el flag "crudo" y dejar que el motor decida.
    const maternidadElegible = p.edad >= 15 && p.edad <= 45;
    if (p.maternidad && maternidadElegible) totalMensual += T.maternidad[rango.key] * IVA;

    if (Array.isArray(p.asegurados)) {
      for (const a of p.asegurados) {
        if (!a.rangoEdad || T.basico[a.rangoEdad] === undefined) return null;
        totalMensual += T.basico[a.rangoEdad] * IVA;
      }
    }

    const mult = PERIODOS_MESES[p.periodicidad] || 1;
    const bruto = Math.round(totalMensual * mult);
    const dctoPct = pricing.PSM_DCTOS[p.periodicidad] || 0;
    const dcto = Math.round(bruto * dctoPct);
    return { valor: bruto - dcto, dcto, mensual: Math.round(totalMensual), rango: rango.key };
  }

  /**
   * @param {{edad:number, conAnexo?:boolean, periodicidad:string, contexto:'ADMINISTRATIVO'|'VENTA_NUEVA', asegurados?:Array<{rangoEdad:string}>, tarifaCongelada?:boolean}} p
   * @returns {{valor:number, dcto:number, mensual:number, rango:string}|null}
   */
  function calcularPrecioPAC60(p) {
    if (!p || p.tarifaCongelada) return null;
    if (p.contexto !== 'ADMINISTRATIVO' && p.contexto !== 'VENTA_NUEVA') return null; // sin inferencia silenciosa
    const pricing = _pricing();
    if (!pricing || !pricing.PAC60_TARIFAS || !pricing.PAC60_DCTOS) return null;

    const rango = p.contexto === 'ADMINISTRATIVO' ? getRangoPAC60Administrativo(p.edad) : getRangoPAC60VentaNueva(p.edad);
    if (!rango) return null;
    const campoAnexo = p.conAnexo ? 'conAnexo' : 'sinAnexo';
    const tarifaBase = pricing.PAC60_TARIFAS[rango];
    if (!tarifaBase || tarifaBase[campoAnexo] === undefined) return null;

    let totalMensual = tarifaBase[campoAnexo];
    if (Array.isArray(p.asegurados)) {
      for (const a of p.asegurados) {
        const t = a.rangoEdad && pricing.PAC60_TARIFAS[a.rangoEdad];
        if (!t || t[campoAnexo] === undefined) return null;
        totalMensual += t[campoAnexo];
      }
    }

    const mult = PERIODOS_MESES[p.periodicidad] || 1;
    const bruto = Math.round(totalMensual * mult);
    const dctoPct = pricing.PAC60_DCTOS[p.periodicidad] || 0;
    const dcto = Math.round(bruto * dctoPct);
    return { valor: bruto - dcto, dcto, mensual: totalMensual, rango };
  }

  // ---------------------------------------------------------------------
  // BR-013 — Prima anual
  // ---------------------------------------------------------------------

  /**
   * @param {object} venta - { producto, plan, periodicidad, edad, prima }
   * @param {boolean} [carteraConIVA] - explícito, sin depender de estado global
   * @returns {number}
   */
  function calcularPrimaAnual(venta, carteraConIVA) {
    const constants = _constants();
    const pricing = _pricing();
    const factor = carteraConIVA ? ((constants && constants.IVA_FACTOR) || 1) : 1;

    if (venta.producto === 'SPTI' && venta.plan && venta.periodicidad && pricing && pricing.SPTI_SIN_IVA) {
      const rangoEdad = getRangoEdadSPTI(parseInt(venta.edad, 10));
      const tablaBase = pricing.SPTI_SIN_IVA[venta.plan];
      if (tablaBase && rangoEdad && tablaBase[rangoEdad]) {
        return Math.round(tablaBase[rangoEdad].mensual * 12 * factor);
      }
    }
    return Math.round((venta.prima || 0) * 12 * factor);
  }

  global.MotorProducto = {
    getRangoEdadSPTI,
    getRangoPSM,
    getRangoPAC60Administrativo,
    getRangoPAC60VentaNueva,
    calcularPrecioSPTI,
    calcularPrecioPSM,
    calcularPrecioPAC60,
    calcularPrimaAnual
  };

})(typeof window !== 'undefined' ? window : globalThis);
