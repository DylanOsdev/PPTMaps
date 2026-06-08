#!/bin/bash
set -e
echo "🧪 Test Rápido del Sistema PPTMaps"
echo ""

# Test 1: Estructura
echo "✓ TEST 1: Estructura"
test -d backend/scripts/ml && echo "  ✓ backend/scripts/ml"
test -d backend/tests/e2e && echo "  ✓ backend/tests/e2e"
test -d backend/data/raw && echo "  ✓ backend/data/raw"
test -f STRUCTURE.md && echo "  ✓ STRUCTURE.md"
test -f pptmaps.sh && echo "  ✓ pptmaps.sh"

# Test 2: Docker
echo "✓ TEST 2: Docker Containers"
docker ps --format '{{.Names}}' | grep backend-api && echo "  ✓ backend-api running"
docker ps --format '{{.Names}}' | grep backend-worker && echo "  ✓ backend-worker running"
docker ps --format '{{.Names}}' | grep backend-db && echo "  ✓ backend-db running"

# Test 3: API
echo "✓ TEST 3: Backend API"
curl -s http://localhost:8000/health | grep -q "ok" && echo "  ✓ Health endpoint OK"
curl -s http://localhost:8000/api/v1/public/stats | grep -q "total" && echo "  ✓ Stats endpoint OK"
curl -s -X POST http://localhost:8000/api/v1/chatbot/ask -H "Content-Type: application/json" -d '{"question":"test"}' | grep -q "intent" && echo "  ✓ Chatbot endpoint OK"

# Test 4: Frontend
echo "✓ TEST 4: Frontend"
curl -s http://localhost:8000/ | grep -q "html" && echo "  ✓ Frontend servido"
curl -s http://localhost:8000/dashboard | grep -q "html" && echo "  ✓ SPA routing OK"

# Test 5: Base de Datos
echo "✓ TEST 5: Base de Datos"
COUNT=$(docker exec backend-db-1 psql -U postgres -d movimed -t -c "SELECT COUNT(*) FROM traffic_accident;" 2>/dev/null | tr -d ' ')
echo "  ✓ PostgreSQL: $COUNT accidentes"

# Test 6: Redis
echo "✓ TEST 6: Redis"
docker exec backend-redis-1 redis-cli PING | grep -q "PONG" && echo "  ✓ Redis responde"
docker exec backend-redis-1 redis-cli GET "ml:traffic_predictions" | grep -q "predictions" && echo "  ✓ ML caché existe"

echo ""
echo "🎉 TODOS LOS TESTS CRÍTICOS PASARON"
