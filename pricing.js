/**
 * Business Configuration Module — Tarifas por producto
 * EPIC-002 · Sprint 0.1 (infraestructura)
 *
 * BR-014: SPTI_SIN_IVA y tablas de tarifas (SPTI, PSM, PAC60) hoy
 * duplicadas entre crm.html, planes.html y cotizar.html.
 * BR-015: PAC60 solo es comercialmente vendible entre 60 y 79 años
 * (venta nueva) — este módulo deberá exponer esa restricción de forma
 * explícita cuando se migren los valores, para no depender de que un
 * consumidor "olvide" incluir los rangos 80-89/90+.
 *
 * Migración de valores programada para Sprint 0.3 (SPTI, PAC60, PSM)
 * y Sprint 0.4 (prima anual, BR-013). Este archivo se crea vacío a
 * propósito, para establecer la arquitectura antes de mover cualquier
 * constante.
 */
window.BusinessConfig = window.BusinessConfig || {};

window.BusinessConfig.pricing = {
  // SPTI_SIN_IVA, PAC60_TARIFAS, PSM_TARIFAS: pendientes de migrar
  // en Sprint 0.3. PAC60_VENTA_NUEVA_EDAD_MAX (BR-015): pendiente.
};
