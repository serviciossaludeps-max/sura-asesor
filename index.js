/**
 * Business Configuration Module — Punto de entrada único
 * EPIC-002 · Sprint 0.1 (infraestructura) · ADR-003
 *
 * Ninguna aplicación (CRM, Portal, Cotizador) es dueña de las constantes
 * de negocio: todas son consumidoras de este módulo.
 *
 * Orden de carga requerido en cada HTML consumidor (antes de cualquier
 * script que use window.BusinessConfig):
 *   <script src="business-config/index.js"></script>
 *   <script src="business-config/constants.js"></script>
 *   <script src="business-config/commissions.js"></script>
 *   <script src="business-config/pricing.js"></script>
 *
 * Consumidores actuales: crm.html, planes.html, cotizar.html
 *
 * Estado de migración (ver Catálogo de Reglas de Negocio v1.2):
 *   - BR-009 (COM_PCT)                  → Sprint 0.2 — en progreso
 *   - BR-014 (IVA_FACTOR, SPTI_SIN_IVA) → Sprint 0.3 — pendiente
 *   - BR-013 (prima anual)              → Sprint 0.4 — pendiente
 */
window.BusinessConfig = window.BusinessConfig || {};
