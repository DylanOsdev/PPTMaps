"""Carga datos históricos de clima desde CSV a PostgreSQL."""
import asyncio
import sys
from pathlib import Path
import csv

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy import text
from app.db.database import async_session_maker


async def load_historical_weather(csv_path: str):
    """Carga clima_historico_medellin.csv a la tabla historical_weather_medellin."""
    
    csv_file = Path(csv_path)
    if not csv_file.exists():
        print(f"❌ Archivo no encontrado: {csv_path}")
        return False
    
    print(f"📥 Cargando datos históricos de clima desde {csv_file.name}...")
    
    async with async_session_maker() as db:
        # Verificar si ya hay datos
        result = await db.execute(text("SELECT COUNT(*) FROM historical_weather_medellin"))
        count = result.scalar()
        
        if count > 0:
            print(f"✅ Tabla ya contiene {count} registros. Saltando carga.")
            return True
        
        # Leer CSV y preparar batch insert
        records = []
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                records.append({
                    'timestamp': row['timestamp'],
                    'temperature_c': float(row['temperature_c']) if row['temperature_c'] else None,
                    'precipitation_mm': float(row['precipitation_mm']) if row['precipitation_mm'] else None,
                    'humidity': int(row['humidity']) if row['humidity'] else None
                })
        
        print(f"📊 Insertando {len(records)} registros...")
        
        # Batch insert (más rápido que uno por uno)
        await db.execute(
            text("""
                INSERT INTO historical_weather_medellin (timestamp, temperature_c, precipitation_mm, humidity)
                VALUES (:timestamp, :temperature_c, :precipitation_mm, :humidity)
                ON CONFLICT (timestamp) DO NOTHING
            """),
            records
        )
        await db.commit()
        
        print(f"✅ {len(records)} registros cargados exitosamente")
        return True


if __name__ == "__main__":
    csv_path = sys.argv[1] if len(sys.argv) > 1 else "/repo/backend/data/processed/clima_historico_medellin.csv"
    success = asyncio.run(load_historical_weather(csv_path))
    sys.exit(0 if success else 1)
