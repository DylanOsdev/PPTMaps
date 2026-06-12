#!/bin/bash
# Test rápido de verificación de estadísticas

echo "🧪 Test: Verificación de Estadísticas de Clima"
echo "=============================================="

# 1. Verificar que el contenedor API esté corriendo
echo -n "1. Verificando contenedor API... "
if docker ps | grep -q pptmaps.*api; then
    echo "✅"
else
    echo "❌ API no está corriendo"
    exit 1
fi

# 2. Verificar tabla historical_weather_medellin
echo -n "2. Verificando tabla historical_weather_medellin... "
COUNT=$(docker exec pptmaps-api-1 python -c "
import asyncio
from app.db.database import async_session_maker
from sqlalchemy import text

async def check():
    async with async_session_maker() as db:
        result = await db.execute(text('SELECT COUNT(*) FROM historical_weather_medellin'))
        return result.scalar()

print(asyncio.run(check()))
" 2>/dev/null)

if [ "$COUNT" -gt 0 ]; then
    echo "✅ ($COUNT registros)"
else
    echo "❌ Tabla vacía o no existe"
    exit 1
fi

# 3. Verificar endpoint de estadísticas
echo -n "3. Verificando endpoint /api/v1/public/weather/stats... "
RESPONSE=$(curl -s http://localhost:8000/api/v1/public/weather/stats)

if echo "$RESPONSE" | grep -q "by_year"; then
    echo "✅"
    echo ""
    echo "📊 Respuesta del endpoint:"
    echo "$RESPONSE" | python -m json.tool | head -20
else
    echo "❌ Endpoint no responde correctamente"
    echo "Respuesta: $RESPONSE"
    exit 1
fi

echo ""
echo "✅ TODOS LOS TESTS PASARON"
echo "Las estadísticas de clima ahora funcionan correctamente."
