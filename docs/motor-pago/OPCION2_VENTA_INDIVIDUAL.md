# Opción 2 · Venta individual calculada como titular único
Fecha: 22-nov-2026. Decisión del PO: opción 2 (comisionPoliza acepta ventas individuales).

## Cambio
Si la venta no tiene array de asegurados, el motor toma al titular de los datos de la venta: doc, fechaNac, modulos, conAnexo, primaTotalSinIVA, primaTotal. Es la misma regla que el adaptador de la sombra E2 (sombra.js, adaptarVenta).

## Protección
Si la venta declara numAsegurados mayor que 1 y no tiene array, el motor bloquea con ASEGURADOS_NO_REGISTRADOS. No infiere asegurados faltantes.

## Verificación
- SPTI individual 159.120: comisión 11.138.
- PAC60 individual 368.757 con conAnexo: comisión 18.438 (caso real del CRM).
- Equivalencia: venta individual y la misma venta con un asegurado en array dan el mismo resultado.
- Pruebas: pago_individual.test.js, 8 PASS. Regresión completa: 223 pruebas, 0 FAIL (evidencias/RESUMEN_SUITES_OPCION2.txt).

## Límite
Esto cambia el motor, no el CRM. E3 debe llamar a comisionPoliza con la venta individual tal como se guarda, o usar el adaptador. Sin uno de los dos, las ventas individuales seguirían bloqueadas en producción.

## Reversión
Restaurar comision-asegurados.js desde evidencias/rollback/comision-asegurados.fix17.js (versión de H-1 y H-2) y borrar tests/pago_individual.test.js.
