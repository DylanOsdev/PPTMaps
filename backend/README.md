# PPTMaps — Backend

> Unified mobility platform for the Valle de Aburrá (Medellín, Colombia)
> FastAPI (async) · PostgreSQL + PostGIS · Redis · Celery · WebSockets
> Hackathon **HackData CTGI SENA 2026**

The backend ingests official mobility data (702k accident records, SIATA flood levels, Open-Meteo weather, WAQI air quality) and citizen reports, normalizes and optimizes them in **PostGIS**, and exposes everything via **REST API + WebSocket** to the PWA frontend. It also serves the compiled frontend (`frontend/dist`) with SPA fallback — everything runs as a single unit.

All endpoints are **public** (no auth). Rate limiting via slowapi (5/h per IP for citizen reports).

---

## Architecture

```
backend/app/
├── api/v1/endpoints/     # reports, public, air_quality, accident_zones, flood_hazards
├── core/                 # config (pydantic-settings), security (unused), exceptions, startup
├── crud/                 # crud_accident_zone, crud_air_quality, crud_alert, crud_flood_hazard, crud_report, crud_user
├── db/                   # database.py (async), base.py, base_class.py, redis.py
├── models/               # 11 SQLAlchemy 2.0 models + PostGIS via GeoAlchemy2
├── schemas/              # Pydantic v2 contracts
├── services/             # 11 service modules (hexagonal integrations)
├── tasks/                # celery_app.py, cron_jobs.py (no worker.py)
├── ml/                   # dbscan_clustering.py (weather event clustering via ST_ClusterDBSCAN)
├── websocket/            # connection_manager.py, ws_router.py
├── tests/                # conftest.py + test_api, test_services, test_frontend_mount, test_spa_fallback, test_startup_enqueue
└── main.py               # lifespan + routers + SPA fallback
```

---

## Stack

| Layer | Technology |
|-------|-----------|
| API | FastAPI `>=0.115` (async) · Uvicorn `>=0.34` |
| Database | PostgreSQL 16 + **PostGIS 3.4** |
| ORM / geo | SQLAlchemy 2.0 (async) + GeoAlchemy2 · driver **asyncpg** |
| Migrations | Alembic |
| Queue / cache | Redis 7 |
| Async tasks | Celery 5.4 (worker + beat) |
| Real-time | WebSockets (Redis pub/sub bridge) |
| Rate limiting | slowapi |
| Tests | pytest + pytest-asyncio + httpx |

---

## Database (12 tables)

CRS: EPSG:4326 (WGS84) on all geometries. GiST indexes on every `geom` column.

| Table | PK | Geometry | Role |
|-------|----|-----------|------|
| `users` | Integer | — | Schema only, unused |
| `reports` | Integer | POINT | Citizen reports |
| `accident_zones` | Integer | MULTIPOLYGON | DBSCAN accident hotspot clusters |
| `flood_hazards` | Integer | POLYGON | SIATA flood risk zones |
| `alerts` | UUID | — | System alerts |
| `weather_snapshots` | Integer | POINT | Open-Meteo weather per point |
| `zones` | Integer | GEOMETRY | Comunas (polygon) + municipios (point) |
| `accident_incidents` | Integer | POINT | **702,540** official incidents (2008–2025) |
| `air_quality_readings` | Integer | POINT | WAQI air quality data (unique constraint) |
| `weather_hazard_zones` | Integer | — | Weather danger zones (from DBSCAN clustering) |
| `weather_events` | Integer | POINT | Weather events (rainfall, lightning, hail, storm) |
| `historical_weather_medellin` | — | — | Historical precipitation (2008–2025, raw table) |

Dropped via migration `d85cbb436027`: `vehicles`, `telemetry`.

---

## Alembic Migrations (12 total)

```
d617cc424b41  initial (PostGIS + users, reports, accident_zones, flood_hazards)
b1a2c3d4e5f6  add vehicles
c2b3d4e5f6a7  add telemetry
d3c4e5f6a7b8  add alerts
e4d5f6a7b8c9  add weather_snapshots
f5a6b7c8d9e0  add zones
a6b7c8d9e0f1  add accident_incidents
g6h7i8j9k0l1  add historical_weather
d85cbb436027  drop vehicles, telemetry
h8i9j0k1l2m3  remove auth, make reports public
n4o5p6q7r8s9  add air_quality_readings
o6p7q8r9s0t1  add weather_hazard_zones + weather_events
```

Alembic `env.py` runs in **online async** mode and excludes PostGIS internal tables from autogenerate.

---

## API Endpoints (all public, no auth)

Swagger: `http://localhost:8000/docs`

### Router mounts
| Route | Module |
|-------|--------|
| `/reports` | CRUD citizen reports |
| `/public` | 17 geo endpoints (see below) |
| `/public/air-quality` | 4 air quality endpoints |
| `/accident-zones` | Accident hotspots |
| `/flood-hazards` | Flood risk zones |

### Public endpoints
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/public/alerts` | Active alerts |
| `GET` | `/public/accidents/geojson` | Incident GeoJSON |
| `GET` | `/public/fatalities` | Fatal incidents |
| `GET` | `/public/flood-zones` | Flood risk zones |
| `GET` | `/public/weather` | Current weather multi-point |
| `GET` | `/public/weather/forecast` | Detailed forecast (Medellín) |
| `GET` | `/public/weather/stats` | Historical rain stats (2008–2025) |
| `GET` | `/public/accidents/stats` | Aggregated accident stats |
| `GET` | `/public/rain-risk` | Rain risk next 2h |
| `GET` | `/public/comunas` | Comunas + municipios |
| `GET` | `/public/comunas/stats` | Stats per comuna |
| `GET` | `/public/reports` | Public citizen reports |
| `POST` | `/public/reports` | Create citizen report (rate-limited 5/h) |
| `GET` | `/public/accident-zones` | DBSCAN hotspots (GeoJSON) |
| `GET` | `/public/accidents/historical` | 702k incidents |
| `GET` | `/public/routes/safe-weather` | Safe route avoiding weather |
| `GET` | `/public/routes` | Alias for safe-weather |

### Air Quality
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/public/air-quality/current` | Latest per station |
| `GET` | `/public/air-quality/station/{id}` | Station history |
| `GET` | `/public/air-quality/map` | GeoJSON for map |
| `GET` | `/public/air-quality/by-comuna` | AQI grouped by comuna |

