/**
 * pago.test.js — Pruebas de MotorPago
 * src/business-core/motors/pago/pago.test.js
 *
 * Ejecutar: node src/business-core/motors/pago/pago.test.js
 * Sin dependencias externas (ADR-003/ADR-009: Node puro).
 *
 * Cubre:
 *  - BR-009: porcentaje de comisión plano por producto (SPTI/SPD/PAC60)
 *  - BR-016: porcentaje de comisión PSM por edad (12% / 6%), incluida
 *    la frontera exacta (50 vs 51 años)
 *  - Equivalencia funcional: los 2 puntos que YA calculaban bien en el
 *    código legado (cotizador y estimador) deben seguir dando el mismo
 *    resultado a través del motor
 *  - Corrección: los 5 puntos que calculaban PSM plano (12% fijo) deben
 *    ahora dar 6% para mayores de 50 — HALLAZGO-OP-002 cerrado
 *  - Casos límite: datos insuficientes nunca deben inventar un valor
 */
const fs = require('fs');
const path = require('path');

// ---- Arnés mínimo: cargar business-config + MotorPago en un contexto Node ----
global.window = global;
const BC_DIR = path.join(__dirname, '..', '..', '..', '..', 'business-config');
['index.js', 'constants.js', 'commissions.js', 'pricing.js'].forEach(f => {
  eval(fs.readFileSync(path.join(BC_DIR, f), 'utf8'));
});
eval(fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8'));
const MotorPago = global.MotorPago;

let fallos = 0;
let total = 0;
function assertEq(label, actual, esperado) {
  total++;
  if (JSON.stringify(actual) !== JSON.stringify(esperado)) {
    console.log(`❌ FALLO: ${label}\n   obtenido: ${JSON.stringify(actual)}\n   esperado: ${JSON.stringify(esperado)}`);
    fallos++;
  } else {
    console.log(`✅ ${label}`);
  }
}

console.log('--- BR-009: porcentaje plano por producto ---');
assertEq('SPTI', MotorPago.calcularPorcentajeComision('SPTI'), 0.07);
assertEq('SPD', MotorPago.calcularPorcentajeComision('SPD'), 0.08);
assertEq('PAC60', MotorPago.calcularPorcentajeComision('PAC60'), 0.05);

console.log('\n--- BR-016: PSM por edad (frontera exacta) ---');
assertEq('PSM edad 18', MotorPago.calcularPorcentajeComision('PSM', 18), 0.12);
assertEq('PSM edad 50 (límite inferior)', MotorPago.calcularPorcentajeComision('PSM', 50), 0.12);
assertEq('PSM edad 51 (límite superior)', MotorPago.calcularPorcentajeComision('PSM', 51), 0.06);
assertEq('PSM edad 80', MotorPago.calcularPorcentajeComision('PSM', 80), 0.06);
assertEq('PSM edad como string "45"', MotorPago.calcularPorcentajeComision('PSM', '45'), 0.12);
assertEq('PSM sin edad -> null (no inventa)', MotorPago.calcularPorcentajeComision('PSM', undefined), null);
assertEq('PSM edad 0 -> null (dato inválido)', MotorPago.calcularPorcentajeComision('PSM', 0), null);

console.log('\n--- Equivalencia: los 2 puntos que ya calculaban bien (cotizador, estimador) ---');
// crm.html L14216 (cotizador PSM) y L26284 (estimador interno) ya usaban:
// edad<=50 ? 0.12 : 0.06 — deben seguir dando exactamente lo mismo.
[18, 30, 50, 51, 65, 90].forEach(edad => {
  const esperado = edad <= 50 ? 0.12 : 0.06;
  assertEq(`Equivalencia cotizador/estimador PSM edad ${edad}`, MotorPago.calcularPorcentajeComision('PSM', edad), esperado);
});

console.log('\n--- Corrección HALLAZGO-OP-002: los 5 puntos que eran planos (12% fijo) ---');
// registrarPago(), sincronizarFechaExpDesdeCarteraSura(), importVolMasivo(),
// migración legacy y preview de pago usaban COM_PCT.PSM = 0.12 siempre.
// Con MotorPago, un asegurado PSM de 55 años ya NO debe dar 12%.
assertEq('Ex-punto plano: PSM 55 años ya no da 12% fijo', MotorPago.calcularPorcentajeComision('PSM', 55), 0.06);
assertEq('Ex-punto plano: PSM 51 años (el más cercano al límite) da 6%', MotorPago.calcularPorcentajeComision('PSM', 51), 0.06);

console.log('\n--- calcularBaseComision: SPTI por tabla, PSM/PAC60 por primaSinIVA, SPD genérico ---');
assertEq(
  'SPTI PREFERENCIAL 0-40 ANUAL usa tabla exacta',
  MotorPago.calcularBaseComision({ producto: 'SPTI', plan: 'PREFERENCIAL', periodicidad: 'ANUAL', edad: 30 }),
  1737305 // SPTI_SIN_IVA.PREFERENCIAL['0-40'].anual
);
assertEq(
  'SPTI mensual (sin periodicidad especial) usa .mensual',
  MotorPago.calcularBaseComision({ producto: 'SPTI', plan: 'CLASICO', periodicidad: 'MENSUAL', edad: 55 }),
  192544 // SPTI_SIN_IVA.CLASICO['51-59'].mensual
);
assertEq(
  'PSM usa primaSinIVA guardada',
  MotorPago.calcularBaseComision({ producto: 'PSM', primaSinIVA: 300000 }),
  300000
);
assertEq(
  'PAC60 sin primaSinIVA cae a prima/1.05',
  MotorPago.calcularBaseComision({ producto: 'PAC60', prima: 387195 }),
  Math.round(387195 / 1.05)
);

console.log('\n--- calcularComision: caso real verificado (Sprint 0, Lorent Cavanzo Galan) ---');
assertEq(
  'SPTI PREFERENCIAL 0-40 ANUAL, comisión 7%',
  MotorPago.calcularComision({ producto: 'SPTI', plan: 'PREFERENCIAL', periodicidad: 'ANUAL', edad: 30 }),
  Math.round(1737305 * 0.07)
);
assertEq(
  'PSM 55 años, base 300.000 sin IVA -> comisión al 6% (antes habría sido 12%)',
  MotorPago.calcularComision({ producto: 'PSM', primaSinIVA: 300000, edad: 55 }),
  Math.round(300000 * 0.06)
);
assertEq(
  'PSM 45 años, base 300.000 sin IVA -> comisión al 12%',
  MotorPago.calcularComision({ producto: 'PSM', primaSinIVA: 300000, edad: 45 }),
  Math.round(300000 * 0.12)
);

console.log('\n--- Casos límite: nunca inventar un valor ---');
assertEq('Venta null -> null', MotorPago.calcularComision(null), null);
assertEq('Venta sin producto -> null', MotorPago.calcularComision({}), null);
assertEq('PSM sin edad -> null (no asume 12% ni 6%)', MotorPago.calcularComision({ producto: 'PSM', primaSinIVA: 100000 }), null);

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${total - fallos}/${total} pruebas pasaron` + (fallos ? ` — ${fallos} FALLO(S)` : ''));
process.exit(fallos === 0 ? 0 : 1);
