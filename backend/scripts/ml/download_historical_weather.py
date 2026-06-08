"""Script para descargar datos históricos de clima de Open-Meteo (2008-2025).

Descarga temperatura y precipitación horaria para Medellín y los guarda en la BD.
"""
import asyncio
import sys
from pathlib import Path
from datetime import datetime, timedelta
import httpx

sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import text
from app.db.database import async_session_maker


# Coordenadas de Medellín (centro)
MEDELLIN_LAT = 6.2518
MEDELLIN_LNG = -75.5636

# Open-Meteo Historical Weather API
OPEN_METEO_URL = "https://archive-api.open-meteo.com/v1/archive"


async def download_historical_weather():
    """Descarga datos históricos de clima desde 2008 hasta 2025."""
    
    print("  Descargando datos históricos de clima (Open-Meteo)...")
    print(f" Ubicación: Medellín ({MEDELLIN_LAT}, {MEDELLIN_LNG})")
    
    # Rango de fechas de los accidentes
    start_date = "2008-01-01"
    end_date = "2025-12-31"
    
    print(f" Rango: {start_date} a {end_date}")
    
    # Parámetros de la API
    params = {
        "latitude": MEDELLIN_LAT,
        "longitude": MEDELLIN_LNG,
        "start_date": start_date,
        "end_date": end_date,
        "hourly": "temperature_2m,precipitation,relative_humidity_2m",
        "timezone": "America/Bogota"
    }
    
    print("\n Descargando desde Open-Meteo (esto puede tardar 1-2 minutos)...")
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.get(OPEN_METEO_URL, params=params)
        response.raise_for_status()
        data = response.json()
    
    # Extraer datos horarios
    hourly = data.get("hourly", {})
    timestamps = hourly.get("time", [])
    temperatures = hourly.get("temperature_2m", [])
    precipitations = hourly.get("precipitation", [])
    humidities = hourly.get("relative_humidity_2m", [])
    
    print(f"✅ Descargados {len(timestamps):,} registros horarios")
    
    # Crear tabla si no existe
    async with async_session_maker() as db:
        await db.execute(text("""
            CREATE TABLE IF NOT EXISTS historical_weather_medellin (
                timestamp TIMESTAMP PRIMARY KEY,
                temperature_c FLOAT,
                precipitation_mm FLOAT,
                humidity_percent FLOAT
            )
        """))
        await db.commit()
        
        print("\n Insertando datos en la base de datos...")
        
        # Insertar en lotes de 1000
        batch_size = 1000
        total_inserted = 0
        
        for i in range(0, len(timestamps), batch_size):
            batch_timestamps = timestamps[i:i+batch_size]
            batch_temps = temperatures[i:i+batch_size]
            batch_precips = precipitations[i:i+batch_size]
            batch_hums = humidities[i:i+batch_size]
            
            # Preparar valores
            values = []
            for j in range(len(batch_timestamps)):
                ts = batch_timestamps[j]
                temp = batch_temps[j] if batch_temps[j] is not None else "NULL"
                precip = batch_precips[j] if batch_precips[j] is not None else 0
                hum = batch_hums[j] if batch_hums[j] is not None else "NULL"
                
                values.append(f"('{ts}', {temp}, {precip}, {hum})")
            
            values_str = ",\n".join(values)
            
            # Insertar (ON CONFLICT para evitar duplicados)
            await db.execute(text(f"""
                INSERT INTO historical_weather_medellin 
                    (timestamp, temperature_c, precipitation_mm, humidity_percent)
                VALUES {values_str}
                ON CONFLICT (timestamp) DO NOTHING
            """))
            
            total_inserted += len(batch_timestamps)
            
            if (i // batch_size + 1) % 10 == 0:
                print(f"   Progreso: {total_inserted:,} / {len(timestamps):,} registros ({total_inserted / len(timestamps) * 100:.1f}%)")
        
        await db.commit()
        
        # Crear índice por timestamp
        await db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_historical_weather_timestamp 
            ON historical_weather_medellin(timestamp)
        """))
        await db.commit()
        
        # Verificar estadísticas
        result = await db.execute(text("""
            SELECT 
                COUNT(*) as total,
                MIN(timestamp) as fecha_inicio,
                MAX(timestamp) as fecha_fin,
                ROUND(AVG(temperature_c)::numeric, 1) as temp_promedio,
                ROUND(SUM(precipitation_mm)::numeric, 1) as lluvia_total
            FROM historical_weather_medellin
        """))
        stats = result.fetchone()
        
        print(f"\n✅ Datos históricos de clima guardados:")
        print(f"   Total registros: {stats.total:,}")
        print(f"   Rango: {stats.fecha_inicio} a {stats.fecha_fin}")
        print(f"   Temperatura promedio: {stats.temp_promedio}°C")
        print(f"   Lluvia total acumulada: {stats.lluvia_total} mm")
        
        return stats.total


if __name__ == "__main__":
    count = asyncio.run(download_historical_weather())
    print(f"\n Listo para entrenar modelo con clima histórico real ({count:,} registros)")
