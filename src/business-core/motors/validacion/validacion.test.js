/**
 * validacion.test.js — Pruebas de MotorValidación
 * src/business-core/motors/validacion/validacion.test.js
 *
 * Ejecutar: node src/business-core/motors/validacion/validacion.test.js
 * Sin dependencias externas.
 */
const fs = require('fs');
const path = require('path');

eval(fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8'));
const MotorValidacion = global.MotorValidacion;

let fallos = 0, total = 0;
function assertEq(label, actual, esperado) {
  total++;
  if (JSON.stringify(actual) !== JSON.stringify(esperado)) {
    console.log(`❌ FALLO: ${label}\n   obtenido: ${JSON.stringify(actual)}\n   esperado: ${JSON.stringify(esperado)}`);
    fallos++;
  } else {
    console.log(`✅ ${label}`);
  }
}

console.log('--- esElegiblePAC60VentaNueva: frontera exacta ---');
assertEq('edad 59 -> no elegible', MotorValidacion.esElegiblePAC60VentaNueva(59), false);
assertEq('edad 60 (límite inferior) -> elegible', MotorValidacion.esElegiblePAC60VentaNueva(60), true);
assertEq('edad 79 (límite superior) -> elegible', MotorValidacion.esElegiblePAC60VentaNueva(79), true);
assertEq('edad 80 -> no elegible', MotorValidacion.esElegiblePAC60VentaNueva(80), false);
assertEq('edad como string "65" -> elegible', MotorValidacion.esElegiblePAC60VentaNueva('65'), true);
assertEq('edad NaN -> true (equivalencia con !(NaN<60||NaN>79) del código legado)', MotorValidacion.esElegiblePAC60VentaNueva(NaN), true);
assertEq('edad undefined -> true (misma equivalencia)', MotorValidacion.esElegiblePAC60VentaNueva(undefined), true);

console.log('\n--- validarEdadPAC60: venta nueva (sin tipoMov, o tipoMov=NUEVO) ---');
assertEq('edad 30, sin tipoMov -> MIN', MotorValidacion.validarEdadPAC60(30), { valido: false, motivo: 'MIN' });
assertEq('edad 59, tipoMov NUEVO -> MIN', MotorValidacion.validarEdadPAC60(59, 'NUEVO'), { valido: false, motivo: 'MIN' });
assertEq('edad 60, tipoMov NUEVO -> válido', MotorValidacion.validarEdadPAC60(60, 'NUEVO'), { valido: true, motivo: null });
assertEq('edad 79, tipoMov NUEVO -> válido', MotorValidacion.validarEdadPAC60(79, 'NUEVO'), { valido: true, motivo: null });
assertEq('edad 80, tipoMov NUEVO -> MAX_NUEVA', MotorValidacion.validarEdadPAC60(80, 'NUEVO'), { valido: false, motivo: 'MAX_NUEVA' });
assertEq('edad 85, sin tipoMov -> MAX_NUEVA (se asume venta nueva)', MotorValidacion.validarEdadPAC60(85), { valido: false, motivo: 'MAX_NUEVA' });

console.log('\n--- validarEdadPAC60: uso administrativo (RENOVACION) — comportamiento a conservar ---');
assertEq('edad 85, tipoMov RENOVACION -> válido (renovación de cliente 80+)', MotorValidacion.validarEdadPAC60(85, 'RENOVACION'), { valido: true, motivo: null });
assertEq('edad 90, tipoMov RENOVACION -> válido', MotorValidacion.validarEdadPAC60(90, 'RENOVACION'), { valido: true, motivo: null });
assertEq('edad 59, tipoMov RENOVACION -> MIN igual (nunca por debajo de 60)', MotorValidacion.validarEdadPAC60(59, 'RENOVACION'), { valido: false, motivo: 'MIN' });
assertEq('edad 70, tipoMov RENOVACION -> válido', MotorValidacion.validarEdadPAC60(70, 'RENOVACION'), { valido: true, motivo: null });

console.log('\n--- Casos límite: dato insuficiente, nunca inventar ---');
assertEq('edad 0 -> valido null (dato insuficiente)', MotorValidacion.validarEdadPAC60(0), { valido: null, motivo: null });
assertEq('edad undefined -> valido null', MotorValidacion.validarEdadPAC60(undefined), { valido: null, motivo: null });
assertEq('edad "" -> valido null', MotorValidacion.validarEdadPAC60(''), { valido: null, motivo: null });

console.log('\n--- Equivalencia funcional: réplica de las condiciones exactas de cada uno de los 5 consumidores ---');
// 1) crm.html guardarVenta(): if (edadNum<60) alert(MIN); if (edadNum>79 && tipoMov==='NUEVO') alert(MAX)
[
  { edad: 55, tipoMov: 'NUEVO', esperadoMotivo: 'MIN' },
  { edad: 85, tipoMov: 'NUEVO', esperadoMotivo: 'MAX_NUEVA' },
  { edad: 85, tipoMov: 'RENOVACION', esperadoMotivo: null },
  { edad: 65, tipoMov: 'NUEVO', esperadoMotivo: null }
].forEach(c => {
  const r = MotorValidacion.validarEdadPAC60(c.edad, c.tipoMov);
  assertEq(`guardarVenta()/calcDatosPAC60() equivalente: edad ${c.edad} tipoMov ${c.tipoMov}`, r.motivo, c.esperadoMotivo);
});

// 3/4/5) estimador, comparador, cotizar.html — siempre contexto de venta nueva (sin tipoMov)
[
  { edad: 60, esperado: true },
  { edad: 79, esperado: true },
  { edad: 80, esperado: false },
  { edad: 59, esperado: false }
].forEach(c => {
  assertEq(`estimador/comparador/cotizar.html equivalente: edad ${c.edad}`, MotorValidacion.esElegiblePAC60VentaNueva(c.edad), c.esperado);
});

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${total - fallos}/${total} pruebas pasaron` + (fallos ? ` — ${fallos} FALLO(S)` : ''));
process.exit(fallos === 0 ? 0 : 1);
