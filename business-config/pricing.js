/**
 * Business Configuration Module — Tarifas por producto
 * EPIC-002 · Sprint 0.3 (BR-014)
 *
 * SPTI_SIN_IVA: fuente única (crm.html L16687-16697, verificada idéntica
 * en su forma "sin IVA" contra el resto del sistema).
 *
 * computeSPTIConIVA(): deriva la tabla "con IVA" (antes duplicada como
 * literal independiente en crm.html L13549 -"SPTI_TARIFAS"- y en
 * cotizar.html) a partir de SPTI_SIN_IVA × IVA_FACTOR. Fórmula verificada
 * campo por campo contra los 3 literales originales: mensual/trimestre/
 * semestre/anual se redondean tras multiplicar por IVA_FACTOR; los
 * descuentos (dctoTrim/dctoSem/dctoAnual) son montos fijos en pesos y
 * NO se escalan por IVA — así estaban en las 3 copias originales.
 *
 * PSM_TARIFAS / PSM_IVA: fuente única (crm.html L14102-14109), verificada
 * idéntica en cotizar.html.
 *
 * PAC60_TARIFAS: fuente única (crm.html L14252-14258), 4 rangos de edad.
 * BR-015: solo 60-69 y 70-79 son comercialmente vendibles como venta
 * nueva — 80-89 y 90+ existen aquí con fines administrativos/informativos
 * (cartera existente, referencia en Portal). Cada consumidor decide qué
 * rangos usa; este módulo expone la tabla completa como fuente única.
 */
window.BusinessConfig = window.BusinessConfig || {};

window.BusinessConfig.pricing = {
  SPTI_SIN_IVA: {
    PREFERENCIAL: {
      '0-40':  { mensual:159120, trimestre:465441, dctoTrim:11919, semestre:908871,  dctoSem:45849,  anual:1737305, dctoAnual:172135 },
      '41-50': { mensual:171167, trimestre:500681, dctoTrim:12820, semestre:977684,  dctoSem:49318,  anual:1868842, dctoAnual:185162 },
      '51-59': { mensual:212095, trimestre:620398, dctoTrim:15887, semestre:1211456, dctoSem:61114,  anual:2315696, dctoAnual:229444 }
    },
    CLASICO: {
      '0-40':  { mensual:140457, trimestre:410852, dctoTrim:10519, semestre:802274,  dctoSem:40468,  anual:1533544, dctoAnual:151940 },
      '41-50': { mensual:153628, trimestre:449379, dctoTrim:11505, semestre:877506,  dctoSem:44262,  anual:1677351, dctoAnual:166185 },
      '51-59': { mensual:192544, trimestre:553310, dctoTrim:24322, semestre:1099785, dctoSem:55479,  anual:2102237, dctoAnual:208291 }
    }
  },

  computeSPTIConIVA(sinIva, ivaFactor) {
    const out = {};
    for (const plan in sinIva) {
      out[plan] = {};
      for (const rango in sinIva[plan]) {
        const t = sinIva[plan][rango];
        out[plan][rango] = {
          mensual: Math.round(t.mensual * ivaFactor),
          trimestre: Math.round(t.trimestre * ivaFactor),
          dctoTrim: t.dctoTrim,
          semestre: Math.round(t.semestre * ivaFactor),
          dctoSem: t.dctoSem,
          anual: Math.round(t.anual * ivaFactor),
          dctoAnual: t.dctoAnual
        };
      }
    }
    return out;
  },

  PSM_TARIFAS: {
    basico:      { '0-14':229847,'15-20':229847,'21-25':229847,'26-30':246326,'31-40':256144,'41-45':301955,'46-50':317840,'51-55':404786,'56-59':404786,'60-65':525726,'66-70':672240,'71+':1038175 },
    emd:         { '0-14':21771,'15-20':21771,'21-25':21771,'26-30':21771,'31-40':21771,'41-45':21771,'46-50':21771,'51-55':21771,'56-59':21771,'60-65':21771,'66-70':21771,'71+':21771 },
    cirugia:     { '0-14':8785,'15-20':25078,'21-25':25078,'26-30':25078,'31-40':31514,'41-45':42708,'46-50':54378,'51-55':66663,'56-59':66663,'60-65':86719,'66-70':99809,'71+':99809 },
    maternidad:  { '0-14':0,'15-20':73462,'21-25':73462,'26-30':73462,'31-40':73462,'41-45':73462,'46-50':0,'51-55':0,'56-59':0,'60-65':0,'66-70':0,'71+':0 },
    altoCosto:   { '0-14':17477,'15-20':17477,'21-25':17477,'26-30':30726,'31-40':47346,'41-45':76533,'46-50':126374,'51-55':201996,'56-59':201996,'60-65':350150,'66-70':577547,'71+':602205 }
  },
  PSM_IVA: 1.05,

  PAC60_TARIFAS: {
    '60-69': { sinAnexo: 358398, conAnexo: 387195 },
    '70-79': { sinAnexo: 416077, conAnexo: 446830 },
    // 80+ solo aplica para renovaciones (no venta nueva) — BR-015
    '80-89': { sinAnexo: 541876, conAnexo: 581983 },
    '90+':   { sinAnexo: 693652, conAnexo: 738905 }
  },

  // Descuentos por periodicidad — duplicados idénticos en crm.html y
  // cotizar.html, consolidados junto con las tarifas del mismo producto.
  PSM_DCTOS: { MENSUAL: 0, TRIMESTRAL: 0.0197, SEMESTRAL: 0.0452, ANUAL: 0.0901 },
  PAC60_DCTOS: { MENSUAL: 0, TRIMESTRAL: 0.025, SEMESTRAL: 0.048, ANUAL: 0.0901 }
};
