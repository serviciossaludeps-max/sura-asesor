# CHANGELOG — MotorProducto

## v1.0.0 — 22 de julio de 2026

Primera versión. Tercer motor del Business Core (EPIC-002, Fase 1).
**Implementación aislada — sin consumidores reales integrados todavía.**

### Agregado

- `getRangoEdadSPTI(edad)`, `getRangoPSM(edad)` — clasificación de rango.
- `getRangoPAC60Administrativo(edad)` / `getRangoPAC60VentaNueva(edad)`
  — BR-015, dos funciones separadas, sin inferencia de contexto.
- `calcularPrecioSPTI()`, `calcularPrecioPSM()`, `calcularPrecioPAC60()`
  — BR-014, consolidan hasta 3 implementaciones independientes por
  producto (cotizador público, creación de venta, registro de pago).
- `calcularPrimaAnual()` — BR-013.
- `producto.test.js` — 23 pruebas: matriz de equivalencia completa
  (SPTI/PSM/PAC60), adaptador de Maternidad, BR-015 sin inferencia,
  tarifaCongelada, modo "sumado", casos límite.

### Corregido durante el desarrollo (antes de cerrar v1.0.0)

- `calcularPrecioSPTI()` inicialmente devolvía valores sin IVA (tabla
  base de business-config) en vez de con IVA (lo que realmente cobran
  los 3 consumidores) — detectado por la propia prueba de equivalencia
  contra el caso real de Lorent Cavanzo Galan, corregido antes de
  entregar.

### Decisiones de diseño registradas

- `calcularPrecioPSM()` aplica la regla de edad de Maternidad (15-45)
  siempre internamente — el consumidor de registro de pago no debe
  replicarla ni confiar en datos pre-filtrados (ver README.md).
- `calcularPrecioPAC60()` exige el parámetro `contexto` explícito — sin
  valor por defecto, sin inferencia.
- La divergencia conocida entre `getRangoEdadSPTI()` (crm.html) y
  `getRangoSPTI()` (cotizar.html) para edades inválidas/negativas
  queda documentada como no bloqueante (ambas equivalen en el dominio
  real de edades) — no se modificó, por instrucción explícita del CEO.
- `calcPrimaAnual` conserva su propio manejo de IVA opcional
  (`carteraConIVA`), distinto del resto de funciones de precio (que
  siempre devuelven con IVA) — así se comportaba el código legado, se
  preserva tal cual, no se unifica.

### Explícitamente fuera de alcance

- SPD_TARIFAS (cotizar.html) — sin duplicación real, no se centraliza.
- `calcPrimaMensualSinIVA()` (HALLAZGO-OP-003) — sin tocar.
- MotorPago — ninguna dependencia, ningún archivo modificado.

### Pendiente

- Integración consumidor por consumidor en crm.html y cotizar.html,
  autorizada solo después de este Gate Review de pruebas.
- Validación de equivalencia funcional en producción (tras integrar).
