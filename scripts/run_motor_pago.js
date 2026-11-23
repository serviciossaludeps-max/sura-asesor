// Ejecuta todas las suites del MotorPago, MotorProducto y MotorValidación.
// Uso desde la raíz del repositorio:  node scripts/run_motor_pago.js
// Funciona en Windows, Mac y Linux (no requiere bash). Sale con código 1 si alguna suite falla.
const { spawnSync } = require('child_process');
const path = require('path');
const SUITES = [
  'tests/pago_prorrateo.test.js',
  'tests/pago_individual.test.js',
  'tests/pago_h1_h2.test.js',
  'tests/pago_cobro_escalonado.test.js',
  'tests/pago_spd_2025.test.js',
  'tests/pago_e1.test.js',
  'tests/pago_e1c.test.js',
  'tests/pago_e1d.test.js',
  'tests/pago_e2.test.js',
  'tests/pago_spti_anio.test.js',
  'tests/pago_base_guardada.test.js',
  'tests/pago_e3_sombra.test.js',
  'src/business-core/motors/pago/pago.test.js',
  'src/business-core/motors/producto/producto.test.js',
  'src/business-core/motors/validacion/validacion.test.js'
];
const RAIZ = path.join(__dirname, '..');
let fallos = 0;
for (const s of SUITES) {
  const r = spawnSync(process.execPath, [s], { cwd: RAIZ, encoding: 'utf8', env: Object.assign({}, process.env, { TZ: 'America/Bogota' }) });
  const salida = (r.stdout || '') + (r.stderr || '');
  const lineas = salida.split(/\r?\n/).filter(l => /Resultado|pruebas pasaron/.test(l));
  const resumen = lineas.length ? lineas[lineas.length - 1].trim() : 'sin resumen';
  if (r.status !== 0) fallos++;
  console.log(`${s} | exit=${r.status} | ${resumen}`);
  if (r.status !== 0) {
    // Diagnóstico: últimas líneas de la salida de la suite que falló
    const ult = salida.split(/\r?\n/).filter(l => l.trim() !== '').slice(-8);
    ult.forEach(l => console.log('    > ' + l));
    if (r.error) console.log('    > error de ejecución: ' + r.error.message);
  }
}
console.log(fallos === 0 ? '\nTODAS LAS SUITES OK' : `\n${fallos} SUITE(S) CON FALLOS`);
process.exit(fallos === 0 ? 0 : 1);
