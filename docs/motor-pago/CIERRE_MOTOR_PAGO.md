# Cierre técnico del MotorPago (Business Core)
Fecha: 22-nov-2026. Ámbito: motor de pagos y comisiones en src/business-core/motors/pago/ y sus pruebas.

## 1. Estado
- Cierre técnico en repositorio: PROPUESTO. Pendiente de la verificación del PO (sección 5).
- Cierre operativo (el CRM calcula comisiones con el motor): NO. Requiere E3 y validación de producción en solo lectura.
- Ninguna parte del cierre modifica CRM, Firestore, datos históricos ni producción.

## 2. Alcance cumplido
| Componente | Estado | Pruebas |
|---|---|---|
| Comisión por asegurado (C-1, edad de referencia, ciclo, tasa por año de pago) | Cumplido | pago_e1, e1c, e1d (68) |
| SPTI por año (2024–2026), base guardada validada (opción A) | Cumplido | pago_spti_anio (16), pago_base_guardada (7) |
| SPD: tabla 2025 y 2026, tasa por año de pago | Cumplido | pago_spd_2025 (4) |
| Sombra E2 (comparación sin escrituras) | Cumplido | pago_e2 (8) |
| H-1: asignación del cobro parcial a un asegurado identificado | Cumplido | pago_h1_h2, pago_cobro_escalonado (30) |
| H-2: acumulación por asegurado y periodo, sin duplicar | Cumplido | pago_h1_h2 |
| Opción 2: venta individual como titular único | Cumplido | pago_individual (8) |
| P-11: prorrateo por inicio de cobertura, primera cuota, 30/360 | Cumplido | pago_prorrateo (10) |
| Bloqueos explícitos (PSM y PAC60 sin base individual, datos faltantes) | Cumplido | distribuido en las suites |

Total: 14 suites, 233 pruebas, 0 fallos. Ejecución: bash scripts/run_motor_pago.sh.

## 3. Reglas vigentes que el motor respeta
- C-1: redondeo individual por asegurado y suma.
- Tasa de comisión por año de pago (SPTI 2024–2025 6 %, 2026 7 %; SPD 2025 7 %, 2026 8 %; PSM por edad; PAC60 5 %).
- PSM y PAC60 sin base individual guardada: BLOQUEADO (FALTA_BASE_GUARDADA). No se reconstruye desde la tarifa.
- Prorrateo solo en la primera cuota, convención 30/360, por asegurado.
- Sin fecha de inicio de cobertura no se prorratea (comportamiento anterior).

## 4. Fuera del cierre del motor (con responsable)
| Pendiente | Responsable | Motivo |
|---|---|---|
| E3: el CRM envía aseguradoRef, periodoDesde de cuota, id persistido, cobrosPrevios e inicioCobertura por asegurado | CTO con autorización del PO | Integración; no autorizada aún |
| E3: captura de montoRecibido en el CRM | CTO con autorización del PO | Integración |
| E3: decidir si el CRM llama a comisionPoliza directamente (opción 2 ya lo permite) | CTO | Integración |
| C-3: base individual de PSM según módulos | Comisiones | Decisión de negocio pendiente |
| PAC60 de grupo: captura de conAnexo por asegurado | CTO / PO | Sin casos de grupo hoy; requisito para el primero |
| E2: 1731459 (redondeo sobre supuesto de bases de 159.120) y 090001626273 (no demostrado) | PO (bases individuales) | Datos del asegurado |
| Convención 30/360 en días 31 con fechaExp anterior al 30 | PO | Confirmar si aparece en datos reales |
| Recálculo de históricos | Ninguno | No autorizado; no se hace |
| Validación en producción | PO (solo lectura) | Requisito para cierre operativo |

## 5. Verificación requerida del PO antes de declarar el cierre técnico
1. Desde la raíz del repositorio: bash scripts/run_motor_pago.sh. Debe terminar con CODIGO_SALIDA=0 y mostrar 233 pruebas en total.
2. Comparar los md5 de los archivos del motor con la lista de la sección 6.
3. Confirmar que no hay otros cambios en el repositorio en src/business-core/motors/pago/ ni en business-config/pricing.js.

## 6. md5 de referencia
| Archivo | md5 |
|---|---|
| src/business-core/motors/pago/comision-asegurados.js | d484e643eb2b9c7027cc92af369b00ff |
| business-config/pricing.js | fc51eb513d9fed01fb6d9b07fd5135a0 |
| tests/pago_prorrateo.test.js | 1e3f70158d51d7ca10db18b0403cf765 |
| tests/pago_individual.test.js | bef2d6d4cd846d873607043ab726efc7 |
| tests/pago_h1_h2.test.js | d4ad4e7eb001e7fa711837a79cc42e91 |
| tests/pago_cobro_escalonado.test.js | 300430f8415f7801402457c93e856899 |
| tests/pago_spd_2025.test.js | 25ad8d2b1bed3a573f72c26f3b44dc65 |

## 7. Riesgos residuales
1. Hasta E3, el motor no afecta ningún cálculo operativo. El riesgo de comisiones incorrectas en el CRM sigue siendo el de hoy.
2. Sin el id de cobro persistido, la idempotencia no se garantiza en E3.
3. Si E3 no envía inicioCobertura, el motor no prorratea y puede mostrar saldos falsos en altas que inician después de la cuota.
4. Las ventas PAC60 de grupo y PSM de grupo sin base individual seguirán bloqueadas hasta C-3 y la captura por asegurado.

## 8. Criterio de cierre operativo
El motor se considera operativo cuando se cumplan las tres condiciones:
1. E3 integrado y autorizado.
2. Sombra E2 sin diferencias nuevas, con los casos provisionales resueltos o aceptados por escrito por el PO.
3. Validación en producción en solo lectura con evidencia pegada por el PO.
