/**
 * producto.test.js — Pruebas de MotorProducto
 * src/business-core/motors/producto/producto.test.js
 *
 * Ejecutar: node src/business-core/motors/producto/producto.test.js
 * Cubre la Matriz de Equivalencia (MotorProducto_Contratos_Equivalencia,
 * 22-jul-2026) más casos límite de diseño (BR-015 sin inferencia,
 * tarifaCongelada, adaptador de Maternidad).
 */
const fs = require('fs');
const path = require('path');

global.window = global;
const BC_DIR = path.join(__dirname, '..', '..', '..', '..', 'business-config');
['index.js', 'constants.js', 'commissions.js', 'pricing.js'].forEach(f => {
  eval(fs.readFileSync(path.join(BC_DIR, f), 'utf8'));
});
eval(fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8'));
const MP = global.MotorProducto;

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

console.log('--- Matriz de equivalencia: SPTI ---');
assertEq('SPTI mensual (PREFERENCIAL 0-40)', MP.calcularPrecioSPTI({ plan: 'PREFERENCIAL', edad: 30, periodicidad: 'MENSUAL' }).valor, 167076);
assertEq('SPTI anual — caso real Lorent Cavanzo Galan', MP.calcularPrecioSPTI({ plan: 'PREFERENCIAL', edad: 30, periodicidad: 'ANUAL' }).valor, 1824170);
assertEq('SPTI tarifaCongelada -> null', MP.calcularPrecioSPTI({ plan: 'PREFERENCIAL', edad: 30, periodicidad: 'ANUAL', tarifaCongelada: true }), null);

console.log('\n--- Matriz de equivalencia: PSM ---');
const psmAnual = MP.calcularPrecioPSM({ edad: 35, periodicidad: 'ANUAL' });
const psmBrutoEsperado = Math.round(256144 * 1.05 * 12);
const psmDctoEsperado = Math.round(psmBrutoEsperado * 0.0901);
assertEq('PSM solo Básico 31-40 ANUAL — valor', psmAnual.valor, psmBrutoEsperado - psmDctoEsperado);
assertEq('PSM solo Básico 31-40 ANUAL — dcto', psmAnual.dcto, psmDctoEsperado);

console.log('\n--- PSM: adaptador de Maternidad (riesgo identificado en Contratos) ---');
const psmMaternidadFueraDeRango = MP.calcularPrecioPSM({ edad: 50, maternidad: true, periodicidad: 'MENSUAL' });
const psmSinMaternidad50 = MP.calcularPrecioPSM({ edad: 50, maternidad: false, periodicidad: 'MENSUAL' });
assertEq('Maternidad=true pero edad 50 (fuera de 15-45) -> NO se suma, igual que sin marcarla', psmMaternidadFueraDeRango.valor, psmSinMaternidad50.valor);

const psmMaternidadDentroDeRango = MP.calcularPrecioPSM({ edad: 30, maternidad: true, periodicidad: 'MENSUAL' });
const psmSinMaternidad30 = MP.calcularPrecioPSM({ edad: 30, maternidad: false, periodicidad: 'MENSUAL' });
assertEq('Maternidad=true y edad 30 (dentro de 15-45) -> SÍ se suma (valor mayor)', psmMaternidadDentroDeRango.valor > psmSinMaternidad30.valor, true);

console.log('\n--- Matriz de equivalencia: PAC60 ---');
assertEq('PAC60 administrativo, 85 años -> NO null (rango 80-89 válido admin.)', MP.calcularPrecioPAC60({ edad: 85, periodicidad: 'MENSUAL', contexto: 'ADMINISTRATIVO' }) !== null, true);
assertEq('PAC60 venta nueva, 85 años -> null (no vendible como venta nueva)', MP.calcularPrecioPAC60({ edad: 85, periodicidad: 'MENSUAL', contexto: 'VENTA_NUEVA' }), null);
assertEq('PAC60 sin contexto -> null (sin inferencia silenciosa)', MP.calcularPrecioPAC60({ edad: 65, periodicidad: 'MENSUAL' }), null);
assertEq('PAC60 tarifaCongelada -> null', MP.calcularPrecioPAC60({ edad: 65, periodicidad: 'MENSUAL', contexto: 'VENTA_NUEVA', tarifaCongelada: true }), null);
assertEq('PAC60 venta nueva, 65 años, sin anexo, mensual', MP.calcularPrecioPAC60({ edad: 65, periodicidad: 'MENSUAL', contexto: 'VENTA_NUEVA', conAnexo: false }).valor, 358398);

console.log('\n--- BR-013: prima anual ---');
assertEq('SPTI anual sin IVA', MP.calcularPrimaAnual({ producto: 'SPTI', plan: 'PREFERENCIAL', periodicidad: 'MENSUAL', edad: 30 }, false), 159120 * 12);
assertEq('SPD (sin tabla): prima*12*factor', MP.calcularPrimaAnual({ producto: 'SPD', prima: 96674 }, true), Math.round(96674 * 12 * (167076 / 159120)));

console.log('\n--- Clasificación de rango: BR-015, dos funciones separadas ---');
assertEq('getRangoPAC60Administrativo(85) -> 80-89', MP.getRangoPAC60Administrativo(85), '80-89');
assertEq('getRangoPAC60VentaNueva(85) -> null', MP.getRangoPAC60VentaNueva(85), null);
assertEq('getRangoPAC60VentaNueva(65) -> 60-69', MP.getRangoPAC60VentaNueva(65), '60-69');
assertEq('getRangoPAC60Administrativo(65) -> 60-69 (coinciden en el dominio compartido)', MP.getRangoPAC60Administrativo(65), '60-69');

console.log('\n--- Modo "sumado" (varios asegurados) ---');
const psmSumado = MP.calcularPrecioPSM({ edad: 35, periodicidad: 'MENSUAL', asegurados: [{ rangoEdad: '26-30' }] });
assertEq('PSM sumado incluye al asegurado adicional', psmSumado.mensual, Math.round((256144 + 246326) * 1.05));
const pac60Sumado = MP.calcularPrecioPAC60({ edad: 65, periodicidad: 'MENSUAL', contexto: 'VENTA_NUEVA', asegurados: [{ rangoEdad: '60-69' }] });
assertEq('PAC60 sumado incluye al asegurado adicional', pac60Sumado.mensual, 358398 * 2);

console.log('\n--- Casos límite: datos insuficientes, nunca inventar ---');
assertEq('PSM edad negativa (sin rango válido) -> null', MP.calcularPrecioPSM({ edad: -5, periodicidad: 'MENSUAL' }), null);
assertEq('PSM con asegurado sin rangoEdad -> null', MP.calcularPrecioPSM({ edad: 35, periodicidad: 'MENSUAL', asegurados: [{}] }), null);
assertEq('SPTI plan inexistente -> null', MP.calcularPrecioSPTI({ plan: 'INEXISTENTE', edad: 30, periodicidad: 'MENSUAL' }), null);

console.log(`\n${fallos === 0 ? '✅' : '❌'} ${total - fallos}/${total} pruebas pasaron` + (fallos ? ` — ${fallos} FALLO(S)` : ''));
process.exit(fallos === 0 ? 0 : 1);
