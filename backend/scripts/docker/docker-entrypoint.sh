#!/bin/bash
# Script de inicialización automática para PPTMaps
# Ejecuta migraciones y carga datos si accident_incidents está vacío

set -e

echo "⏳ Esperando PostgreSQL..."
max_attempts=30
attempt=0
until python -c "
import asyncio
from app.db.database import async_session_maker
from sqlalchemy import text
async def check():
    try:
        async with async_session_maker() as db:
            await db.execute(text('SELECT 1'))
        return True
    except:
        return False
exit(0 if asyncio.run(check()) else 1)
" 2>/dev/null; do
    attempt=$((attempt + 1))
    if [ $attempt -ge $max_attempts ]; then
        echo "❌ PostgreSQL no respondió después de $max_attempts intentos"
        exit 1
    fi
    echo "   Intento $attempt/$max_attempts..."
    sleep 2
done

echo "✅ PostgreSQL listo"
echo "🔧 Aplicando migraciones de base de datos..."
alembic upgrade head

echo "📊 Verificando datos de accidentalidad..."
COUNT=$(python -c "
import asyncio
from app.db.database import async_session_maker
from sqlalchemy import text

async def check():
    async with async_session_maker() as db:
        result = await db.execute(text('SELECT COUNT(*) FROM accident_incidents'))
        return result.scalar()

print(asyncio.run(check()))
")

if [ "$COUNT" -eq 0 ]; then
    echo "⚠️  accident_incidents vacío. Cargando dataset oficial..."
    if [ -f "/repo/backend/data/raw/Fatal_Road_Traffic.xlsx" ]; then
        echo "📥 Ingesta iniciada (702,540 registros)..."
        python -m scripts.ingest_accidents /repo/backend/data/raw/Fatal_Road_Traffic.xlsx
        echo "✅ Datos de accidentes cargados exitosamente"
    else
        echo "❌ Fatal_Road_Traffic.xlsx no encontrado. Saltando ingesta."
        echo "   Ubicación esperada: /repo/backend/data/raw/Fatal_Road_Traffic.xlsx"
    fi
else
    echo "✅ accident_incidents ya contiene $COUNT registros. Saltando ingesta."
fi

echo "🌦️  Verificando datos históricos de clima..."
WEATHER_COUNT=$(python -c "
import asyncio
from app.db.database import async_session_maker
from sqlalchemy import text

async def check():
    async with async_session_maker() as db:
        result = await db.execute(text('SELECT COUNT(*) FROM historical_weather_medellin'))
        return result.scalar()

print(asyncio.run(check()))
")

if [ "$WEATHER_COUNT" -eq 0 ]; then
    echo "⚠️  historical_weather_medellin vacío. Cargando clima histórico..."
    if [ -f "/repo/backend/data/processed/clima_historico_medellin.csv" ]; then
        echo "📥 Cargando 157,800 registros de clima (2008-2025)..."
        python scripts/setup/load_historical_weather.py /repo/backend/data/processed/clima_historico_medellin.csv
        echo "✅ Clima histórico cargado exitosamente"
    else
        echo "⚠️  clima_historico_medellin.csv no encontrado. Las estadísticas de clima no estarán disponibles."
    fi
else
    echo "✅ historical_weather_medellin ya contiene $WEATHER_COUNT registros. Saltando carga."
fi

echo "🚀 Iniciando API..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
