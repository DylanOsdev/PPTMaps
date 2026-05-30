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
    """Reclustriza los accidentes y reemplaza las zonas generadas. Devuelve cuántas creó."""
    await db.execute(
        text("DELETE FROM accident_zones WHERE name LIKE :p"), {"p": f"{HOTSPOT_PREFIX}%"}
    )

    # Los parámetros numéricos se interpolan como literales: son valores numéricos
    # (float/int) ya tipados por la firma, no entrada de texto, y el operador `=>` de
    # ST_ClusterDBSCAN choca con el binding de named params de SQLAlchemy.
    srid = int(METRIC_SRID)
    eps = float(eps_meters)
    minpts = int(min_samples)
    buf = float(ZONE_BUFFER_M)

    result = await db.execute(
        text(
            f"""
            WITH clustered AS (
                SELECT
                    geom,
                    ST_ClusterDBSCAN(ST_Transform(geom, {srid}), eps => {eps}, minpoints => {minpts})
                        OVER () AS cid
                FROM reports
                WHERE report_type = 'accident'
            ),
            zones AS (
                SELECT
                    cid,
                    COUNT(*) AS n,
                    ST_Multi(
                        ST_Buffer(ST_ConvexHull(ST_Collect(geom))::geography, {buf})::geometry
                    ) AS zgeom
                FROM clustered
                WHERE cid IS NOT NULL
                GROUP BY cid
            )
            INSERT INTO accident_zones (name, severity, incident_count, geom)
            SELECT :prefix || ' ' || cid, LEAST(5, n), n, zgeom
            FROM zones
            RETURNING id
            """
        ),
        {"prefix": HOTSPOT_PREFIX},
    )
    created = len(result.fetchall())
    await db.commit()
    return created
