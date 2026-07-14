/**
 * Business Configuration Module — Comisiones por producto
 * EPIC-002 · Sprint 0.2 (BR-009)
 *
 * Fuente única de verdad para COM_PCT. Consolidada desde 9 puntos
 * de definición independientes en crm.html + PAC60_COM_PCT (10º punto).
 * Valores verificados idénticos entre todas las copias antes de
 * consolidar (Catálogo de Reglas de Negocio v1.2, BR-009).
 *
 * Consumidor actual: CRM (crm.html) únicamente.
 * Portal (planes.html) y Cotizador (cotizar.html) no consumen
 * comisiones — quedan fuera de alcance de BR-009.
 */
window.BusinessConfig = window.BusinessConfig || {};

window.BusinessConfig.commissions = {
  COM_PCT: { SPTI: 0.07, SPD: 0.08, PSM: 0.12, PAC60: 0.05 }
};
