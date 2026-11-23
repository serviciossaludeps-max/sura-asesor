# Cobro parcial o escalonado · caso 1729322 · verificación de C-1
Fecha: 20-nov-2026. Base de tabla: SPTI PREFERENCIAL 0-40 mensual 2026 sin IVA = 159.120 por asegurado. Período completo: 2 asegurados = 318.240 sin IVA. Tasa 2026: 7 %. Redondeo: C-1 (cada asegurado se redondea y luego se suma).

## 1. Desglose por recibo
| Recibo SURA | Fecha de cobro | Periodo | Base sin IVA cobrada | Asegurado asignado | Comisión C-1 individual | Motor actual | CRM | Estado |
|---|---|---|---|---|---|---|---|---|
| 80325549 | 11-sep-2026 | 22-ago a 22-sep | 159.120 | A (confirmar) | 11.138 | 11.138 | 11.138 | Correcto |
| 80329476 | 11-sep-2026 (GESTOR) | 22-ago a 22-sep | 143.208 | B (confirmar, P-2) | 10.025 | 10.024 | 10.025 | ERROR DEL MOTOR (H-1) |
| Resto de B | Pendiente de cobro | 22-ago a 22-sep | 15.912 | B | 1.113 (= 11.138 − 10.025) | No calculado | No registrado | Pendiente; ver H-2 |
| 80368494 | 02-nov-2026 | 22-sep a 22-oct | 318.240 | A y B | 22.276 (11.138 × 2) | 22.276 | 22.276 | Correcto |
| 80776049 | 02-nov-2026 | 22-oct a 22-nov | 318.240 | A y B | 22.276 | 22.276 | 22.276 | Correcto |

Nota: la asignación de cada recibo a un asegurado (columna "asegurado asignado") debe confirmarse con SURA (P-2). El desglose asume que el recibo de 143.208 corresponde a un solo asegurado; el texto del recibo (GESTOR, fecha 25-ago) es consistente con una aprobación posterior de ese asegurado.

## 2. Límite del periodo
- Periodo 22-ago a 22-sep: máximo = 22.276 (2 × 11.138).
- Comisión acumulada hasta hoy = 11.138 + 10.025 = 21.163.
- Pendiente máximo = 1.113 (cuando se cobre el resto de B). No puede superarse 22.276.

## 3. Acumulación sin duplicaciones (H-2)
Caso de prueba (motor actual, reparto por pago):
- Cobro de B por 143.208 → 10.025.
- Cobro posterior del resto de B por 15.912 → round(15.912 × 0.07) = 1.114.
- Total de B = 11.139. Correcto por asegurado = round(159.120 × 0.07) = 11.138. Sobra 1 peso.
Conclusión: cada pago redondea por separado y acumula 1 peso de más. Se requiere comisión acumulada por asegurado.

## 4. Corrección propuesta (requiere autorización)
1. **Asignación:** cada cobro parcial se asigna a un asegurado (no se reparte por proporción). Sin identificador de asegurado, el cobro no se calcula (BLOQUEADO).
2. **Acumulación por asegurado y periodo:** comisión_i_acumulada = round(min(base_cobrada_acumulada_i, base_esperada_i) × pct_i). Pago_nuevo = comisión_i_acumulada − comisión_ya_pagada_i.
3. **Límite:** la suma de comisiones de un periodo no supera round(base_esperada × pct) por asegurado.
4. **Trazabilidad:** cada cobro guarda recibo, asegurado, fecha, base sin IVA cobrada y la fórmula aplicada.
5. **Prueba que falla hoy:** el test "cobro parcial de 143.208" debe comprobar el asegurado asignado y la comisión 10.025.

## 5. Estado
- Desglose: completo, con cifras exactas.
- C-1 por cobro: correcto en el cálculo individual; el reparto del motor no lo aplica bien (H-1).
- Acumulación: NO cumple (H-2).
- Límite del periodo: cumple solo en cobro completo.
- Trazabilidad: falta (P-9, E3).
- Resultado: el cobro parcial NO está listo para E3 hasta autorizar la corrección.
