/* E2 · Comparación en modo sombra, local y sin escrituras.
   Uso (desde la raíz del repositorio):  node scripts/comparar_sombra.js export_sombra.json
   Genera reporte_sombra.json junto al archivo de exportación. */
const fs = require('fs');
const path = require('path');
const REPO = process.env.SS_REPO || path.join(__dirname, '..');
global.window = globalThis;
window.BusinessConfig = {};
for (const f of ['constants', 'commissions', 'pricing']) require(path.join(REPO, 'business-config', f + '.js'));
require(path.join(REPO, 'src/business-core/motors/producto/index.js'));
require(path.join(REPO, 'src/business-core/motors/pago/index.js'));
for (const f of ['resolver-edad', 'comision-asegurados', 'tarifa-resolver', 'periodo-importada', 'pago-validador', 'reversion-calc', 'sombra']) {
  require(path.join(REPO, 'src/business-core/motors/pago', f + '.js'));
}
const archivo = process.argv[2];
if (!archivo) { console.error('Uso: node scripts/comparar_sombra.js export_sombra.json'); process.exit(1); }
const exp = JSON.parse(fs.readFileSync(archivo, 'utf8'));
const filas = (exp.ventas || []).flatMap(v => globalThis.MotorPagoE2.evaluarVenta(v));
const resumen = globalThis.MotorPagoE2.resumir(filas);
const salida = path.join(path.dirname(archivo), 'reporte_sombra.json');
fs.writeFileSync(salida, JSON.stringify({ generado: new Date().toISOString(), resumen, filas }, null, 2));
console.log(JSON.stringify({
  total: resumen.total, COINCIDE: resumen.COINCIDE, NO_EVALUABLE: resumen.NO_EVALUABLE,
  porcentajeNoEvaluable: resumen.porcentajeNoEvaluable, DIFERENCIA: resumen.DIFERENCIA,
  noEvaluablePorMotivo: resumen.noEvaluablePorMotivo, criterioSinDiferenciasSinClasificar: resumen.criterioSinDiferenciasSinClasificar
}, null, 2));
console.log('Reporte: ' + salida);