### Other
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/health/db` | Database connectivity check |
| `WS` | `/ws/telemetry` | Real-time alerts via WebSocket |

### Real-time (WebSocket)

`/ws/telemetry` sends active alerts on connect via Redis pub/sub (`alerts:live`). The lifespan background task bridges Celery-published alerts to connected WebSocket clients.

---

## Services (11 files)

| Service | Role |
|---------|------|
| `ingestion.py` | Seed incidents + flood zones (fallback to demo data) |
| `siata_sync.py` | SIATA flood levels sync (hexagonal: HTTP client + seed fallback) |
| `weather.py` | Open-Meteo multi-point + forecast (hexagonal) |
| `routing.py` | Resilient routing avoiding flood + weather hazard zones |
| `notification.py` | Create and broadcast alerts |
| `alert_broadcaster.py` | Redis pub/sub → WebSocket bridge (cross-process Celery↔FastAPI) |
| `zones_seed.py` | Import comunas GeoJSON → PostGIS |
| `air_quality_sync.py` | WAQI sync (hexagonal: HTTP + seed) |
| `weather_alerts.py` | Auto weather alerts from snapshots |
| `weather_event_sync.py` | SIATA weather events sync (hexagonal) |

Removed: `telemetry.py` (CQRS telemetry no longer exists).

---

## Architecture Patterns

- **Hexagonal (Port/Adapter)**: SIATA, WAQI, and Weather integrations depend on interfaces, not concrete sources. Each has a real HTTP adapter and a seed fallback adapter — interchangeable without touching business logic.
- **No auth**: All endpoints are public. Rate limiting via slowapi for citizen report creation (5/h per IP).
- **DB-native clustering**: `ST_ClusterDBSCAN` (PostGIS) for weather event clustering — computation lives where the data is.
- **Pub/Sub for real-time**: Celery workers publish alerts to Redis (`alerts:live`); a lifespan listener forwards them to WebSocket clients.

---

## Celery Tasks (5 active)

| Task | Frequency | Role |
|------|-----------|------|
| `siata.sync_flood_hazards` | Every 15 min | SIATA → flood_hazards |
| `weather.sync` | Every 15 min | Open-Meteo → weather_snapshots |
| `weather.generate_alerts` | Every 15 min | Auto alerts from weather data |
| `air_quality.sync` | Every hour | WAQI → air_quality_readings |
| `weather_events.sync` | Every hour (offset :30) | SIATA → weather_events |

Removed: `telemetry.flush`, `overspeed.check`, `ml.cluster_accident_hotspots`, `ml.cache_predictions`.

**Note**: `celery_app.py` still declares stale beat entries for removed tasks. Only the 5 tasks above have working handlers in `cron_jobs.py`.

---

## ML

- `ml/dbscan_clustering.py` — PostGIS `ST_ClusterDBSCAN` for weather event clustering (rainfall, lightning, hail, storm) into `weather_hazard_zones`. Uses UTM 18N (EPSG:32618) for metric distance calculations.
- XGBoost model exists as a separately trained model, not in `app/ml/`.

---

## Data Sources — Real vs Demo

| Data | Status |
|------|--------|
| Accidents (702k, dashboard) | ✅ Real — Mendeley dataset (CC BY 4.0) |
| SIATA flood levels | ✅ Real — live API (seed fallback) |
| Weather (Open-Meteo) | ✅ Real — live, no API key |
| Air Quality (WAQI) | ✅ Real — 15 stations, needs `WAQI_API_TOKEN` |
| Comunas/municipios | ✅ Real — PostGIS geometries |
| Weather events | ✅ Real — SIATA APIs |
| Citizen reports | ⚠️ User-submitted |

---

## Quick Start

### Local development

```bash
cd backend
docker compose -f docker-compose.test.yml up -d   # Postgres :5433 + Redis :6380
source venv/bin/activate
POSTGRES_DB=movimed_test alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Celery worker (optional, for periodic tasks)

```bash
celery -A app.tasks.celery_app.celery_app worker --loglevel=info
celery -A app.tasks.celery_app.celery_app beat   --loglevel=info
```

### Docker (full stack: DB + Redis + API + worker + beat)

```bash
cd backend
docker compose -f docker-compose.pptmaps.yml up -d --build
# Uses movimed DB on :5432, auto-ingests 702k incidents
```

**Caution**: `docker-compose.pptmaps.yml` uses `movimed` on port `:5432`. Your local `.env` likely points to `movimed_test` on `:5433` (via `docker-compose.test.yml`). Keep them consistent.

---

## Tests

**91 test functions** (pytest + pytest-asyncio) on **real PostGIS**:

```bash
cd backend
docker compose -f docker-compose.test.yml up -d
source venv/bin/activate
pytest -v
```

Note: Tests use `movimed_test` and leave it clean after execution. Test DB is PostGIS on port 5433, not SQLite — spatial queries (ST_DWithin, ST_MakePoint) require the real extension.

---

*Built for the HackData CTGI SENA 2026 Hackathon.*
