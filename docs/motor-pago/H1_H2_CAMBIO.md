# H-1 y H-2 · Cambio de MotorPago (cobro parcial por asegurado y acumulación)
Fecha: 20-nov-2026. Autorización: CEO/PO (requerimiento de cierre de decisiones). Alcance: solo motor de pagos y sus pruebas.

## 1. Archivos modificados
| Archivo | Cambio | Motivo |
|---|---|---|
| src/business-core/motors/pago/comision-asegurados.js | Captura de aseguradoRef en el detalle; bloque de cobros reescrito (H-1 y H-2) | H-1, H-2 |
| tests/pago_h1_h2.test.js | NUEVO: 24 pruebas (H-1, H-2, regresión) | Criterios de aceptación |
| tests/pago_cobro_escalonado.test.js | Reescrito con la interfaz nueva: 6 pruebas | Caso 1729322 |
| business-config/pricing.js | Solo comentario de vigencia SPD 2025 (valores sin cambio) | Confirmación del PO |
| docs/motor-pago/H1_H2_CAMBIO.md | NUEVO: este documento | Entregable |
| evidencias/* | Diff, reversión, salidas de suites, caso reproducible | Entregable |

NO modificados: crm.html, cotizar.html, Firestore, datos, históricos, PSM/PAC60 sin base, reglas C-1/edad/ciclo.

## 2. Nueva interfaz de comisionPoliza(poliza, fechaPago, opts)
| Campo de opts | Obligatorio | Significado |
|---|---|---|
| montoRecibido | No | Monto cobrado con IVA. Sin este campo, el cobro es completo. |
| aseguradoRef | Sí si el cobro es parcial | Documento del asegurado al que pertenece el cobro (H-1). |
| periodoDesde | Sí si hay cobro parcial o cobrosPrevios | Periodo del cobro (agrupa la acumulación, H-2). |
| id | Recomendado | Identificador del cobro. Permite no contar dos veces un cobro (idempotencia). |
| cobrosPrevios | No | Cobros ya registrados: {id, aseguradoRef, periodoDesde, baseCobrada, comision}. |

## 3. Reglas aplicadas
- **H-1:** un cobro parcial se asigna a un solo asegurado. No se reparte entre asegurados. Los demás reciben 0 en ese pago.
- **H-2:** por asegurado y periodo: comisionAcumulada = round(min(baseAcumulada, baseEsperada) × pct); pago = comisionAcumulada − comisionYaPagada.
- **C-1:** cada asegurado se redondea individualmente; el pago de la póliza es la suma de los individuales.
- **Tope:** la comisión acumulada nunca supera el máximo sobre la base esperada del asegurado. El exceso se reporta como excedenteBase y no genera comisión.
- **Cobro completo:** cada asegurado paga lo que le falte de su periodo (si no hay previos, paga el periodo completo, como antes).
- **Orden:** el resultado total no depende del orden de llegada de los cobros parciales.

## 4. Estados de bloqueo nuevos
| Motivo | Cuándo |
|---|---|
| FALTA_ASEGURADO | Cobro parcial sin aseguradoRef, o asegurado sin documento. |
| ASEGURADO_NO_ENCONTRADO | aseguradoRef no corresponde a ningún asegurado de la póliza. |
| IDENTIFICADOR_DUPLICADO | Dos asegurados con el mismo documento (en cobros parciales o con previos). |
| FALTA_PERIODO_COBRO | Cobro parcial o con previos sin periodoDesde. |
| COBRO_PREVIO_INCOMPLETO | Un cobro previo no tiene aseguradoRef o periodoDesde. |
| COMISION_ACUMULADA_INCONSISTENTE | El pago calculado resultaría negativo (los previos ya superan el cálculo). |
| MONTO_RECIBIDO_INVALIDO | Monto no numérico, cero o negativo. |

## 5. Resultado del caso 1729322
Ver evidencias/caso_1729322_reproducible.out.txt.
- Recibo 80325549 (A, 159.120): pago 11.138.
- Recibo 80329476 (B, 143.208): pago 10.025 (antes 10.024 con el reparto proporcional).
- Resto de B (15.912): pago 1.113. Total de B: 11.138 (antes 11.139 por redondeo por pago).

## 6. Pruebas
- pago_h1_h2.test.js: 24 PASS / 0 FAIL.
- pago_cobro_escalonado.test.js: 6 PASS / 0 FAIL.
- Regresión (E1, E1c, E1d, E2, SPTI año, base guardada, SPD 2025, pago, producto, validación): sin fallos. Total de la corrida: 215 pruebas. Salidas en evidencias/suites_h1h2/.

## 7. Riesgos residuales y limitaciones
1. **El CRM aún no envía aseguradoRef, periodoDesde ni cobrosPrevios.** El cambio no tiene efecto en operación hasta E3. Los pagos registrados hoy siguen calculándose como antes por el CRM.
2. **La idempotencia depende del id.** Si el llamador no envía id, un cobro repetido se contaría dos veces. Responsabilidad de E3: el id debe ser único y persistido.
3. **cobrosPrevios debe ser completo.** El motor no lee la base; confía en lo que recibe. Por eso valida campos obligatorios, pero no puede detectar cobros omitidos.
4. **Asignación de recibos a asegurados sin verificar con SURA** (P-2: recibo 80329476). Si la asignación real fuera otra, el resultado por asegurado cambiaría.
5. **Excedente no persistido.** El motor lo reporta; el registro de ese excedente queda fuera de este cambio.
6. **Casos E2 provisionales:** 1731459 (redondeo bajo supuesto de dos bases de 159.120) y 090001626273 (no demostrado). No se declaran resueltos.
7. **PSM y PAC60 sin base individual** siguen bloqueados (FALTA_BASE_GUARDADA). No se tocó esa regla.
8. **Vigencia SPD 2025** confirmada en el comentario de pricing.js. El valor no cambia.

## 8. Reversión
Restaurar src/business-core/motors/pago/comision-asegurados.js desde evidencias/rollback/comision-asegurados.fix15.js (md5 fce208f319ef0e2926dd263b22e9786e) y tests/pago_cobro_escalonado.test.js desde la versión fix15. Borrar tests/pago_h1_h2.test.js. Ningún otro archivo depende de esta reversión.

## 9. Procedimiento de validación antes de cualquier despliegue
1. node --check src/business-core/motors/pago/comision-asegurados.js
2. Ejecutar las 11 suites de pagos (ver evidencias/RESUMEN_SUITES_H1H2.txt): todas deben dar 0 FAIL.
3. node evidencias/caso_1729322_reproducible.js: debe coincidir con caso_1729322_reproducible.out.txt.
4. Despliegue: decisión separada del PO. La validación en producción debe ser de solo lectura.

## 10. Estado de los pendientes de la autorización
| Punto | Estado |
|---|---|
| H-1 | CERRADO en motor y pruebas. Pendiente E3 para uso operativo. |
| H-2 | CERRADO en motor y pruebas. Pendiente E3 para uso operativo. |
| PSM | BLOQUEADO hasta aprobación de C-3. Sin cambios. |
| PAC60 | PENDIENTE de verificación de conAnexo por asegurado (ver REPORTE_CONANEXO_PAC60.md). No ejecutado: requiere datos del PO. |
| SPD 2025 | CONFIRMADO: vigencia 1-ene a 31-dic-2025; valores verificados. |
| E2 | PROVISIONAL: 1731459 y 090001626273 sin declarar definitivos. |
| E3 / captura de montoRecibido | NO iniciado. Fuera de alcance. |


## 11. Actualización 22-nov-2026
- Opción 2 aplicada: ver OPCION2_VENTA_INDIVIDUAL.md.
- Nuevo motivo de bloqueo: ASEGURADOS_NO_REGISTRADOS.
- P-2 cerrado: recibo 80329476 asignado a B. Clave de agrupación = periodo de cuota, no inicio del recibo.
- Suites: 223 pruebas, 0 FAIL.
