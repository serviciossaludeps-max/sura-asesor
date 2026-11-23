# MotorPago · Registro de decisiones y pendientes
Fecha: 20-nov-2026. Estado: documento de control. No autoriza cambios en CRM, Firestore, datos históricos ni producción.

## 1. Decisiones del CEO/PO (confirmadas hoy)
| # | Tema | Decisión | Estado |
|---|---|---|---|
| D-1 | PSM y PAC60 sin base individual guardada | Se mantiene el bloqueo (FALTA_BASE_GUARDADA). No se reconstruye automáticamente desde la tarifa. | VIGENTE |
| D-2 | Cobro parcial o escalonado | Lógica aceptable como propuesta técnica. Requiere verificación (ver §3). | EN VERIFICACIÓN |
| D-3 | SPD 2025 | Tabla confirmada: mensual 87.603, trimestral 257.633, semestral 501.848, anual 956.465 (sin IVA). | IMPLEMENTADO en repositorio (pricing.js). Vigencia 2025: por confirmar (se asumió 1-ene a 31-dic-2025). |
| D-4 | Redondeo E2 (1731459 y 090001626273) | Solo es redondeo si se demuestra que es el redondeo individual de C-1. | 1731459: DEMOSTRADO bajo el supuesto de dos bases de 159.120 (verificar con el detalle real). 090001626273: NO DEMOSTRADO. |
| D-5 | Captura de montoRecibido en el CRM | Pendiente de E3. No se implementa en esta autorización. | PENDIENTE E3 |
| D-6 | Entregable | Registro, evidencias de pruebas, desglose de cobro escalonado y propuesta diferenciada PSM/PAC60. | ENTREGADO (esta carpeta y evidencias/) |

## 2. Hallazgos nuevos de esta verificación
- **H-1 · Error del motor en reparto de cobro parcial.** El motor reparte un cobro parcial entre asegurados en proporción a su base. Un recibo corresponde a un solo asegurado. Caso 1729322, recibo 80329476: motor 10.024, correcto 10.025 (CRM). La diferencia NO es de redondeo C-1. Estado: ABIERTO. Corrección propuesta: asignación del cobro por asegurado (ver COBRO_ESCALONADO_1729322.md §4).
- **H-2 · Acumulación por pago duplica $1.** Cada pago se calcula con redondeo propio. En 1729322, el asegurado B acumula 10.025 + 1.114 = 11.139; el correcto por asegurado es 11.138. Estado: ABIERTO. Corrección propuesta: comisión acumulada por asegurado y periodo, menos lo ya pagado.
- **H-3 · Recibo 80329476 con 10 % menos.** Recibo de 143.208 sobre base de 159.120. Causa no identificada en los datos disponibles. Estado: PENDIENTE DE CONFIRMAR CON SURA.
- **H-4 · Test de cobro parcial de 143.208 no valida el reparto.** Solo verifica la suma y que comisión = suma por asegurado. Estado: ABIERTO. Debe reforzarse al corregir H-1.
- **H-5 · Corrección previa sobre "C-1" retirada.** En la verificación anterior se atribuyó a C-1 la diferencia de 1.024/1.025. La evidencia muestra que es un error del motor (H-1). El CRM tiene el valor correcto.

## 3. Estado del cobro escalonado (D-2)
| Verificación pedida | Resultado |
|---|---|
| Desglose de comisión por asegurado | Existe, pero el reparto de cobro parcial es incorrecto (H-1). |
| Aplicación de C-1 en cada cobro | Correcta en el cálculo individual; incorrecta la asignación del cobro (H-1). |
| Acumulación sin duplicaciones | NO cumple (H-2): cada pago redondea por separado. |
| Límite de comisión del periodo completo | Cumple en cobro completo (22.276 = 2 × 11.138). Para cobros parciales sumados no hay control de límite (depende de H-2). |
| Trazabilidad de cada recibo | Falta: el motor no recibe recibo ni asegurado asignado. Se requiere en E3 (D-5). |

**Conclusión:** el cobro parcial NO está listo para E3. Requiere autorización para corregir H-1 y H-2.

