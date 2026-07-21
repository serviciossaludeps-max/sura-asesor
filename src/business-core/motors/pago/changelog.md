# CHANGELOG — MotorPago

## v1.0.0 — 18 de julio de 2026

Primera versión. Primer motor del Business Core (EPIC-002, Fase 1),
autorizado en ADR-007, ubicado según ADR-011.

### Agregado

- `calcularPorcentajeComision(producto, edad)` — BR-009 (porcentaje
  plano por producto) y BR-016 (PSM 12%/6% según edad, completa).
- `calcularBaseComision(venta)` — réplica exacta de `_baseComVol()` +
  `getSinIVABase()` de crm.html, ahora como función pura y probada.
- `calcularComision(venta)` — punto único de cálculo del monto final de
  comisión de un pago.
- `pago.test.js` — 28 pruebas: BR-009, BR-016 (incluida la frontera
  exacta 50/51 años), equivalencia contra los 2 puntos que ya calculaban
  bien en el código legado, corrección verificada de los 5 puntos que
  eran planos, y casos límite (datos insuficientes → `null`, nunca un
  valor inventado).

### Corregido

- HALLAZGO-OP-002 (Registro de Hallazgos Operativos): 5 de 7 puntos de
  cálculo de comisión PSM en crm.html no aplicaban la reducción a 6%
  para asegurados de 51+ años — quedan cerrados al centralizar el
  cálculo en este motor.

### Decisiones de diseño registradas

- Para ventas PSM con más de un asegurado ("sumado"), la comisión se
  calcula sobre la edad del asegurado principal, no una mezcla por
  persona — ver README.md, "Decisión de diseño: comisión por venta, no
  por asegurado".
- `calcularComision()` retorna `null` ante datos insuficientes en vez de
  asumir un valor por defecto — el llamador decide el respaldo.

### Pendiente para una próxima versión

- Integración en `crm.html`: reemplazar los 7 puntos de cálculo local
  por llamadas a `MotorPago.calcularComision()`, con salvaguarda de
  resiliencia si el motor no carga.
- Validación de equivalencia funcional en producción (pendiente tras la
  integración).
