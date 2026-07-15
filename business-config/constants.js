/**
 * Business Configuration Module — Constantes financieras transversales
 * EPIC-002 · Sprint 0.3 (BR-014)
 *
 * IVA_FACTOR: consolidado desde crm.html (línea 16682 original).
 * Verificado idéntico contra los valores estáticos de planes.html y
 * las tablas propias de cotizar.html (Catálogo v1.3, BR-014).
 */
window.BusinessConfig = window.BusinessConfig || {};
 
window.BusinessConfig.constants = {
  IVA_FACTOR: 167076 / 159120 // = 1.05 exacto (verificado)
};
 
