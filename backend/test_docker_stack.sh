#!/bin/bash
# Test end-to-end del stack Docker de PPTMaps
# Verifica que todos los servicios funcionen correctamente

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_URL="http://localhost:8000"
COMPOSE_FILE="docker-compose.pptmaps.yml"

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  PPTMAPS DOCKER STACK E2E TEST                             ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Función para verificar un test
test_passed() {
    echo -e "${GREEN}✓${NC} $1"
}

test_failed() {
    echo -e "${RED}✗${NC} $1"
    exit 1
}

test_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

echo -e "${CYAN}[1/10]${NC} Verificando contenedores..."
CONTAINERS=$(docker-compose -f $COMPOSE_FILE ps --services --filter "status=running" | wc -l)
if [ "$CONTAINERS" -eq 5 ]; then
    test_passed "5/5 contenedores corriendo (db, redis, api, worker, beat)"
else
    test_failed "Solo $CONTAINERS/5 contenedores corriendo"
fi

echo -e "${CYAN}[2/10]${NC} Verificando PostgreSQL + PostGIS..."
DB_CHECK=$(docker-compose -f $COMPOSE_FILE exec -T db psql -U postgres -d movimed -c "SELECT PostGIS_Version();" 2>&1 | grep -i "postgis\|geos" | wc -l)
if [ "$DB_CHECK" -gt 0 ]; then
    test_passed "PostgreSQL + PostGIS funcionando"
else
    test_failed "PostgreSQL o PostGIS no responde"
fi

echo -e "${CYAN}[3/10]${NC} Verificando Redis..."
REDIS_CHECK=$(docker-compose -f $COMPOSE_FILE exec -T redis redis-cli PING 2>&1)
if [ "$REDIS_CHECK" = "PONG" ]; then
    test_passed "Redis respondiendo"
else
    test_failed "Redis no responde"
fi

echo -e "${CYAN}[4/10]${NC} Verificando API health..."
API_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" $API_URL/health)
if [ "$API_HEALTH" -eq 200 ]; then
    test_passed "API health check OK (200)"
else
    test_failed "API health check falló (HTTP $API_HEALTH)"
fi

echo -e "${CYAN}[5/10]${NC} Verificando API database health..."
DB_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" $API_URL/health/db)
if [ "$DB_HEALTH" -eq 200 ]; then
    test_passed "API database health OK (200)"
else
    test_failed "API database health falló (HTTP $DB_HEALTH)"
fi

echo -e "${CYAN}[6/10]${NC} Verificando datos de accidentalidad..."
ACCIDENTS_COUNT=$(docker-compose -f $COMPOSE_FILE exec -T db psql -U postgres -d movimed -t -c "SELECT COUNT(*) FROM accident_incidents;" 2>&1 | tr -d ' ')
if [ "$ACCIDENTS_COUNT" -eq 702540 ]; then
    test_passed "702,540 incidentes cargados en accident_incidents"
elif [ "$ACCIDENTS_COUNT" -gt 0 ]; then
    test_warning "$ACCIDENTS_COUNT incidentes cargados (esperados 702,540)"
else
    test_failed "No hay datos en accident_incidents"
fi

echo -e "${CYAN}[7/10]${NC} Verificando endpoint de estadísticas..."
STATS_RESPONSE=$(curl -s $API_URL/api/v1/public/accidents/stats)
STATS_TOTAL=$(echo $STATS_RESPONSE | grep -o '"total":[0-9]*' | grep -o '[0-9]*' || echo "0")
if [ "$STATS_TOTAL" -gt 0 ]; then
    test_passed "Endpoint /accidents/stats respondiendo (total: $STATS_TOTAL)"
else
    test_failed "Endpoint /accidents/stats no devuelve datos"
fi

echo -e "${CYAN}[8/10]${NC} Verificando frontend (dist)..."
FRONTEND_CHECK=$(curl -s -o /dev/null -w "%{http_code}" $API_URL/)
if [ "$FRONTEND_CHECK" -eq 200 ]; then
    test_passed "Frontend servido en / (200)"
else
    test_failed "Frontend no accesible (HTTP $FRONTEND_CHECK)"
fi

echo -e "${CYAN}[9/10]${NC} Verificando dashboard..."
DASHBOARD_CHECK=$(curl -s $API_URL/dashboard | grep -c "PPTMAPS" || true)
if [ "$DASHBOARD_CHECK" -gt 0 ]; then
    test_passed "Dashboard accesible en /dashboard"
else
    test_failed "Dashboard no accesible"
fi

echo -e "${CYAN}[10/10]${NC} Verificando Celery worker..."
WORKER_LOG=$(docker-compose -f $COMPOSE_FILE logs --tail=20 worker 2>&1 | grep -c "celery@.*ready" || true)
if [ "$WORKER_LOG" -gt 0 ]; then
    test_passed "Celery worker activo y listo"
else
    test_warning "Celery worker sin logs de 'ready' recientes"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ TODOS LOS TESTS PASARON                                 ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Stack completo verificado:${NC}"
echo -e "  • API:       ${GREEN}$API_URL${NC}"
echo -e "  • Dashboard: ${GREEN}$API_URL/dashboard${NC}"
echo -e "  • Docs:      ${GREEN}$API_URL/docs${NC}"
echo -e "  • DB:        ${GREEN}localhost:5433${NC}"
echo -e "  • Redis:     ${GREEN}localhost:6380${NC}"
echo ""