## 4. Pendientes
| ID | Pendiente | Responsable | Bloquea |
|---|---|---|---|
| P-1 | Autorizar corrección de reparto por asegurado (H-1) y acumulación (H-2) | CEO/PO | E3 |
| P-2 | Confirmar con SURA la asignación del recibo 80329476 a su asegurado y la causa del 10 % menos (H-3) | PO | Caso 1729322 |
| P-3 | Confirmar vigencia del SPD 2025 (D-3) | PO | Ventas SPD 2025 en ciclo ≥ 1 |
| P-4 | Entregar las bases individuales de 090001626273 para demostrar o descartar C-1 (D-4) | PO / CRM | Clasificación E2 |
| P-5 | Entregar el detalle por asegurado de 1731459 (confirmar que las bases son 159.120 cada una) | PO / CRM | Clasificación E2 |
| P-6 | Decidir alternativa para PSM sin base individual (ver PSM_PAC60_BASE_INDIVIDUAL.md) | CEO/PO | Ventas PSM de grupo |
| P-7 | Decidir alternativa para PAC60 sin base individual | CEO/PO | Ventas PAC60 de grupo |
| P-8 | C-3: base individual de PSM según módulos | Comisiones | PSM |
| P-9 | Captura de montoRecibido y recibo por asegurado en el CRM | CTO / PO | E3 (D-5) |
| P-10 | Actualizar la versión en crm.html y cotizar.html de pricing.js (?v=) si se despliega SPD 2025 | PO | Solo caché; no afecta cálculos del CRM |

## 5. Evidencias (carpeta evidencias/)
- RESUMEN_SUITES.txt: 11 suites, 0 fallos. Incluye las 6 pruebas de cobro escalonado y las 4 de SPD 2025.
- suites/*.out.txt: salida completa de cada suite.
- demo_c1_cobro_escalonado.js y .out.txt: cálculo individual de C-1 con el motor real.


## 6. Actualización 20-nov-2026 (cierre de decisiones y H-1/H-2)
| Punto | Estado |
|---|---|
| H-1 asignación de cobro parcial por asegurado | CERRADO en motor (pruebas 24 + 6 PASS). Pendiente E3 para operación. |
| H-2 acumulación por asegurado y periodo | CERRADO en motor. Pendiente E3 para operación. |
| PSM | Bloqueado hasta C-3 aprobado (decisión A_C3). Sin cambios. |
| PAC60 | A_VERIFICAR: informe pendiente (REPORTE_CONANEXO_PAC60.md). Requiere salida del script de solo lectura del PO. |
| SPD 2025 | CONFIRMADO: vigencia 1-ene a 31-dic-2025. |
| E2 | PROVISIONAL: 1731459 y 090001626273 sin conclusión definitiva. |
| Captura de montoRecibido / aseguradoRef / cobrosPrevios en CRM | NO iniciado (E3). |
Detalle: docs/motor-pago/H1_H2_CAMBIO.md.


## 7. Actualización 22-nov-2026
| Punto | Estado |
|---|---|
| Opción 2 (venta individual = titular único) | IMPLEMENTADA en motor. 8 pruebas PASS. Ver docs/motor-pago/OPCION2_VENTA_INDIVIDUAL.md. |
| P-2 recibo 80329476 | CERRADO. Recibo del asegurado B (segundo aprobado, 3 días después). Periodo de cuota 22-ago a 22-sep; inicio del recibo 25-ago (dato de trazabilidad, no clave de agrupación). Base 143.208 sin IVA. Comisión 10.025. |
| H-3 diferencia de 10 % (15.912) del recibo de B | ABIERTO. Causa no explicada. Confirmar con SURA si el resto está pendiente de cobro o fue descontado. Si está pendiente, la comisión adicional sería 1.113. |
| Clave de acumulación | periodoDesde debe ser el inicio de la cuota (22-ago), no el inicio del recibo (25-ago). El caller es responsable. |
| E3 | Sin iniciar. Requiere: enviar aseguradoRef, periodoDesde de cuota, id persistido y cobrosPrevios. |


## 10. P-11 cerrado (22-nov-2026)
- Autorizado por el PO con tres condiciones: convención 30 días, aplica a grupos, E3 guarda inicioCobertura por asegurado.
- Implementado en motor: primera cuota, 30/360, por asegurado. Detalle en PRORRATEO_P11.md.
- Pruebas: 10 nuevas PASS. Regresión: 233 pruebas, 0 FAIL.
- Pendiente para E3: enviar y guardar inicioCobertura por asegurado con formato YYYY-MM-DD.
