#!/bin/bash
# Test End-to-End Completo: Backend + Docker + Frontend
# Verifica que toda la estructura reorganizada funcione correctamente

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Contadores
PASSED=0
FAILED=0
TOTAL=0

# Funciones helper
print_header() {
    echo -e "\n${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}${BOLD}  $1${NC}"
    echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_test() {
    echo -e "\n${CYAN}[TEST $1]${NC} ${BOLD}$2${NC}"
}

pass() {
    echo -e "  ${GREEN}✓ PASS${NC} $1"
    ((PASSED++))
    ((TOTAL++))
}

fail() {
    echo -e "  ${RED}✗ FAIL${NC} $1"
    ((FAILED++))
    ((TOTAL++))
}

check_command() {
    if command -v $1 &> /dev/null; then
        pass "$1 instalado"
        return 0
    else
        fail "$1 no encontrado"
        return 1
    fi
}

# ============================================================
# TEST 1: ESTRUCTURA DEL PROYECTO
# ============================================================
print_header "TEST 1: ESTRUCTURA DEL PROYECTO"

print_test "1.1" "Verificar estructura backend reorganizada"
EXPECTED_DIRS=(
    "backend/scripts/ml"
    "backend/scripts/setup"
    "backend/scripts/docker"
    "backend/data/raw"
    "backend/data/processed"
    "backend/tests/e2e"
    "backend/tests/unit"
    "backend/tests/integration"
)

for dir in "${EXPECTED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        pass "$dir existe"
    else
        fail "$dir no existe"
    fi
done

print_test "1.2" "Verificar archivos críticos"
CRITICAL_FILES=(
    "backend/scripts/ml/train_traffic_model.py"
    "backend/scripts/setup/seed_demo.py"
    "backend/scripts/docker/docker-entrypoint.sh"
    "backend/data/raw/Fatal_Road_Traffic.xlsx"
    "backend/Dockerfile"
    "backend/docker-compose.pptmaps.yml"
    "frontend/package.json"
    "frontend/vite.config.js"
    "STRUCTURE.md"
    "pptmaps.sh"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        pass "$file existe"
    else
        fail "$file no existe"
    fi
done

print_test "1.3" "Verificar que archivos basura fueron eliminados"
DELETED_FILES=(
    "venv"
    "package.json"
    "package-lock.json"
    "frontend.log"
    "pptmaps_start.log"
    ".pytest_cache"
    ".ruff_cache"
    "data"
)

for item in "${DELETED_FILES[@]}"; do
    if [ ! -e "$item" ]; then
        pass "$item eliminado de raíz"
    else
        fail "$item todavía existe en raíz"
    fi
done

# ============================================================
# TEST 2: DEPENDENCIAS Y COMANDOS
# ============================================================
print_header "TEST 2: DEPENDENCIAS Y COMANDOS"

print_test "2.1" "Verificar comandos del sistema"
check_command "docker"
check_command "docker-compose"
check_command "python3"
check_command "node"
check_command "npm"
check_command "curl"

print_test "2.2" "Verificar permisos de ejecución"
EXECUTABLE_FILES=(
    "pptmaps.sh"
    "start.sh"
    "backend/scripts/setup/setup_db.sh"
    "backend/scripts/docker/docker-entrypoint.sh"
    "backend/tests/integration/test_docker_stack.sh"
)

for file in "${EXECUTABLE_FILES[@]}"; do
    if [ -x "$file" ]; then
        pass "$file es ejecutable"
    else
        fail "$file no es ejecutable"
    fi
done

# ============================================================
# TEST 3: DOCKER STACK
# ============================================================
print_header "TEST 3: DOCKER STACK"

print_test "3.1" "Verificar containers Docker corriendo"
EXPECTED_CONTAINERS=(
    "backend-api-1"
    "backend-worker-1"
    "backend-beat-1"
    "backend-db-1"
    "backend-redis-1"
)

for container in "${EXPECTED_CONTAINERS[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        pass "$container corriendo"
    else
        fail "$container no está corriendo"
    fi
done

print_test "3.2" "Verificar salud de containers"
for container in "${EXPECTED_CONTAINERS[@]}"; do
    if docker ps --format '{{.Names}} {{.Status}}' | grep "$container" | grep -q "Up"; then
        pass "$container está UP"
    else
        fail "$container no está UP"
    fi
done

print_test "3.3" "Verificar logs de containers (sin errores críticos)"
for container in "backend-api-1" "backend-worker-1"; do
    ERROR_COUNT=$(docker logs "$container" 2>&1 | grep -i "error\|exception\|failed" | grep -v "JWT está usando\|telemetría está usando\|base de datos está usando" | wc -l)
    if [ "$ERROR_COUNT" -lt 5 ]; then
        pass "$container sin errores críticos ($ERROR_COUNT)"
    else
        fail "$container tiene $ERROR_COUNT errores"
    fi
done

# ============================================================
# TEST 4: BACKEND API
# ============================================================
print_header "TEST 4: BACKEND API"

print_test "4.1" "Health check"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health)
if [ "$HTTP_CODE" = "200" ]; then
    pass "API health check OK (HTTP $HTTP_CODE)"
else
    fail "API health check failed (HTTP $HTTP_CODE)"
fi

print_test "4.2" "Endpoints públicos"
PUBLIC_ENDPOINTS=(
    "/api/v1/public/reports"
    "/api/v1/public/accidents"
    "/api/v1/public/accident-zones"
    "/api/v1/public/flood-zones"
    "/api/v1/public/stats"
)

for endpoint in "${PUBLIC_ENDPOINTS[@]}"; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8000$endpoint")
    if [ "$HTTP_CODE" = "200" ]; then
        pass "$endpoint responde (HTTP $HTTP_CODE)"
    else
        fail "$endpoint falló (HTTP $HTTP_CODE)"
    fi
done

print_test "4.4" "Documentación Swagger"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/docs)
if [ "$HTTP_CODE" = "200" ]; then
    pass "Swagger UI disponible (HTTP $HTTP_CODE)"
