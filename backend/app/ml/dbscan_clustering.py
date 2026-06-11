"""Clustering espacial de accidentes (DBSCAN) para detectar zonas calientes.

Decisión: se usa ST_ClusterDBSCAN nativo de PostGIS (no sklearn). El clustering
espacial es justo lo que la BD hace in-place, sin traer numpy/scipy ni mover los
puntos a Python. Los reports de accidente se agrupan por proximidad y cada cluster
genera/refresca una fila en accident_zones (polígono + incident_count).
"""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# Las zonas generadas por clustering se marcan con este prefijo para poder
# regenerarlas sin tocar zonas cargadas manualmente.
HOTSPOT_PREFIX = "Hotspot"
# SRID métrico (UTM 18N) que cubre el Valle de Aburrá: permite eps en metros.
METRIC_SRID = 32618
# Radio del buffer (m) alrededor del casco convexo del cluster.
ZONE_BUFFER_M = 100


async def cluster_accident_hotspots(
    db: AsyncSession, eps_meters: float = 200, min_samples: int = 3
) -> int:
    """Reclustriza los accidentes y reemplaza las zonas generadas. Devuelve cuántas creó.
    
    Optimización: usa grid espacial de 500m para particionar y evitar timeout O(n²)
    con 657k registros. Cada celda se clustrea independientemente.
    """
    await db.execute(
        text("DELETE FROM accident_zones WHERE name LIKE :p"), {"p": f"{HOTSPOT_PREFIX}%"}
    )

    # Los parámetros numéricos se interpolan como literales: son valores numéricos
    # (float/int) ya tipados por la firma, no entrada de texto, y el operador `=>` de
    # ST_ClusterDBSAN choca con el binding de named params de SQLAlchemy.
    srid = int(METRIC_SRID)
    eps = float(eps_meters)
    minpts = int(min_samples)
    buf = float(ZONE_BUFFER_M)
    grid_size = 500  # Grid de 500m para particionar

    result = await db.execute(
        text(
            f"""
            WITH gridded AS (
                SELECT
                    geom,
                    ST_SnapToGrid(ST_Transform(geom, {srid}), {grid_size}, {grid_size}) AS cell
                FROM accident_incidents
                WHERE geom IS NOT NULL
            ),
            clustered AS (
                SELECT
                    geom,
                    cell,
                    ST_ClusterDBSCAN(ST_Transform(geom, {srid}), eps => {eps}, minpoints => {minpts})
                        OVER (PARTITION BY cell) AS cid
                FROM gridded
            ),
            zones AS (
                SELECT
                    ROW_NUMBER() OVER () AS global_cid,
                    COUNT(*) AS n,
                    ST_Multi(
                        ST_Buffer(ST_ConvexHull(ST_Collect(geom))::geography, {buf})::geometry
                    ) AS zgeom
                FROM clustered
                WHERE cid IS NOT NULL
                GROUP BY cell, cid
            ),
            percentiles AS (
                SELECT 
                    PERCENTILE_CONT(0.2) WITHIN GROUP (ORDER BY n) AS p20,
                    PERCENTILE_CONT(0.4) WITHIN GROUP (ORDER BY n) AS p40,
                    PERCENTILE_CONT(0.6) WITHIN GROUP (ORDER BY n) AS p60,
                    PERCENTILE_CONT(0.8) WITHIN GROUP (ORDER BY n) AS p80
                FROM zones
            ),
            severity_calc AS (
                SELECT 
                    z.global_cid,
                    z.n,
                    z.zgeom,
                    CASE 
                        WHEN z.n >= p.p80 THEN 5
                        WHEN z.n >= p.p60 THEN 4
                        WHEN z.n >= p.p40 THEN 3
                        WHEN z.n >= p.p20 THEN 2
                        ELSE 1
                    END AS sev
                FROM zones z, percentiles p
            )
            INSERT INTO accident_zones (name, severity, incident_count, geom)
            SELECT :prefix || ' ' || global_cid, sev, n, zgeom
            FROM severity_calc
            RETURNING id
            """
        ),
        {"prefix": HOTSPOT_PREFIX},
    )
    created = len(result.fetchall())
    await db.commit()
    return created
