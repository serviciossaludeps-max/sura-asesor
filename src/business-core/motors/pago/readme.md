# MotorPago

Primer motor del Business Core de Servicios Seguros (EPIC-002, Fase 1).
Aprobado en ADR-007, ubicado según ADR-011.

## Propósito

Centralizar el cálculo de comisión de un pago — hasta ahora duplicado (y
divergente) en 7 puntos distintos de `crm.html`. Es el punto único de
verdad para "¿cuánto se le paga de comisión a un asesor por este pago?".

## Responsabilidades

- Calcular el porcentaje de comisión aplicable a un producto (BR-009), y
  a PSM específicamente según la edad del asegurado (BR-016).
- Calcular la base de comisión ("prima sin IVA" volumétrica) de una venta.
- Calcular el monto final de comisión de un pago.

**Fuera de su responsabilidad** (por decisión explícita, ver Documento de
Arquitectura del Business Core v1.0, Sección 3): decidir si una póliza
está al día, vencida o cancelada (MotorCliente); determinar tarifas o
primas (MotorProducto); validar reglas comerciales como restricciones de
edad de venta (MotorValidación).

## Entradas

`calcularPorcentajeComision(producto, edad)`
- `producto` (string, requerido): `'SPTI' | 'SPD' | 'PSM' | 'PAC60'`
- `edad` (number|string, requerida solo para `'PSM'`): edad del asegurado
  principal de la venta.

`calcularBaseComision(venta)` / `calcularComision(venta)`
- `venta` (object): registro de venta tal como vive hoy en `state.ventas`
  de crm.html. Campos usados: `producto`, `plan`, `periodicidad`, `edad`,
  `prima`, `primaTotal`, `primaSinIVA`, `primaTotalSinIVA`.

## Salidas

- `calcularPorcentajeComision` → `number` (ej. `0.07`) o `null` si no se
  puede calcular (producto desconocido, o PSM sin edad válida).
- `calcularBaseComision` → `number` (pesos, base sin IVA).
- `calcularComision` → `number` (pesos, monto de comisión redondeado) o
  `null` si no se puede calcular — **nunca inventa un valor** cuando
  falta un dato necesario; el llamador decide cómo manejar el `null`
  (típicamente, conservar el comportamiento anterior como respaldo,
  mismo patrón de resiliencia usado en business-config desde Sprint 0).

## Dependencias permitidas

- `business-config` (`constants.js`, `commissions.js`, `pricing.js`) vía
  `window.BusinessConfig`. Ninguna otra.

## Dependencias prohibidas

- No debe leer ni escribir `state`/Firestore directamente — quien
  persiste el pago es `crm.html` (`registrarPago()`), que consulta a
  MotorPago solo para el cálculo.
- No debe conocer el DOM ni ningún elemento de interfaz.
- No debe depender de MotorCliente, MotorProducto ni MotorValidación —
  ver tabla de dependencias del Documento de Arquitectura, Sección 3.

## Regla de negocio central: BR-016

PSM paga 12% de comisión hasta 50 años, 6% desde 51 años — confirmada
por el Product Owner el 14-jul-2026. Antes de este motor, esta regla
solo se aplicaba correctamente en 2 de 7 puntos de cálculo del código
legado (HALLAZGO-OP-002). Con MotorPago como fuente única, los 7 puntos
la aplican por igual.

## Decisión de diseño: comisión por venta, no por asegurado

Para ventas PSM en modo "sumado" (más de un asegurado en una misma
venta), la comisión se calcula sobre la edad del asegurado **principal**
(`venta.edad`), no una mezcla ponderada por cada persona. Esto es
consistente con cómo el resto del sistema ya trata la comisión: una
venta tiene un solo par prima/comisión, no uno por persona. Si en el
futuro se confirma que una venta con asegurados de edades muy distintas
alrededor del umbral de 50 años necesita un tratamiento distinto, esto
requeriría una BR nueva (criterio de aceptación #7, ADR-005) antes de
cambiar este comportamiento.

## Resiliencia

Al integrarse en `crm.html`, todo punto de llamada debe seguir el mismo
patrón de degradación segura usado con `business-config` desde Sprint 0:
si `window.MotorPago` no está disponible, se conserva el comportamiento
que existía antes de la migración (fallback embebido, con advertencia
visible en consola) — nunca fallar en silencio.

## Pruebas

Ver `pago.test.js`. Ejecutar con:

```
node src/business-core/motors/pago/pago.test.js
```

Sin dependencias externas — solo Node y los archivos de `business-config`.
