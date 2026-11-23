# PSM y PAC60 sin base individual guardada · propuesta diferenciada
Fecha: 20-nov-2026. Regla vigente (confirmada por el PO): si no existe la base individual necesaria, la comisión se BLOQUEA. No se reconstruye automáticamente desde la tarifa. C-3 sigue pendiente. No se asume que la tarifa individual equivale a la base de comisión.

## A. PSM (Plan Modular)
### A.1 Información individual que falta
- Base de comisión sin IVA por asegurado (primaTotalSinIVA individual).
- Los módulos contratados por asegurado (básico, EMD, alto costo, cirugía, maternidad) necesarios para fijar la tarifa de cada persona.
- Edad de referencia por asegurado al ciclo (fecha de nacimiento, ya disponible: 0 casos sin fechaNac).

### A.2 Valores guardados al vender
- Primaria: prima sin IVA del grupo (primaTotalSinIVA a nivel de póliza). Disponible.
- Por asegurado: nombre, tipo y número de documento, fecha de nacimiento, edad al vender. Disponible.
- Porcentaje por asegurado al vender (F-3). Existe en el código de venta; NO es base de comisión y no se usa aún.
- Base individual de comisión por asegurado: NO está guardada. El CRM (A.2) calcula la tarifa individual en vivo, pero no la persiste como base.

### A.3 Consecuencias de mantener el bloqueo
- 1735191 (PSM, 2 asegurados) permanece NO_EVALUABLE / FALTA_BASE_GUARDADA. No se genera comisión estimada.
- La comisión que muestra el CRM para estos grupos (63.544 en 1735191) no es verificable por el motor. Divergencia CRM–motor mientras no haya base.
- En E3, las ventas PSM de grupo en ciclo 0 sin base quedarían bloqueadas: su comisión se gestiona manualmente hasta resolver la base.
- Riesgo bajo de comisión incorrecta (el bloqueo impide calcular); riesgo medio de carga operativa.

### A.4 Alternativas técnicas propuestas
| Alternativa | Descripción | Ventajas | Riesgos | Recomendación |
|---|---|---|---|---|
| A | Persistir la base individual al vender (campo por asegurado), con la definición de C-3 | Fuente única y auditable | Solo aplica a ventas nuevas; requiere C-3 aprobado | RECOMENDADA para ventas nuevas |
| B | Reconstrucción histórica por tabla con criterio de cuadre: la suma de bases individuales debe igualar la prima sin IVA del grupo (tolerancia de 1 peso). Marca de origen RECONSTRUIDA. | Permite liquidar históricos | Depende de C-3; requiere autorización por caso | Solo para casos que cuadren exacto |
| C | Mantener el bloqueo y gestionar manualmente | Sin riesgo de cálculo | Carga operativa | Para casos que no cuadren o sin C-3 |

**Recomendación PSM:** C como vigente; A para ventas nuevas cuando C-3 esté aprobado; B solo con autorización caso por caso y cuadre exacto. No se aplica B a 1735191 hasta definir C-3.

## B. PAC60 (Plan 60+)
### B.1 Información individual que falta
- Base sin IVA por asegurado (primaTotalSinIVA individual).
- Modalidad por asegurado: con o sin anexo (conAnexo). El motor exige este dato por persona.
- Edad de referencia por asegurado al ciclo.

### B.2 Valores guardados al vender
- Prima sin IVA del grupo (a nivel de póliza). Disponible.
- Por asegurado: documento, fecha de nacimiento y edad. Disponible.
- Modalidad con o sin anexo por asegurado: NO VERIFICADO en el registro de ventas. Debe confirmarse con una muestra de ventas PAC60 de grupo.
- Tasa: 5 % plana (BR-009). Sin dependencia de edad.

### B.3 Consecuencias de mantener el bloqueo
- Ventas PAC60 de grupo en ciclo 0 sin base individual quedan bloqueadas (FALTA_BASE_GUARDADA).
- Como la tarifa PAC60 es una tabla por rango de edad y anexo, sin dependencia de módulos (a diferencia de PSM), la reconstrucción es técnicamente más directa que en PSM, pero no se asume sin cuadre.

### B.4 Alternativas técnicas propuestas
| Alternativa | Descripción | Ventajas | Riesgos | Recomendación |
|---|---|---|---|---|
| A | Persistir base y conAnexo por asegurado al vender | Fuente única | Solo ventas nuevas | RECOMENDADA para ventas nuevas |
| B | Reconstrucción por tabla PAC60 (edad de referencia y anexo) con cuadre exacto contra la prima sin IVA del grupo (tolerancia 1 peso). Marca RECONSTRUIDA. | Más directa que PSM | Requiere conAnexo confirmado y autorización por caso | Para casos que cuadren |
| C | Mantener bloqueo y gestionar manualmente | Sin riesgo | Carga operativa | Para casos que no cuadren |

**Recomendación PAC60:** C como vigente; A para ventas nuevas; B con cuadre exacto y autorización, una vez confirmada la modalidad por asegurado en una muestra.

## C. Preguntas que el PO debe responder
1. ¿Autoriza la alternativa A para ventas nuevas de PSM cuando C-3 esté aprobado?
2. ¿Autoriza la alternativa B (reconstrucción con cuadre exacto) como procedimiento de excepción por caso?
3. ¿Confirma la existencia del dato conAnexo por asegurado en ventas PAC60 de grupo? (Muestra requerida.)