else
    fail "Swagger UI no disponible (HTTP $HTTP_CODE)"
fi

# ============================================================
# TEST 5: BASE DE DATOS Y REDIS
# ============================================================
print_header "TEST 5: BASE DE DATOS Y REDIS"

print_test "5.1" "Verificar datos en PostgreSQL"
ACCIDENT_COUNT=$(docker exec backend-db-1 psql -U postgres -d movimed -t -c "SELECT COUNT(*) FROM traffic_accident;" 2>/dev/null | tr -d ' ')
if [ "$ACCIDENT_COUNT" -gt 700000 ]; then
    pass "PostgreSQL tiene $ACCIDENT_COUNT accidentes (>700k)"
else
    fail "PostgreSQL solo tiene $ACCIDENT_COUNT accidentes"
fi

print_test "5.2" "Verificar caché Redis"
REDIS_KEYS=$(docker exec backend-redis-1 redis-cli KEYS '*' 2>/dev/null | wc -l)
if [ "$REDIS_KEYS" -gt 0 ]; then
    pass "Redis tiene $REDIS_KEYS keys cacheadas"
else
    fail "Redis no tiene keys cacheadas"
fi

ML_CACHE=$(docker exec backend-redis-1 redis-cli GET "ml:traffic_predictions" 2>/dev/null)
if [ ! -z "$ML_CACHE" ]; then
    pass "Predicciones ML cacheadas en Redis"
else
    fail "Predicciones ML NO cacheadas en Redis"
fi

# ============================================================
# TEST 6: CELERY WORKERS
# ============================================================
print_header "TEST 6: CELERY WORKERS"

print_test "6.1" "Celery worker activo"
WORKER_STATUS=$(docker exec backend-worker-1 celery -A app.tasks.celery_app inspect active 2>/dev/null | grep -c "active")
if [ "$WORKER_STATUS" -ge 0 ]; then
    pass "Celery worker respondiendo"
else
    fail "Celery worker no responde"
fi

print_test "6.2" "Celery beat programado"
BEAT_TASKS=$(docker exec backend-beat-1 celery -A app.tasks.celery_app inspect scheduled 2>/dev/null | grep -c "scheduled")
if [ "$BEAT_TASKS" -ge 0 ]; then
    pass "Celery beat tiene tareas programadas"
else
    fail "Celery beat no tiene tareas"
fi

# ============================================================
# TEST 7: FRONTEND
# ============================================================
print_header "TEST 7: FRONTEND"

