# CHANGELOG — MotorValidación

## v1.0.0 — 21 de julio de 2026

Primera versión. Segundo motor del Business Core (EPIC-002, Fase 1),
autorizado en ADR-007, alcance definido en el Inventario de
Consumidores BR-015.

### Agregado

- `esElegiblePAC60VentaNueva(edad)` — BR-015, elegibilidad de venta
  nueva de PAC60 (60-79 años).
- `validarEdadPAC60(edad, tipoMov)` — BR-015 completa, con distinción
  administrativa (venta nueva vs. renovación/cartera existente).
- `validacion.test.js` — 28 pruebas: frontera exacta (59/60/79/80),
  distinción NUEVO/RENOVACION, casos límite (dato insuficiente →
  `valido: null`, nunca inventa), y equivalencia funcional replicada
  contra los 5 consumidores reales.

### Corregido

- Estimador interno del cotizador (crm.html) y comparador de planes
  (crm.html): ambos mostraban tarifas de PAC60 80-89/90+ como si fueran
  una oferta de venta nueva válida — cerrado (Inventario BR-015,
  Sección 3, "gaps encontrados").

### Consolidado (sin cambio de comportamiento)

- 4 implementaciones independientes de la misma regla (60/79 años),
  antes con literales numéricos repetidos en 6 lugares de 2 archivos,
  ahora centralizadas en un solo motor. Los textos de advertencia de
  cada consumidor se conservaron exactamente iguales — solo la lógica
  de decisión se centralizó.

### Decisiones de diseño registradas

- Los 3 consumidores sin concepto de "tipo de movimiento" (estimador,
  comparador, cotizador público) se tratan siempre como venta nueva —
  nunca tienen contexto de renovación, así que no hay ambigüedad.
- `validarEdadPAC60()` retorna `valido: null` ante datos insuficientes;
  cada consumidor conserva su propio chequeo de respaldo exacto para
  ese caso (ver README.md).

### Explícitamente fuera de alcance

- Integridad tomador/asegurado y póliza duplicada — sin BR que las
  respalde, no se tocan (ver README.md, "Fuera de alcance").
- `getRangoPAC60()` (clasificación administrativa de 4 rangos) — queda
  en MotorProducto, no en este motor.
- HALLAZGO-OP-003 y `calcPrimaMensualSinIVA()` — no se tocaron, por
  instrucción explícita del CEO.

### Pendiente para el Gate Review

- Validación en producción real de los 5 consumidores (pendiente tras
  el despliegue).
