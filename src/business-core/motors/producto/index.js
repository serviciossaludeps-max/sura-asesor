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
 * OT-2026-TARIFAS-ANIVERSARIO · Fase 3a (funciones puras, aún sin conectar al CRM):
 *   sumarMesesFinDeMes, aniversarioEn, cicloDeFecha, edadEnFecha, tablasDelAnio, y un
 *   parámetro opcional `tablas` en calcularPrecioSPTI/PSM/PAC60. Sin ese parámetro el
 *   comportamiento es idéntico al anterior. Ninguna función existente del CRM las usa todavía.
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

  // Tablas a usar en un cálculo. Sin `tablas` se usan las vigentes (comportamiento de siempre). Con `tablas`
  // se usan solo esas (sin completar con las vigentes: si falta una tabla, el cálculo devuelve null).
  // computeSPTIConIVA es una función, no un dato por año, así que se toma siempre de las tablas vigentes.
  function _tablasDe(tablas) {
    const base = _pricing();
    if (!tablas || typeof tablas !== 'object') return base;
    return Object.assign({}, tablas, { computeSPTIConIVA: base && base.computeSPTIConIVA });
  }

  // ---------------------------------------------------------------------
  // Fechas de aniversario y edad en una fecha (OT-2026-TARIFAS-ANIVERSARIO · Fase 3a)
  // Todas puras: reciben 'YYYY-MM-DD' (o Date) y devuelven 'YYYY-MM-DD', número o null. No usan la fecha de hoy.
  // ---------------------------------------------------------------------

  function _aFecha(f) {
    if (Object.prototype.toString.call(f) === '[object Date]') return isNaN(f) ? null : new Date(f.getFullYear(), f.getMonth(), f.getDate(), 12);
    if (typeof f !== 'string') return null;
    const m = f.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const y = +m[1], mo = +m[2] - 1, d = +m[3];
    const dt = new Date(y, mo, d, 12);
    return (dt.getFullYear() === y && dt.getMonth() === mo && dt.getDate() === d) ? dt : null; // rechaza 2026-02-30
  }
  function _iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /** Suma n meses; si el día no existe en el mes de destino usa el último día de ese mes (D-13). null si la fecha es inválida. */
  function sumarMesesFinDeMes(fecha, n) {
    const d = _aFecha(fecha);
    if (!d || !Number.isInteger(n)) return null;
    const t = d.getMonth() + n;
    const y = d.getFullYear() + Math.floor(t / 12);
    const m = ((t % 12) + 12) % 12;
    const ultimo = new Date(y, m + 1, 0).getDate();
    return _iso(new Date(y, m, Math.min(d.getDate(), ultimo), 12));
  }

  /** Aniversario número k (k >= 0) de una fecha ancla. Siempre se calcula desde la ancla, no encadenado. */
  function aniversarioEn(ancla, k) {
    if (!Number.isInteger(k) || k < 0) return null;
    return sumarMesesFinDeMes(ancla, 12 * k);
  }

  /** Cantidad de aniversarios (k >= 1) ya cumplidos hasta `fecha`, inclusive. 0 si la fecha es anterior al primero. null si algo es inválido. */
  function cicloDeFecha(ancla, fecha) {
    const a = _aFecha(ancla), f = _aFecha(fecha);
    if (!a || !f) return null;
    const fi = _iso(f);
    let k = 0;
    while (k < 400 && aniversarioEn(ancla, k + 1) <= fi) k++;
    return k;
  }

  /** Edad cumplida en `fecha`. Misma fórmula de edadVigente() del CRM, pero con la fecha como parámetro. null si falta o es inválida alguna fecha, o si nació después. */
  function edadEnFecha(fechaNac, fecha) {
    const n = _aFecha(fechaNac), f = _aFecha(fecha);
    if (!n || !f || n > f) return null;
    let e = f.getFullYear() - n.getFullYear();
    const m = f.getMonth() - n.getMonth();
    if (m < 0 || (m === 0 && f.getDate() < n.getDate())) e--;
    return e;
  }

  /**
   * Tablas autorizadas de un año, o null si no existen. NO hay valor por defecto: un año sin tablas es null.
   * Lee BusinessConfig.pricing.TARIFAS_POR_ANIO[anio] (el registro llega en la Fase 3b; hoy no existe y devuelve null).
   */
  function tablasDelAnio(anio) {
    const pricing = _pricing();
    const reg = pricing && pricing.TARIFAS_POR_ANIO;
    const t = reg && reg[anio];
    return (t && typeof t === 'object') ? t : null;
  }

  // ---------------------------------------------------------------------
  // Clasificación de rango (BR-014/BR-015 — solo clasificación, no elegibilidad)
  // ---------------------------------------------------------------------

  /** Réplica exacta de getRangoEdadSPTI() de crm.html. Incluye continuidad por edad
   *  (60-70, 71+) para pólizas existentes que superan el límite de venta nueva (59) —
   *  71+ es el techo definitivo: cualquier edad >=71 usa esa tarifa indefinidamente. */
  function getRangoEdadSPTI(edad) {
    const e = parseInt(edad, 10) || 0;
    if (e <= 40) return '0-40';
    if (e <= 50) return '41-50';
    if (e <= 59) return '51-59';
    if (e <= 70) return '60-70';
    return '71+';
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
  function calcularPrecioSPTI(p, tablas) {
    if (!p || p.tarifaCongelada) return null;
    const pricing = _tablasDe(tablas);
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
  function calcularPrecioPSM(p, tablas) {
    if (!p) return null;
    const pricing = _tablasDe(tablas);
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
  function calcularPrecioPAC60(p, tablas) {
    if (!p || p.tarifaCongelada) return null;
    if (p.contexto !== 'ADMINISTRATIVO' && p.contexto !== 'VENTA_NUEVA') return null; // sin inferencia silenciosa
    const pricing = _tablasDe(tablas);
    if (!pricing || !pricing.PAC60_TARIFAS || !pricing.PAC60_DCTOS) return null;

    const rango = p.contexto === 'ADMINISTRATIVO' ? getRangoPAC60Administrativo(p.edad) : getRangoPAC60VentaNueva(p.edad);
    if (!rango) return null;
    const campoAnexo = p.conAnexo ? 'conAnexo' : 'sinAnexo';
    const tarifaBase = pricing.PAC60_TARIFAS[rango];
    if (!tarifaBase || tarifaBase[campoAnexo] === undefined) return null;

    let totalMensual = tarifaBase[campoAnexo];
    if (Array.isArray(p.asegurados)) {
      for (const a of p.asegurados) {
        // HALLAZGO PAC60-ANEXO-PERIODICO (fix): cada asegurado adicional debe
        // usar SU PROPIO conAnexo, no el del titular. Antes esta línea
        // reutilizaba `campoAnexo` (calculado arriba, solo de `p.conAnexo`)
        // para todos los asegurados del arreglo.
        const campoAnexoAi = a.conAnexo ? 'conAnexo' : 'sinAnexo';
        const t = a.rangoEdad && pricing.PAC60_TARIFAS[a.rangoEdad];
        if (!t || t[campoAnexoAi] === undefined) return null;
        totalMensual += t[campoAnexoAi];
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
    calcularPrimaAnual,
    // Fase 3a (OT-2026-TARIFAS-ANIVERSARIO)
    sumarMesesFinDeMes,
    aniversarioEn,
    cicloDeFecha,
    edadEnFecha,
    tablasDelAnio
  };

})(typeof window !== 'undefined' ? window : globalThis);
