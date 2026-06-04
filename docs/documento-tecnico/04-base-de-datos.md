# 4. Estructura de Base de Datos

## 4.1 Motor y convenciones

- **PostgreSQL + PostGIS** (extensión creada en la migración inicial:
  `CREATE EXTENSION IF NOT EXISTS postgis`).
- Acceso **asíncrono** vía `asyncpg`; motor SQLAlchemy con `pool_size=20`,
  `max_overflow=10` (`db/database.py`).
- **CRS único: EPSG:4326 (WGS84)** en todas las columnas `geom`.
- **Índices espaciales GiST** sobre cada columna geométrica.
- Modelos declarativos con la API moderna de **SQLAlchemy 2.0** (`DeclarativeBase`).

## 4.2 Tablas (10)

| Tabla | PK | Geometría | Rol |
|-------|----|-----------|-----|
| `users` | `Integer` | — | Usuarios, credenciales y rol |
| `reports` | `Integer` | `POINT` | Reportes ciudadanos georreferenciados |
| `accident_zones` | `Integer` | `MULTIPOLYGON` | Zonas calientes (clustering DBSCAN) |
| `flood_hazards` | `Integer` | `POLYGON` | Zonas de inundación (SIATA) |
| `vehicles` | `UUID` | — | Flota (ambulancias, patrullas, bomberos) |
| `telemetry` | `UUID` | `POINT` | Pings GPS de la flota |
| `alerts` | `UUID` | — | Alertas (tráfico, SIATA, overspeed) |
| `weather_snapshots` | `Integer` | `POINT` | Último snapshot de clima por punto |
| `zones` | `Integer` | `GEOMETRY` | Comunas (polígono) y municipios (punto) |
| `accident_incidents` | `Integer` | `POINT` | 702k incidentes oficiales (dataset Mendeley) |

> Convención de PK: las entidades de "dominio operativo en tiempo real"
> (`vehicles`, `telemetry`, `alerts`) usan **UUID**; el resto usa **Integer** autoincremental.

## 4.3 Detalle de columnas clave

### `users`
`id`, `email` (único, indexado), `hashed_password`, `full_name`, `role`
(`user_role`: `citizen` | `authority` | `admin`), `is_active`, `created_at`, `updated_at`.

### `reports`
`id`, `reporter_id` (FK → `users.id`, `ON DELETE SET NULL`), `report_type`
(`report_type`: `accident` | `flood` | `obstruction` | `other`), `description`,
`geom` (POINT 4326), timestamps. Índice GiST `idx_reports_geom`.

### `accident_zones`
`id`, `name`, `severity` (Integer), `incident_count`, `geom` (MULTIPOLYGON 4326).
Las generadas por clustering llevan el prefijo `Hotspot` en `name`.

### `flood_hazards`
`id`, `name`, `siata_station_id` (indexado), `status`
(`flood_status`: `dry` | `watch` | `flooded`), `water_level_m`, `geom` (POLYGON 4326).

### `vehicles`
`id` (UUID), `plate` (único), `model`, `type`, `status`
(`vehiclestatus`: `ACTIVE` | `INACTIVE` | `IN_MAINTENANCE` | `ON_MISSION`), timestamps.

### `telemetry`
`id` (UUID), `vehicle_id` (FK → `vehicles.id`, indexado), `timestamp` (indexado),
`latitude`, `longitude`, `speed`, `heading`, `location` (POINT 4326).
Índice GiST `idx_telemetry_location`.

### `alerts`
`id` (UUID), `vehicle_id` (FK opcional), `type`, `severity`
(`alertseverity`: `INFO` | `WARNING` | `CRITICAL`), `message`, `is_resolved`,
`created_at`, `resolved_at`.

### `weather_snapshots`
`id`, `location_name` (único), `geom` (POINT 4326), `temperature_c`, `humidity`,
`rain_mm`, `precipitation_prob_2h`, `weather_code`, `recorded_at`, `updated_at`.

### `zones`
`id`, `kind` (`comuna` | `municipio`), `name`, `slug`, `number` (solo comunas),
`center_lat`, `center_lng`, `color` (solo municipios), `geom` (GEOMETRY 4326 genérico,
porque comunas son polígonos y municipios son puntos).
Restricción única `uq_zones_kind_slug` sobre `(kind, slug)`.

### `accident_incidents`
`id`, `llave` (único, idempotencia de ingesta), `year` (indexado), `incident_date`,
`incident_hour`, `incident_class` (indexado), `severity` (indexado), `comuna` (indexado),
`barrio`, `geom` (POINT 4326, nullable). Índice GiST `idx_accident_incidents_geom`.

## 4.4 Tipos enumerados (PostgreSQL ENUM)

| Enum | Valores |
|------|---------|
| `user_role` | `citizen`, `authority`, `admin` |
| `report_type` | `accident`, `flood`, `obstruction`, `other` |
| `flood_status` | `dry`, `watch`, `flooded` |
| `vehiclestatus` | `ACTIVE`, `INACTIVE`, `IN_MAINTENANCE`, `ON_MISSION` |
| `alertseverity` | `INFO`, `WARNING`, `CRITICAL` |

## 4.5 Migraciones Alembic

Cadena de revisiones (en `backend/alembic/versions/`):

```
d617cc424b41  initial movimed schema   → accident_zones, flood_hazards, users, reports
                                          (+ CREATE EXTENSION postgis)
b1a2c3d4e5f6  add vehicles
c2b3d4e5f6a7  add telemetry
d3c4e5f6a7b8  add alerts
e4d5f6a7b8c9  add weather_snapshots
f5a6b7c8d9e0  add zones
a6b7c8d9e0f1  add accident_incidents    (hand-written: autogenerate falla con
                                          GeoAlchemy2 + asyncpg)
```

- `alembic/env.py` corre en **modo online async** (`async_engine_from_config` +
  `NullPool`) y excluye explícitamente las tablas gestionadas por PostGIS
  (`spatial_ref_sys`, `topology`, `layer`, esquemas tiger) para que el autogenerate no
  intente crearlas/borrarlas.
- La URL de la BD se inyecta dinámicamente desde `settings.ASYNC_DATABASE_URI`.

## 4.6 Cruce espacial (PostGIS)

El endpoint `/public/comunas/stats` ejecuta un `ST_Contains` real: cuenta, por comuna
(polígono), los accidentes (`reports`) y la última posición de cada vehículo
(`telemetry`) que caen dentro de cada zona. El clustering DBSCAN usa `ST_ClusterDBSCAN`
nativo sobre coordenadas transformadas a UTM 18N (EPSG:32618) para usar `eps` en metros.

---


