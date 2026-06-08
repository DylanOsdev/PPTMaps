"""Script para preparar dataset de training del modelo de predicción de tráfico.

Extrae features de 702k accidentes históricos + datos actuales de clima, SIATA, etc.
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import text
from app.db.database import async_session_maker


async def prepare_dataset():
    """Prepara dataset combinando accidentes históricos con features contextuales."""
    
    print(" Preparando dataset de training...")
    
    async with async_session_maker() as db:
        # Drop table si existe
        await db.execute(text("DROP TABLE IF EXISTS traffic_predictions_training CASCADE"))
        await db.commit()
        
        # Crear features agregados por hora + día + comuna + clima REAL histórico + temporales
        query = text("""
            CREATE TABLE traffic_predictions_training AS
            WITH accident_features AS (
                SELECT 
                    ai.id,
                    -- incident_hour está en formato HH:MM:SS, extraer solo la hora
                    CAST(SUBSTRING(ai.incident_hour FROM 1 FOR 2) AS INTEGER) AS hora,
                    EXTRACT(DOW FROM ai.incident_date)::int AS dia_semana,
                    EXTRACT(MONTH FROM ai.incident_date)::int AS mes,
                    ai.comuna,
                    ST_Y(ai.geom) AS lat,
                    ST_X(ai.geom) AS lng,
                    -- Gravedad (MUERTO=3, HERIDO=2, SOLO_DANOS=1)
                    CASE 
                        WHEN UPPER(ai.severity) LIKE '%MUERTO%' THEN 3
                        WHEN UPPER(ai.severity) LIKE '%HERIDO%' THEN 2
                        ELSE 1
                    END AS gravedad_individual,
                    -- Timestamp completo para JOIN con clima
                    (ai.incident_date + ai.incident_hour::time) AS timestamp_accidente
                FROM accident_incidents ai
                WHERE 
                    ai.incident_date IS NOT NULL 
                    AND ai.incident_hour IS NOT NULL
                    AND ai.comuna IS NOT NULL
                    AND ai.geom IS NOT NULL
                    AND ai.incident_date >= '2008-01-01'
                    AND ai.incident_date < '2026-01-01'
            ),
            -- JOIN con clima histórico REAL
            accident_with_weather AS (
                SELECT 
                    af.*,
                    hw.temperature_c,
                    hw.precipitation_mm,
                    hw.humidity_percent
                FROM accident_features af
                LEFT JOIN historical_weather_medellin hw
                    ON DATE_TRUNC('hour', af.timestamp_accidente) = hw.timestamp
            ),
            -- Agregar por hora + día + comuna con clima promedio
            aggregated_features AS (
                SELECT 
                    hora, dia_semana, mes, comuna,
                    COUNT(*) AS accidentes_count,
                    AVG(lat) AS lat_promedio,
                    AVG(lng) AS lng_promedio,
                    AVG(gravedad_individual) AS gravedad_promedio,
                    -- Clima REAL promedio para esta combinación hora/día/comuna
                    AVG(temperature_c) AS temp_promedio_real,
                    AVG(precipitation_mm) AS lluvia_mm_promedio_real,
                    AVG(humidity_percent) AS humedad_promedio_real
                FROM accident_with_weather
                GROUP BY hora, dia_semana, mes, comuna
                HAVING COUNT(*) >= 3
            ),
            -- Count de deprimidos (fijo)
            siata_features AS (
                SELECT COUNT(*) AS total_deprimidos
                FROM flood_hazards
            )
            SELECT 
                af.hora,
                af.dia_semana,
                af.mes,
                af.comuna,
                af.lat_promedio,
                af.lng_promedio,
                af.accidentes_count AS target_accidentes,
                af.gravedad_promedio,
                -- Features temporales
                CASE WHEN af.hora BETWEEN 6 AND 9 OR af.hora BETWEEN 17 AND 20 THEN 1 ELSE 0 END AS es_hora_pico,
                CASE WHEN af.dia_semana IN (0, 6) THEN 1 ELSE 0 END AS es_fin_semana,
                -- Features clima REALES (promedios de accidentes en estas condiciones)
                COALESCE(af.temp_promedio_real, 20.0) AS temp_promedio,
                COALESCE(af.lluvia_mm_promedio_real, 0.0) AS lluvia_mm_promedio,
                COALESCE(af.humedad_promedio_real, 75.0) AS humedad_promedio,
                -- Features SIATA (count total deprimidos)
                COALESCE(sf.total_deprimidos, 64) AS total_deprimidos,
                -- Label: riesgo de congestión (0-100)
                LEAST(100, af.accidentes_count * 5 + af.gravedad_promedio * 10)::int AS congestion_risk
            FROM aggregated_features af
            CROSS JOIN siata_features sf
            ORDER BY af.accidentes_count DESC
        """)
        
        await db.execute(query)
        await db.commit()
        
        # Crear índices
        await db.execute(text("CREATE INDEX idx_training_hora ON traffic_predictions_training(hora)"))
        await db.execute(text("CREATE INDEX idx_training_dia ON traffic_predictions_training(dia_semana)"))
        await db.execute(text("CREATE INDEX idx_training_comuna ON traffic_predictions_training(comuna)"))
        await db.commit()
        
        # Contar registros
        result = await db.execute(text("SELECT COUNT(*) FROM traffic_predictions_training"))
        count = result.scalar()
        
        print(f"✅ Dataset creado: {count:,} registros de training")
        
        # Mostrar ejemplos
        result = await db.execute(text("""
            SELECT hora, dia_semana, comuna, target_accidentes, congestion_risk
            FROM traffic_predictions_training
            ORDER BY congestion_risk DESC
            LIMIT 10
        """))
        
        print("\n📌 Top 10 escenarios de mayor riesgo:")
        print("Hora | Día  | Comuna      | Accidentes | Riesgo")
        print("-----|------|-------------|------------|-------")
        for row in result:
            hora = f"{row.hora:02d}:00"
            dia = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][row.dia_semana]
            print(f"{hora} | {dia} | {row.comuna:11s} | {row.target_accidentes:10d} | {row.congestion_risk:6d}")
        
        return count


if __name__ == "__main__":
    count = asyncio.run(prepare_dataset())
    print(f"\n Dataset listo para entrenar modelo ML con {count:,} ejemplos")
