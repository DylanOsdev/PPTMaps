# PPTMaps — Backend & Base de Datos

> **Plataforma unificada de movilidad inteligente para el Valle de Aburrá (Medellín)**
> FastAPI (async) · PostgreSQL + PostGIS · Redis · Celery · WebSockets
> Hackatón **HackData CTGI SENA 2026**

El backend ingiere datos oficiales de movilidad (accidentalidad, niveles SIATA, clima
Open-Meteo) y reportes ciudadanos, los normaliza y optimiza en **PostGIS**, y los expone
vía **API REST + WebSocket** a la PWA en React. También sirve el frontend compilado
(`frontend/dist`), por lo que todo corre como una sola unidad.

> Este README fue verificado contra el código fuente. Donde algo está implementado a
> medias o sembrado para demo, se indica explícitamente.

---

## 🏛️ Arquitectura

```
backend/app/
├── api/
│   ├── deps.py            # Dependencias: JWT, API key, roles
│   └── v1/
│       ├── router.py      # Monta todos los routers bajo /api/v1
│       └── endpoints/     # auth, users, reports, vehicles, telemetry,
│                          #   public, accident_zones, flood_hazards, routes
├── core/                  # config (pydantic-settings), security (JWT/bcrypt), exceptions
├── crud/                  # Acceso a datos (Repository): user, report, vehicle, alert,
│                          #   accident_zone, flood_hazard
├── db/                    # Motor async (asyncpg), sesiones, Base declarativa, Redis
├── models/                # 10 modelos SQLAlchemy 2.0 (PostGIS via GeoAlchemy2)
├── schemas/               # Contratos Pydantic v2 (entrada/salida)
├── services/              # Lógica de dominio e integraciones externas
├── tasks/                 # Celery: celery_app, worker, cron_jobs (beat)
├── websocket/             # ConnectionManager (singleton) + ws_router
├── ml/                    # dbscan_clustering (PostGIS nativo); predict_traffic (vacío)
└── main.py                # App FastAPI + lifespan + montaje del frontend (SPA)
```

### Servicios (`app/services/`)

| Servicio | Rol |
|----------|-----|
| `ingestion.py` | Siembra accidentes/zonas (con fallback a datos demo) |
| `siata_sync.py` | SIATA → `flood_hazards` (arquitectura hexagonal) |
| `weather.py` | Clima multipunto + pronóstico Open-Meteo (hexagonal) |
| `routing.py` | Ruteo resiliente que esquiva zonas de riesgo activas |
| `telemetry.py` | CQRS: encolar pings en Redis / drenar a Postgres |
| `notification.py` | Crear y difundir alertas |
| `alert_broadcaster.py` | Puente Redis pub/sub → WebSocket (cruza procesos Celery↔FastAPI) |
| `zones_seed.py` | Importa comunas/municipios (GeoJSON) a PostGIS |

### Decisiones de diseño

- **CQRS en telemetría**: el endpoint `POST /telemetry` encola en Redis (responde `202`)
  y un worker Celery (`telemetry.flush`) drena el buffer a Postgres en lotes. Separa la
  escritura rápida de la persistencia.
- **Hexagonal en integraciones**: el dominio depende de interfaces (`SiataGaugeClient`,
  `WeatherClient`, `ForecastClient`), no de fuentes concretas. Hay adaptador HTTP real y
  adaptador *seed* de respaldo, intercambiables sin tocar la lógica.
- **Clustering en la BD**: `ST_ClusterDBSCAN` (PostGIS nativo) en vez de scikit-learn —
  el cómputo espacial vive donde están los datos.
- **Pub/Sub para tiempo real**: los workers Celery viven en otro proceso, así que
  publican alertas en Redis (`alerts:live`) y un listener en el `lifespan` las reenvía a
  los clientes WebSocket.

---

## 🧰 Stack (versiones reales)

| Capa | Tecnología |
|------|-----------|
| API | FastAPI `>=0.115` (async) · Uvicorn `>=0.34` |
| Base de datos | PostgreSQL 16 + **PostGIS 3.4** |
| ORM / geo | SQLAlchemy 2.0 (async) + GeoAlchemy2 · driver **asyncpg** |
| Migraciones | Alembic |
| Cola / cache | Redis 7 |
| Tareas async | Celery 5.4 (worker + beat) |
| Tiempo real | WebSockets |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| Tests | pytest + pytest-asyncio + httpx + fakeredis |

