#!/bin/bash
# Test completo: Accidentes + Estadísticas de Clima

echo "🧪 Test Completo: Datos en Docker"
echo "=================================="

# Verificar que el contenedor API esté corriendo
echo -n "1. Verificando contenedor API... "
if docker ps | grep -q "api"; then
    CONTAINER_NAME=$(docker ps --format "{{.Names}}" | grep api | head -1)
    echo "✅ ($CONTAINER_NAME)"
else
    echo "❌ API no está corriendo"
    echo ""
    echo "Ejecutá primero: docker-compose -f backend/docker-compose.pptmaps.yml up -d"
    exit 1
fi

# Verificar tabla accident_incidents
echo -n "2. Verificando accidentes (accident_incidents)... "
ACCIDENTS=$(docker exec "$CONTAINER_NAME" python -c "
import asyncio
from app.db.database import async_session_maker
from sqlalchemy import text

async def check():
    async with async_session_maker() as db:
        result = await db.execute(text('SELECT COUNT(*) FROM accident_incidents'))
        return result.scalar()

print(asyncio.run(check()))
" 2>/dev/null)

if [ "$ACCIDENTS" -gt 700000 ]; then
    echo "✅ ($ACCIDENTS registros)"
else
    echo "❌ Solo $ACCIDENTS registros (se esperan ~702,540)"
    exit 1
fi

# Verificar tabla historical_weather_medellin
echo -n "3. Verificando clima histórico... "
WEATHER=$(docker exec "$CONTAINER_NAME" python -c "
import asyncio
from app.db.database import async_session_maker
from sqlalchemy import text

async def check():
    async with async_session_maker() as db:
        result = await db.execute(text('SELECT COUNT(*) FROM historical_weather_medellin'))
        return result.scalar()

print(asyncio.run(check()))
" 2>/dev/null)

if [ "$WEATHER" -gt 150000 ]; then
    echo "✅ ($WEATHER registros)"
else
    echo "❌ Solo $WEATHER registros (se esperan ~157,800)"
    exit 1
fi

# Verificar endpoint de estadísticas de accidentes
echo -n "4. Endpoint /api/v1/public/accidents/stats... "
ACCIDENTS_RESPONSE=$(curl -s http://localhost:8000/api/v1/public/accidents/stats)

if echo "$ACCIDENTS_RESPONSE" | grep -q '"total"'; then
    TOTAL=$(echo "$ACCIDENTS_RESPONSE" | grep -o '"total":[0-9]*' | grep -o '[0-9]*')
    echo "✅ (total: $TOTAL)"
else
    echo "❌ No responde"
    exit 1
fi

# Verificar endpoint de estadísticas de clima
echo -n "5. Endpoint /api/v1/public/weather/stats... "
WEATHER_RESPONSE=$(curl -s http://localhost:8000/api/v1/public/weather/stats)

if echo "$WEATHER_RESPONSE" | grep -q '"by_year"'; then
    YEARS=$(echo "$WEATHER_RESPONSE" | grep -o '"year":"[0-9]*"' | wc -l)
    echo "✅ ($YEARS años de datos)"
else
    echo "❌ No responde"
    exit 1
fi

echo ""
echo "✅ TODOS LOS TESTS PASARON"
echo ""
echo "📊 Resumen:"
echo "   • Accidentes: $ACCIDENTS registros"
echo "   • Clima histórico: $WEATHER registros"
echo "   • API /accidents/stats: ✅"
echo "   • API /weather/stats: ✅"
