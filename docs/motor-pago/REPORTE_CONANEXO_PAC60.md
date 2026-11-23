# REPORTE · Verificación de conAnexo por asegurado en PAC60
Estado: NO EJECUTADO. No tengo acceso a los datos de producción ni a la muestra de ventas PAC60 de grupo. Esta verificación requiere que el PO ejecute el script de solo lectura y entregue la salida.

## 1. Lo que debe verificarse (requerimiento §6)
| Pregunta | Respuesta | Fuente |
|---|---|---|
| ¿Dónde se captura conAnexo? | Pendiente | Revisión de código del formulario de venta PAC60 (verificable en repositorio, no concluida en esta entrega) |
| ¿Se guarda por asegurado o solo a nivel de póliza? | Pendiente | Script de solo lectura (sección 2) |
| ¿Distingue con anexo y sin anexo? | Pendiente | Script de solo lectura |
| ¿Se conserva después de guardar? | Pendiente | Script de solo lectura sobre ventas guardadas |
| ¿Se puede usar sin inferencias para la base individual? | Pendiente | Depende de las respuestas anteriores |
| ¿Qué casos de la muestra cumplen? | Pendiente | Salida del script |

## 2. Script de solo lectura para el PO
Archivo: evidencias/verificar_conAnexo_PAC60_solo_lectura.js. Pegar en la consola del CRM con sesión iniciada. No escribe nada. No imprime documentos ni nombres: solo claves y presencia del dato.

## 3. Resultado
Pendiente. Mientras no haya salida del script, PAC60 de grupo permanece bloqueado (FALTA_BASE_GUARDADA) y no se implementa la persistencia por asegurado.

## 4. Criterio para decidir
- Si conAnexo está por asegurado y se conserva: presentar diseño de persistencia (base sin IVA, conAnexo y edad de referencia por asegurado, ligados a la póliza).
- Si no: mantener el bloqueo y presentar el hallazgo al PO antes de implementar.


## 9. Opción 2 aplicada (22-nov-2026)
Las ventas individuales de PAC60 y SPTI se calculan como titular único. La póliza PAC60 real da 18.438 con conAnexo a nivel de venta. Detalle en OPCION2_VENTA_INDIVIDUAL.md.
