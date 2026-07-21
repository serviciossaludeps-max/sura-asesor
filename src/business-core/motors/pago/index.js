/**
 * MotorPago — Business Core de Servicios Seguros
 * src/business-core/motors/pago/index.js
 *
 * Responsabilidad única (Documento de Arquitectura del Business Core v1.0,
 * Sección 3): registrar, revertir y calcular la comisión de un pago.
 *
 * BR que implementa: BR-002 (vencimiento), BR-007 (registrar pago),
 * BR-008 (reversión — sin cambios de cálculo, ver README), BR-009
 * (COM_PCT), BR-016 (comisión PSM 12%/6% por edad, completa en los 7
 * puntos de uso — HALLAZGO-OP-002 cerrado).
 *
 * Depende únicamente de business-config (constants.js, commissions.js,
 * pricing.js) — sin DOM, sin Firestore, sin estado propio. Ver README.md
 * para entradas/salidas/dependencias completas.
 *
 * Carga requerida en el HTML consumidor, después de business-config:
 *   <script src="src/business-core/motors/pago/index.js"></script>
 */
(function (global) {
  'use strict';

  function _pricing() {
    return (global.BusinessConfig && global.BusinessConfig.pricing) || null;
  }
  function _commissions() {
    return (global.BusinessConfig && global.BusinessConfig.commissions) || null;
  }
  function _constants() {
    return (global.BusinessConfig && global.BusinessConfig.constants) || null;
  }

  // Copia interna, self-contained (ADR-009: un motor debe poder probarse
  // sin depender de funciones globales de crm.html). Debe mantenerse
  // idéntica a getRangoEdadSPTI() en crm.html — si diverge, es un defecto.
  function _rangoEdadSPTI(edad) {
    const e = parseInt(edad) || 0;
    if (e <= 40) return '0-40';
    if (e <= 50) return '41-50';
    if (e <= 59) return '51-59';
    return null;
  }

  /**
   * BR-009 + BR-016: porcentaje de comisión aplicable.
   *
   * BR-016 (Confirmada por el Product Owner, 14-jul-2026): PSM paga 12%
   * hasta 50 años y 6% desde 51 años — sin excepción y sin fallback a un
   * valor plano. Este es el ÚNICO lugar del Business Core donde vive esta
   * regla; HALLAZGO-OP-002 documentaba 5 de 7 puntos del código legado
   * que no la aplicaban — quedan cerrados al centralizar aquí.
   *
   * @param {string} producto - 'SPTI' | 'SPD' | 'PSM' | 'PAC60'
   * @param {number|string} [edad] - requerida solo para PSM
   * @returns {number} porcentaje (ej. 0.07), o null si no se puede calcular
   */
  function calcularPorcentajeComision(producto, edad) {
    const commissions = _commissions();
    if (!commissions || !commissions.COM_PCT) return null;

    if (producto === 'PSM') {
      const e = parseInt(edad);
      if (!e || e <= 0) return null; // sin edad no se puede aplicar BR-016 — no adivinar
      return e <= 50 ? 0.12 : 0.06;
    }
    return commissions.COM_PCT[producto] ?? null;
  }

  /**
   * BR-013/BR-014 (vía business-config): base de cálculo de comisión
   * ("prima sin IVA" volumétrica) para un producto/plan/periodicidad.
   * Réplica exacta de _baseComVol()+getSinIVABase() de crm.html — mismo
   * comportamiento, ahora con una sola fuente.
   *
   * @param {object} venta
   * @returns {number}
   */
  function calcularBaseComision(venta) {
    if (!venta) return 0;
    const pricing = _pricing();
    const constants = _constants();

    if (venta.producto === 'PSM' || venta.producto === 'PAC60') {
      return venta.primaTotalSinIVA || venta.primaSinIVA || Math.round((venta.prima || 0) / 1.05);
    }

    // SPTI con tabla disponible: usa el valor exacto por periodicidad
    if (venta.producto === 'SPTI' && venta.plan && venta.periodicidad && pricing && pricing.SPTI_SIN_IVA) {
      const rango = _rangoEdadSPTI(venta.edad);
      const tabla = rango && pricing.SPTI_SIN_IVA[venta.plan] && pricing.SPTI_SIN_IVA[venta.plan][rango];
      if (tabla) {
        const campo = { TRIMESTRAL: 'trimestre', SEMESTRAL: 'semestre', ANUAL: 'anual' }[venta.periodicidad] || 'mensual';
        if (tabla[campo] !== undefined) return tabla[campo];
      }
    }

    // Fallback genérico (SPD, u otros sin tabla disponible)
    const stored = venta.primaTotalSinIVA || 0;
    if (stored > 1000) return stored;
    const factor = (constants && constants.IVA_FACTOR) || (167076 / 159120);
    return Math.round((venta.primaTotal || venta.prima || 0) / factor);
  }

  /**
   * BR-007/009/016: comisión final de un pago para una venta dada.
   * Punto único de cálculo — todo consumidor (registrarPago, sincronización
   * SURA, importación masiva, cotizador, estimador) debe llamar aquí en
   * vez de calcular por su cuenta.
   *
   * @param {object} venta
   * @returns {number|null} monto redondeado, o null si no se puede calcular
   *          (dato insuficiente — el llamador decide cómo manejarlo, este
   *          motor nunca inventa un valor)
   */
  function calcularComision(venta) {
    if (!venta || !venta.producto) return null;
    const pct = calcularPorcentajeComision(venta.producto, venta.edad);
    if (pct === null) return null;
    const base = calcularBaseComision(venta);
    return Math.round(base * pct);
  }

  global.MotorPago = {
    calcularPorcentajeComision,
    calcularBaseComision,
    calcularComision
  };

})(typeof window !== 'undefined' ? window : globalThis);