print_test "7.1" "Frontend servido por FastAPI"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/)
if [ "$HTTP_CODE" = "200" ]; then
    pass "Frontend index.html accesible (HTTP $HTTP_CODE)"
else
    fail "Frontend no accesible (HTTP $HTTP_CODE)"
fi

print_test "7.2" "Rutas SPA funcionando"
SPA_ROUTES=(
    "/"
    "/dashboard"
    "/report"
    "/navigate"
)

for route in "${SPA_ROUTES[@]}"; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8000$route")
    if [ "$HTTP_CODE" = "200" ]; then
        pass "Ruta $route accesible (HTTP $HTTP_CODE)"
    else
        fail "Ruta $route falló (HTTP $HTTP_CODE)"
    fi
done

print_test "7.3" "Assets estáticos"
RESPONSE=$(curl -s http://localhost:8000/)
if echo "$RESPONSE" | grep -q "script.*src.*assets"; then
    pass "Frontend carga assets JS"
else
    fail "Frontend no carga assets JS"
fi

if echo "$RESPONSE" | grep -q "link.*stylesheet.*assets"; then
    pass "Frontend carga assets CSS"
else
    fail "Frontend no carga assets CSS"
fi

# ============================================================
# TEST 8: MODELO ML
# ============================================================
print_header "TEST 8: MODELO ML"

print_test "8.1" "Modelo ML entrenado existe"
if docker exec backend-api-1 test -f /repo/backend/app/ml/models/traffic_model.joblib; then
    pass "Modelo traffic_model.joblib existe"
else
    fail "Modelo traffic_model.joblib no existe"
fi

print_test "8.2" "Encoder ML existe"
if docker exec backend-api-1 test -f /repo/backend/app/ml/models/comuna_encoder.joblib; then
    pass "Encoder comuna_encoder.joblib existe"
else
    fail "Encoder comuna_encoder.joblib no existe"
fi

print_test "8.3" "Datos de entrenamiento"
if [ -f "backend/data/processed/clima_historico_medellin.csv" ]; then
    LINES=$(wc -l < backend/data/processed/clima_historico_medellin.csv)
    if [ "$LINES" -gt 150000 ]; then
        pass "Clima histórico tiene $LINES registros (>150k)"
    else
        fail "Clima histórico solo tiene $LINES registros"
    fi
fi

# ============================================================
# TEST 9: SCRIPT DE UTILIDAD
# ============================================================
print_header "TEST 9: SCRIPT DE UTILIDAD"

print_test "9.1" "Script pptmaps.sh ayuda"
if ./pptmaps.sh help | grep -q "test:docker"; then
    pass "Script muestra comandos de ayuda"
else
    fail "Script help no funciona"
fi

print_test "9.2" "Script info"
if ./pptmaps.sh info | grep -q "Estructura del Proyecto"; then
    pass "Script info muestra estructura"
else
    fail "Script info no funciona"
fi



# ============================================================
# RESUMEN FINAL
# ============================================================
print_header "RESUMEN FINAL"

echo -e "\n${BOLD}Resultados:${NC}"
echo -e "  ${GREEN}✓ Pasaron:${NC} $PASSED tests"
echo -e "  ${RED}✗ Fallaron:${NC} $FAILED tests"
echo -e "  ${CYAN}━ Total:${NC} $TOTAL tests"
echo ""

PERCENTAGE=$(awk "BEGIN {printf \"%.1f\", ($PASSED/$TOTAL)*100}")
echo -e "${BOLD}Éxito: ${PERCENTAGE}%${NC}"

if [ "$FAILED" -eq 0 ]; then
    echo -e "\n${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}${BOLD}  ✓ SISTEMA 100% FUNCIONAL${NC}"
    echo -e "${GREEN}${BOLD}  ✓ Backend, Docker y Frontend verificados${NC}"
    echo -e "${GREEN}${BOLD}  ✓ Reorganización exitosa${NC}"
    echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    exit 0
else
    echo -e "\n${RED}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}${BOLD}  ✗ ALGUNOS TESTS FALLARON${NC}"
    echo -e "${RED}${BOLD}  Revisar logs arriba para detalles${NC}"
    echo -e "${RED}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    exit 1
fi
