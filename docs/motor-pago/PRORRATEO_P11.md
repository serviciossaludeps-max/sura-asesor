# P-11 · Prorrateo por inicio de cobertura (primera cuota)
Fecha: 22-nov-2026. Autorizado por el CEO/PO con tres condiciones: convención de 30 días, aplica a grupos, E3 guarda la fecha de inicio por asegurado.

## Regla
1. Solo aplica a la primera cuota (ciclo 0) de un asegurado.
2. Días no cubiertos = días comerciales 30/360 entre fechaExp (inicio de la cuota) y inicioCobertura del asegurado.
3. Base de la cuota = base completa × (30 − días no cubiertos) / 30, redondeada a peso.
4. Se aplica por asegurado. Cada asegurado tiene su propio inicioCobertura.
5. Después de prorratear, la comisión sigue siendo C-1: redondeo individual y suma.

## Casos de bloqueo
| Motivo | Cuándo |
|---|---|
| FECHA_INICIO_COBERTURA_INVALIDA | inicioCobertura no tiene formato YYYY-MM-DD, o fechaExp no lo tiene. |
| INICIO_COBERTURA_FUERA_DE_CUOTA | Los días no cubiertos son 30 o más (la cobertura no inicia en la primera cuota). |

Sin inicioCobertura, no se aplica prorrateo (comportamiento anterior). E3 debe enviar siempre este dato.

## Caso de referencia 1729322
- Asegurado B: inicio 25/08, fechaExp 22/08. Días no cubiertos = 3. Base = 159.120 × 27/30 = 143.208.
- Comisión de B en la cuota: 10.025. Un cobro posterior de 15.912 no genera pago (excedente).
- Asegurado A: inicio 22/08. Sin prorrateo. Comisión 11.138.

## Pruebas
tests/pago_prorrateo.test.js: 10 PASS / 0 FAIL. Incluye el caso 1729322, la venta individual, la convención 30/360 (31/08 a 01/09 = 29 días cubiertos) y los bloqueos.
Regresión: 14 suites, 233 pruebas, 0 FAIL (evidencias/RESUMEN_SUITES_P11.txt).

## Limitaciones
1. Convención simplificada: los días 30 y 31 se tratan como 30 en ambos extremos. Puede diferir en un día de la 30/360 estricta en casos de inicio el día 31 con fechaExp anterior al 30. Caso poco frecuente; a confirmar si aparece en datos.
2. El motor no valida que inicioCobertura coincida con el recibo de SURA. Esa validación es responsabilidad de E3 o de la sincronización.
3. El prorrateo no aplica a cuotas posteriores a la primera.

## Reversión
Restaurar comision-asegurados.js desde la versión de la opción 2 (fix18) y borrar tests/pago_prorrateo.test.js.

## Requisito para E3
Guardar inicioCobertura por asegurado (en la venta individual, a nivel de venta) con formato YYYY-MM-DD. Sin este dato el motor no prorratea y puede mostrar saldos falsos en altas que inician después de la cuota.
