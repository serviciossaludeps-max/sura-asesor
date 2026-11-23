# E3 · Sombra del MotorPago en el CRM · Informe (modalidad SOMBRA)
Fecha: 22-nov-2026. Autorización: PO, modalidad sombra. Sin cambios en comisiones visibles, pantallas, Firestore ni datos.

## 1. Qué se agregó
| Archivo | Cambio | Tipo |
|---|---|---|
| crm.html | 4 etiquetas script (resolver-edad, comision-asegurados, sombra, e3-sombra) y 1 función window.__SOMBRA_E3__ | Solo carga y función bajo demanda. 11 líneas agregadas, 0 eliminadas |
| src/business-core/motors/pago/e3-sombra.js | NUEVO: ejecutor puro de la sombra | Sin escrituras |
| tests/pago_e3_sombra.test.js | NUEVO: 8 pruebas | Verificación |
| scripts/run_motor_pago.js y .sh | Suite E3 agregada | Verificación |

La función __SOMBRA_E3__ NO se llama desde ninguna pantalla. Solo se ejecuta si alguien la invoca desde la consola.

## 2. Inventario de consumidores de comisión en crm.html
| Línea | Función | Rol |
|---|---|---|
| 12620 | setComTab | Muestra comisión (pantalla Comisiones) |
| 12676 | _baseSinIVAGrupoSPTI | Calcula base de grupo SPTI |
| 15663 | calcDatosPSM | Vista previa de venta PSM |
| 18725 | migrarComisionPagosSinIVA | Migración (W12) que reescribe comisiones de pagos |
| 18794 | migrarPagosV1 | Migración (W11) que crea pagos |
| 19031 | _primaVisibleVenta | Muestra prima por asegurado |
| 19114 | registrarPago | Calcula y guarda la comisión de cada pago (punto principal) |
| 29276 | cotizadorComparar | Comparador de cotizaciones |
| 35744 | sincronizarFechaExpDesdeCarteraSura | Sincroniza fecha de expedición y puede recalcular |
| 42415 | _agenteEjecutarHerramienta | Estimación del agente |
| 42560 | _agenteEjecutarHerramienta | Comisión mostrada por el agente |

Observación: las dos migraciones (W11 y W12) y la sincronización de cartera SURA pueden reescribir comisiones. Están en el inventario para E3 final; la sombra no las toca.

## 3. Matriz comparativa (diseño)
Columnas por pago: ventaId, póliza, producto, fecha de pago, comisión registrada (CRM), comisión del motor, diferencia, resultado (COINCIDE / DIFERENCIA / NO_EVALUABLE / ERROR) y motivo.
La matriz se genera con MotorPagoE3.ejecutar(ventas, pagos) desde la consola, con __SOMBRA_E3__().

## 4. Registro de diferencias
Pendiente: la matriz real requiere los datos del CRM del PO. Este entorno no tiene acceso a esos datos. Ver sección 8 para el procedimiento.

## 5. Idempotencia (H-1 y H-2)
- Ejecutor E3: misma entrada, misma salida (prueba E6). Ejecutar dos veces no cambia nada.
- Motor, H-1: cobro asignado al asegurado correcto (pago_h1_h2 y pago_cobro_escalonado).
- Motor, H-2: el mismo cobro no se cuenta dos veces por id (prueba H2-f) y el cálculo es determinista (H2-e).
- E3 no pasa cobros parciales ni cobrosPrevios: los pagos legados se evalúan como cobro completo.

## 6. Regresión
- 15 suites de MotorPago, MotorProducto y MotorValidación: 241 pruebas, 0 fallos (node scripts/run_motor_pago.js y bash scripts/run_motor_pago.sh dan el mismo resultado).
- Smoke test del CRM en navegador: carga sin errores de página; __SOMBRA_E3__ responde; localStorage queda idéntico tras ejecutar.
- No disponible en este entorno: las suites de regresión propias del CRM (test2a, f2b, f2c, etc., de sesiones anteriores). Si existen en el repositorio, deben ejecutarse antes de declarar regresión completa.

## 7. Confirmación de comisiones intactas
- crm.html: 0 líneas eliminadas. Ninguna función de comisión fue modificada.
- registrarPago y el resto de consumidores siguen usando window.MotorPago (versión anterior), como hoy.
- MotorPagoE1 queda disponible en el CRM pero ningún cálculo lo llama.

## 8. Procedimiento para el PO (solo lectura)
1. Abrir el CRM con sesión iniciada.
2. En la consola escribir: __SOMBRA_E3__()
3. Copiar el objeto resultante (resumen y filas). Sin nombres ni documentos: solo ids internos, póliza, fecha y montos.
4. Enviar el resultado para construir la matriz y el registro de diferencias.

## 9. Puerta de salida de la sombra (requisito del PO)
Pasar a operación requiere, en este orden:
1. Cero diferencias sin explicar.
2. Casos de E2 resueltos o aceptados por escrito por el PO (1731459, 090001626273).
3. Validación en producción en solo lectura, con evidencia pegada por el PO.
4. Aprobación expresa del PO. La activación operativa y la persistencia de nuevos campos son decisiones separadas.

## 10. Pendientes para E3 operativo (fuera de esta autorización)
- Persistir aseguradoRef, inicioCobertura, id y montoRecibido: requiere autorización independiente.
- Decidir el tratamiento de las migraciones W11, W12 y de la sincronización de cartera antes de activar.
