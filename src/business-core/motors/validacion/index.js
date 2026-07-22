/**
 * MotorValidación — Business Core de Servicios Seguros
 * src/business-core/motors/validacion/index.js
 *
 * Responsabilidad única (Documento de Arquitectura del Business Core v1.0,
 * Sección 3): reglas de integridad transversales que hoy viven dispersas.
 * v1.0 implementa únicamente BR-015 — no valida nada más (ver README.md,
 * "Fuera de alcance").
 *
 * BR-015 (Confirmada por el CEO, 13-jul-2026): PAC60 solo es
 * comercialmente vendible como venta nueva entre 60 y 79 años inclusive.
 * 80+ es válido únicamente para uso administrativo — renovaciones,
 * cartera existente, consulta de pólizas ya vendidas.
 *
 * Depende únicamente de sus propios parámetros de entrada — sin DOM,
 * sin Firestore, sin business-config (BR-015 es una regla de
 * elegibilidad, no de tarifa; la tarifa en sí es responsabilidad de
 * MotorProducto).
 *
 * Carga requerida en el HTML consumidor:
 *   <script src="src/business-core/motors/validacion/index.js"></script>
 */
(function (global) {
  'use strict';

  const PAC60_EDAD_MIN_VENTA_NUEVA = 60;
  const PAC60_EDAD_MAX_VENTA_NUEVA = 79;

  /**
   * BR-015: ¿es esta edad elegible para una venta NUEVA de PAC60?
   * Replica exactamente la semántica de comparación del código legado
   * (!(edad<60 || edad>79)), incluida su tolerancia a edad no numérica
   * (NaN no dispara advertencia — mismo comportamiento que los 3
   * consumidores que hoy no la tratan como caso especial).
   *
   * No aplica a uso administrativo (renovaciones, cartera existente) —
   * para eso, ver validarEdadPAC60() con el parámetro tipoMov.
   *
   * @param {number|string} edad
   * @returns {boolean}
   */
  function esElegiblePAC60VentaNueva(edad) {
    const e = parseInt(edad, 10);
    return !(e < PAC60_EDAD_MIN_VENTA_NUEVA || e > PAC60_EDAD_MAX_VENTA_NUEVA);
  }

  /**
   * BR-015 completa, con distinción administrativa: valida la edad de
   * un asegurado PAC60 considerando si la venta es nueva o una
   * renovación/uso administrativo.
   *
   * - edad < 60: inválido siempre, sin importar tipoMov (nadie puede
   *   tener una póliza PAC60 por debajo de la edad mínima del producto).
   * - edad > 79: inválido SOLO si tipoMov es 'NUEVO' o no se especifica
   *   (los 3 consumidores que no distinguen tipoMov — estimador,
   *   comparador, cotizador público — siempre representan una venta
   *   nueva potencial, nunca gestión de cartera existente).
   * - tipoMov 'RENOVACION' (o cualquier valor distinto de 'NUEVO'):
   *   edad > 79 es válida — comportamiento administrativo preservado.
   *
   * @param {number|string} edad
   * @param {string} [tipoMov] - 'NUEVO' | 'RENOVACION' | otro. Si se omite, se asume venta nueva.
   * @returns {{valido: boolean|null, motivo: 'MIN'|'MAX_NUEVA'|null}}
   *          valido=null cuando no hay edad utilizable (dato insuficiente
   *          — el llamador decide qué hacer, este motor no inventa).
   */
  function validarEdadPAC60(edad, tipoMov) {
    const e = parseInt(edad, 10);
    if (!e || e <= 0) return { valido: null, motivo: null };

    if (e < PAC60_EDAD_MIN_VENTA_NUEVA) {
      return { valido: false, motivo: 'MIN' };
    }
    if (e > PAC60_EDAD_MAX_VENTA_NUEVA && (tipoMov === undefined || tipoMov === 'NUEVO')) {
      return { valido: false, motivo: 'MAX_NUEVA' };
    }
    return { valido: true, motivo: null };
  }

  global.MotorValidacion = {
    PAC60_EDAD_MIN_VENTA_NUEVA,
    PAC60_EDAD_MAX_VENTA_NUEVA,
    esElegiblePAC60VentaNueva,
    validarEdadPAC60
  };

})(typeof window !== 'undefined' ? window : globalThis);
