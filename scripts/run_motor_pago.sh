#!/usr/bin/env bash
# Ejecuta todas las suites del MotorPago y MotorProducto/MotorValidación.
# Uso (desde la raíz del repositorio): bash scripts/run_motor_pago.sh
# Sale con código 1 si alguna suite falla.
set -u
export TZ=America/Bogota
SUITES=(
  tests/pago_prorrateo.test.js
  tests/pago_individual.test.js
  tests/pago_h1_h2.test.js
  tests/pago_cobro_escalonado.test.js
  tests/pago_spd_2025.test.js
  tests/pago_e1.test.js
  tests/pago_e1c.test.js
  tests/pago_e1d.test.js
  tests/pago_e2.test.js
  tests/pago_spti_anio.test.js
  tests/pago_base_guardada.test.js
  tests/pago_e3_sombra.test.js
  src/business-core/motors/pago/pago.test.js
  src/business-core/motors/producto/producto.test.js
  src/business-core/motors/validacion/validacion.test.js
)
FALLO=0
TOTAL=0
for t in "${SUITES[@]}"; do
  out=$(node "$t" 2>&1); code=$?
  res=$(echo "$out" | grep -E "Resultado|pruebas pasaron" | tail -1)
  echo "$t | exit=$code | ${res:-sin resumen}"
  [ $code -ne 0 ] && FALLO=1
done
exit $FALLO
