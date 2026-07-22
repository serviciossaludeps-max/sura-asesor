# MotorValidación

Segundo motor del Business Core de Servicios Seguros (EPIC-002, Fase 1).
Aprobado en ADR-007, ubicado según ADR-011, alcance aprobado tras el
Inventario de Consumidores BR-015 (21-jul-2026).

## Propósito

Centralizar reglas de elegibilidad que hoy viven dispersas y duplicadas
en los consumidores. v1.0 implementa únicamente **BR-015**: la
restricción comercial de edad para venta nueva de PAC60 (60-79 años).

## Responsabilidades

- Determinar si una edad es elegible para vender PAC60 como venta
  nueva (BR-015).
- Distinguir entre venta nueva (restringida a 60-79) y uso
  administrativo — renovación, cartera existente (sin restricción de
  máximo).

**Fuera de su responsabilidad** (ver Documento de Arquitectura del
Business Core v1.0, Sección 3): calcular tarifas (MotorProducto);
clasificar el rango administrativo completo de edad para PAC60
(`getRangoPAC60()`, 4 rangos — sigue siendo de MotorProducto); calcular
comisiones (MotorPago); cualquier otra validación de integridad no
respaldada por una BR — ver "Fuera de alcance" abajo.

## Fuera de alcance (v1.0)

Encontradas durante el inventario, sin BR que las respalde todavía:

- Integridad tomador/asegurado (hoy: `confirm()` en `guardarVenta()`,
  crm.html).
- Póliza duplicada (hoy: `checkPolizaExiste()`, crm.html).

No se migran hasta que el Product Owner las confirme como BR nueva
(ADR-005). Documentadas en el Inventario de Consumidores BR-015.

## Entradas

`esElegiblePAC60VentaNueva(edad)`
- `edad` (number|string): edad del asegurado.

`validarEdadPAC60(edad, tipoMov)`
- `edad` (number|string).
- `tipoMov` (string, opcional): `'NUEVO' | 'RENOVACION' | otro`. Si se
  omite, se asume venta nueva (así operan 3 de los 5 consumidores, que
  nunca tienen un concepto de "renovación" en su contexto).

## Salidas

- `esElegiblePAC60VentaNueva` → `boolean`. Replica exactamente
  `!(edad<60 || edad>79)` del código legado, incluida su tolerancia a
  `NaN`/`undefined` (no dispara advertencia) — ver `validacion.test.js`
  para la equivalencia verificada.
- `validarEdadPAC60` → `{ valido: boolean|null, motivo: 'MIN'|'MAX_NUEVA'|null }`.
  `valido: null` cuando la edad no es utilizable (ej. `0`, vacío) — el
  motor no decide por el llamador; cada consumidor conserva su propio
  comportamiento de respaldo para ese caso (ver integración en
  `guardarVenta()`/`calcDatosPAC60()`, ambas caen al chequeo legado
  exacto cuando `valido === null`).

## Los 5 consumidores migrados

1. `crm.html` — `guardarVenta()` (bloqueo real al guardar).
2. `crm.html` — `calcDatosPAC60()` (vista previa del formulario).
3. `crm.html` — estimador interno del cotizador (cierre de gap: antes
   mostraba tarifas 80-89 como si fueran vendibles).
4. `crm.html` — comparador de planes (mismo cierre de gap).
5. `cotizar.html` — validación de edad del cotizador público.

`planes.html` no se toca — no es un flujo de venta.
`getRangoPAC60()` (crm.html y cotizar.html) no se toca — sigue siendo
responsabilidad de MotorProducto.

## Comportamiento administrativo preservado

- `tipoMov === 'RENOVACION'`: edad > 79 sigue siendo válida — sin
  cambios frente al código legado.
- Edad < 60: inválida siempre, sin importar `tipoMov` — PAC60 nunca
  aplica por debajo de su edad mínima, ni siquiera en renovación.
- `crm.html` sigue permitiendo consultar/gestionar cartera existente de
  cualquier edad — MotorValidación solo interviene en los 5 puntos de
  venta/cotización listados arriba, nunca en la vista de cartera.

## Dependencias permitidas

Ninguna — es un motor sin estado, sin DOM, sin Firestore, sin
business-config (BR-015 no depende de tarifas).

## Dependencias prohibidas

- No debe depender de MotorProducto, MotorPago ni MotorCliente.
- No debe leer `state`/Firestore ni el DOM directamente — cada
  consumidor le pasa los datos ya extraídos (`edad`, `tipoMov`).

## Resiliencia

Los 5 puntos de integración siguen el mismo patrón que MotorPago: si
`window.MotorValidacion` no está disponible, se ejecuta el chequeo
legado exacto (mismos números, misma condición) — probado
explícitamente en ambos sentidos.

## Pruebas

Ver `validacion.test.js`. Ejecutar con:

```
node src/business-core/motors/validacion/validacion.test.js
```