> El badge "FastAPI 0.111" del README raíz está desactualizado; el requisito real es
> `fastapi>=0.115.0` (`requirements.txt`).

---

## 🗄️ Base de Datos (PostGIS)

- **CRS único:** EPSG:4326 (WGS84) en todas las geometrías. Índices **GiST** en cada `geom`.
- La extensión PostGIS se crea en la primera migración (`CREATE EXTENSION IF NOT EXISTS postgis`).

### Tablas (10)

| Tabla | PK | Geometría | Rol |
|-------|----|-----------|-----|
| `users` | Integer | — | Usuarios, credenciales, rol |
| `reports` | Integer | POINT | Reportes ciudadanos |
| `accident_zones` | Integer | MULTIPOLYGON | Zonas calientes (DBSCAN) |
| `flood_hazards` | Integer | POLYGON | Zonas de inundación (SIATA) |
| `vehicles` | UUID | — | Flota (ambulancia, patrulla, bombero) |
| `telemetry` | UUID | POINT | Pings GPS de la flota |
| `alerts` | UUID | — | Alertas (tráfico, SIATA, overspeed) |
| `weather_snapshots` | Integer | POINT | Último snapshot de clima por punto |
| `zones` | Integer | GEOMETRY | Comunas (polígono) + municipios (punto) |
| `accident_incidents` | Integer | POINT | **702.540** incidentes oficiales (2008–2025) |

### Enums

`user_role` (citizen/authority/admin) · `report_type` (accident/flood/obstruction/other) ·
`flood_status` (dry/watch/flooded) · `vehiclestatus` (ACTIVE/INACTIVE/IN_MAINTENANCE/ON_MISSION) ·
`alertseverity` (INFO/WARNING/CRITICAL).

### Migraciones Alembic (en orden)

```
d617cc424b41  initial (users, reports, accident_zones, flood_hazards + PostGIS)
b1a2c3d4e5f6  vehicles
c2b3d4e5f6a7  telemetry
d3c4e5f6a7b8  alerts
e4d5f6a7b8c9  weather_snapshots
f5a6b7c8d9e0  zones
a6b7c8d9e0f1  accident_incidents  (escrita a mano)
```

`alembic/env.py` corre en modo **online async** y excluye las tablas internas de PostGIS
(`spatial_ref_sys`, tiger, topology) del autogenerate.

### ⚠️ Gotcha de la BD de demo

`run.sh` y pytest usan la **misma base `movimed_test`** (puerto 5433). Cada corrida de
`pytest` hace `drop_all` → **borra los 702k accidentes y las zonas**. Antes de una demo,
reaplicá:

```bash
POSTGRES_DB=movimed_test alembic upgrade head
POSTGRES_DB=movimed_test python -m scripts.ingest_accidents /ruta/al/dataset.xlsx
```

---

## 🔌 API

Base `/api/v1`. Swagger: `http://localhost:8000/docs`.

| Recurso | Endpoints | Auth |
|---------|-----------|------|
| **Auth** | `POST /auth/register`, `POST /auth/login` | — |
| **Usuarios** | CRUD `/users` | JWT |
| **Reportes** | CRUD `/reports` | **JWT** |
| **Vehículos** | CRUD `/vehicles` | JWT/roles |
| **Telemetría** | `POST /telemetry` | **API key** (`X-API-Key`) |
| **Rutas** | `GET /routes?destination=lat,lng` | — |
| **Zonas accid.** | `/accident-zones` (proximidad `ST_DWithin`) | JWT |
| **Inundación** | `/flood-hazards` | JWT |
| **Público (mapa/dashboard)** | `/public/comunas`, `/public/comunas/stats`, `/public/telemetry/latest`, `/public/alerts`, `/public/accidents/geojson`, `/public/accidents/stats`, `/public/fatalities`, `/public/flood-zones`, `/public/weather`, `/public/weather/forecast`, `/public/rain-risk` | — |
| **Tiempo real** | `WS /ws/telemetry?channel=global` | — |

### Tiempo real (WebSocket)

`/ws/telemetry` envía al conectar la última posición de cada vehículo y las alertas no
resueltas:

