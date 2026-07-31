# MotorProducto

Tercer motor del Business Core de Servicios Seguros (EPIC-002, Fase 1).
Aprobado en ADR-007, alcance definido en el Inventario de MotorProducto
y el documento de Contratos y Matriz de Equivalencia (22-jul-2026).

## Propósito

Responder **"¿cuánto cuesta este producto?"** — tarifas, descuentos,
IVA y prima anual — para SPTI, PSM y PAC60, consolidando hasta 3
implementaciones independientes de la misma fórmula que existían en
cotizar.html y crm.html.

## Frontera con MotorPago

MotorProducto calcula **prima** (lo que paga el cliente). MotorPago
calcula **comisión** (lo que se le paga al asesor). Son responsabilidades
distintas y esta frontera se mantiene deliberadamente limpia:
MotorPago **no depende** de MotorProducto (prohibido explícitamente en
el Documento de Arquitectura, Sección 3) — mantiene su propia función
interna de base de comisión, construida antes que este motor. Ningún
archivo de MotorPago se tocó al construir MotorProducto.

## Responsabilidades

- Clasificar el rango de edad de un asegurado para SPTI, PSM y PAC60.
- Calcular el precio de un producto para un periodo (mensual,
  trimestral, semestral, anual) con su descuento correspondiente.
- Calcular la prima anual de una venta (BR-013).

## Fuera de responsabilidad (deliberado)

- **Comisión** — MotorPago.
- **Elegibilidad de venta** (¿puede venderse esto?) — MotorValidación.
  MotorProducto solo calcula el precio SI ya se le indicó el rango/
  contexto correcto; no decide si la venta es válida.
- **SPD_TARIFAS** — única copia existente (cotizar.html), sin
  duplicación real. No se centraliza aquí.
- **calcPrimaMensualSinIVA()** — HALLAZGO-OP-003 (tabla SPTI divergente
  usada en impacto de cancelación). Permanece intacta, sin tocar, hasta
  que el Product Owner confirme cuál valor es correcto.

## BR-015: dos funciones separadas, sin inferencia de contexto

`getRangoPAC60Administrativo(edad)` (4 rangos: 60-69/70-79/80-89/90+) y
`getRangoPAC60VentaNueva(edad)` (2 rangos: 60-69/70-79) son funciones
distintas. `calcularPrecioPAC60()` exige un parámetro `contexto`
explícito (`'ADMINISTRATIVO'` o `'VENTA_NUEVA'`) — si se omite, retorna
`null` en vez de asumir. Ningún consumidor puede pedir un precio PAC60
sin declarar para qué lo está pidiendo.

## Riesgo de diseño resuelto: el adaptador de Maternidad

`calcularPrecioPSM()` valida SIEMPRE la edad (15-45 años) para incluir
el módulo Maternidad, sin importar el flag recibido — igual que
`calcDatosPSM()`/`calcularPersona()` del código legado. El consumidor
de registro de pago (que hoy guarda `venta.modulos` ya filtrado) debe
traducir ese arreglo a los booleans de entrada de este motor **sin
volver a aplicar el filtro de edad por su cuenta** — el motor es la
única fuente de esa regla. Ver `producto.test.js`, sección "adaptador
de Maternidad", para la prueba que protege este comportamiento.

## Entradas y salidas

Ver comentarios JSDoc en `index.js` para cada función. Todas las
funciones de precio retornan `{ valor, dcto, mensual, rango }` o
`null` cuando no hay datos suficientes — **nunca inventan un valor**.

## Dependencias permitidas

- `business-config` (`constants.js`, `pricing.js`) vía `window.BusinessConfig`.

## Dependencias prohibidas

- MotorPago, MotorValidación, MotorCliente — ver tabla de dependencias
  del Documento de Arquitectura, Sección 3.
- DOM, Firestore.

## Estado de integración

**v1.0.0 es una implementación aislada.** No se integró en crm.html ni
cotizar.html todavía — eso ocurre consumidor por consumidor, después
del Gate Review de pruebas, por instrucción explícita del CEO.

## Pruebas

Ver `producto.test.js`. Ejecutar con:

```
node src/business-core/motors/producto/producto.test.js
```
