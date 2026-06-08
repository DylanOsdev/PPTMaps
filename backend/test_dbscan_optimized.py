#!/usr/bin/env python3
"""Script de prueba para verificar DBSCAN optimizado con grid espacial."""
import asyncio
import time
from sqlalchemy import text
from app.db.database import async_session_maker
from app.ml.dbscan_clustering import cluster_accident_hotspots


async def test_clustering():
    """Ejecuta clustering y mide tiempo."""
    async with async_session_maker() as db:
        # Contar registros disponibles
        result = await db.execute(
            text("SELECT COUNT(*) FROM accident_incidents WHERE geom IS NOT NULL")
        )
        total = result.scalar()
        print(f" Registros con geometría: {total:,}")
        
        # Ejecutar clustering con timer
        print(f"\n Iniciando clustering DBSCAN con grid espacial 500m...")
        start = time.time()
        
        try:
            # eps=300 para compensar fragmentación del grid de 500m
            zones_created = await cluster_accident_hotspots(db, eps_meters=300, min_samples=5)
            elapsed = time.time() - start
            
            print(f"✅ Clustering completado en {elapsed:.2f}s")
            print(f" Zonas calientes creadas: {zones_created}")
            
            # Verificar tabla accident_zones
            result = await db.execute(
                text("SELECT COUNT(*) FROM accident_zones WHERE name LIKE 'Hotspot%'")
            )
            stored = result.scalar()
            print(f"📍 Zonas almacenadas en BD: {stored}")
            
        except Exception as e:
            elapsed = time.time() - start
            print(f"❌ Error después de {elapsed:.2f}s: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(test_clustering())
