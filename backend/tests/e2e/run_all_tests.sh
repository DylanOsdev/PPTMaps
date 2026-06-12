#!/bin/bash
# Master test suite E2E — Backend + Frontend post-pivot

echo ""
echo "======================================================================"
echo "MASTER TEST SUITE E2E POST-PIVOT"
echo "Clima + Seguridad Ciudadana"
echo "======================================================================"

cd "$(dirname "$0")/../../.."

# Activar venv
source backend/venv/bin/activate

# Test 1: Backend API
echo ""
echo "======================================================================"
echo "EJECUTANDO: Backend API Tests"
echo "======================================================================"
python backend/tests/e2e/test_pivot_simple.py
backend_result=$?

# Test 2: Frontend
echo ""
echo "======================================================================"
echo "EJECUTANDO: Frontend Tests"
echo "======================================================================"
python backend/tests/e2e/test_frontend.py
frontend_result=$?

# Resumen
echo ""
echo "======================================================================"
echo "RESUMEN FINAL"
echo "======================================================================"

if [ $backend_result -eq 0 ]; then
    echo "✅ PASÓ — Backend API Tests (11/11)"
else
    echo "❌ FALLÓ — Backend API Tests"
fi

if [ $frontend_result -eq 0 ]; then
    echo "✅ PASÓ — Frontend Tests (6/6)"
else
    echo "❌ FALLÓ — Frontend Tests"
fi

echo ""
echo "======================================================================"
if [ $backend_result -eq 0 ] && [ $frontend_result -eq 0 ]; then
    echo "✅✅✅ TODOS LOS TESTS PASARON — SISTEMA 100% FUNCIONAL ✅✅✅"
    echo "Backend (11/11) + Frontend (6/6) = 17/17 tests OK"
    echo "======================================================================"
    echo ""
    exit 0
else
    echo "❌ ALGUNOS TESTS FALLARON — REVISAR ERRORES"
    echo "======================================================================"
    echo ""
    exit 1
fi