```json
{ "type": "telemetry", "data": [{ "vehicle_id": "...", "lat": 6.25, "lng": -75.56, "speed": 42, "heading": 180 }] }
{ "type": "alerts",     "data": [{ "type": "siata", "severity": "CRITICAL", "message": "..." }] }
```

### Ruteo resiliente

`GET /routes` traza origen→destino y, si cruza una zona de riesgo activa (inundación
`watch`/`flooded` o `accident_zones` con `severity ≥ 3`), inserta un waypoint que la
rodea. Devuelve `{ coordinates, distance_km, avoided_zones }`.

---

## 🔐 Seguridad

- **Usuarios**: JWT (OAuth2 password flow), roles `citizen`/`authority`/`admin`,
  contraseñas con bcrypt. Dependencias `get_current_active_user`, `require_role(...)`.
- **Dispositivos GPS**: la ingesta de telemetría usa **API key** (`X-API-Key`), validada
  con `secrets.compare_digest` (tiempo constante). No usa JWT porque son máquinas.

---

## ⚙️ Tareas periódicas (Celery beat)

| Tarea | Frecuencia | Función |
|-------|-----------|---------|
| `telemetry.flush` | 1 min | Drena buffer Redis → Postgres (CQRS) |
| `overspeed.check` | 1 min | Alertas por exceso de velocidad |
| `siata.sync_flood_hazards` | 15 min | SIATA → `flood_hazards` |
| `weather.sync` | 15 min | Open-Meteo → `weather_snapshots` |
| `ml.cluster_accident_hotspots` | 1 h | DBSCAN → `accident_zones` |

> Sin Celery corriendo, `weather_snapshots` y `accident_zones` quedan **vacías** (esas
> capas del mapa no se pueblan). El dashboard y SIATA inicial sí funcionan, porque se
> siembran en el arranque (`lifespan`).

---

## 🚀 Cómo correr

### Local (la config actual del `.env` apunta a :5433 / :6380)

```bash
cd backend
docker compose -f docker-compose.test.yml up -d   # Postgres :5433 + Redis :6380
source venv/bin/activate
POSTGRES_DB=movimed_test alembic upgrade head
./run.sh                                            # API en :8000 (sirve frontend/dist)
```

Tiempo real (opcional, en dos terminales con el venv activado):

```bash
celery -A app.tasks.celery_app.celery_app worker --loglevel=info
celery -A app.tasks.celery_app.celery_app beat   --loglevel=info
```

### Docker completo (Postgres + Redis + API + worker + beat)

```bash
cd backend
docker compose up --build       # usa la base 'movimed' en :5432; aplica migraciones solo
```

> Nota: `docker-compose.yml` usa `movimed` en `:5432`; tu `.env` local apunta a
> `movimed_test` en `:5433`. Son entornos distintos: elegí uno y sé consistente.

---

## 🧪 Tests

**87 pruebas** (pytest + pytest-asyncio) sobre **PostGIS real**: auth, telemetría CQRS,
WebSocket, ruteo, clustering DBSCAN, SIATA/clima (hexagonal), endpoints públicos, siembra
de zonas, CRUD geoespacial y montaje del frontend (SPA).

```bash
cd backend
docker compose -f docker-compose.test.yml up -d
source venv/bin/activate
pytest -q
```

> Recordá: pytest usa `movimed_test` y la deja vacía al terminar.

---

## 🌐 Origen de los datos — qué es real y qué es demo

| Dato | Estado |
|------|--------|
| **Accidentalidad** (702k, dashboard) | ✅ Real — Sec. Movilidad de Medellín (Mendeley `r6g5dfnpgh`, CC BY 4.0) |
| **SIATA** (niveles río/quebradas) | ✅ Real — API pública en vivo (con fallback seed) |
| **Clima** (Open-Meteo) | ✅ Real — proxy en vivo, sin API key |
| **Comunas/municipios** | ✅ Real — geometrías PostGIS del Valle de Aburrá |
| **Accidentes del MAPA** (`reports`) | ⚠️ Demo — 10 registros sembrados (distinto de los 702k del dashboard) |
| **Vehículos + telemetría** | ⚠️ Demo — 8 vehículos sembrados (no hay feed GPS real) |
| **Alertas** | ⚠️ Demo — 4 iniciales; las de overspeed son reales si corre Celery |

---

*Desarrollado para el Hackatón HackData CTGI SENA 2026.*
