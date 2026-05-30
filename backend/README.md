# PPTMaps — Backend API

> **Plataforma unificada de movilidad inteligente para el Valle de Aburrá (Medellín)**
> FastAPI · PostgreSQL + PostGIS · Redis · Celery · WebSockets
> Proyecto para el **Hackatón HackData CTGI SENA 2026**

PPTMaps ingiere telemetría vehicular en tiempo real, alerta sobre inundación de
deprimidos viales (datos SIATA), detecta zonas de accidentalidad con clustering
espacial y calcula rutas que **esquivan las zonas de riesgo activas**.

---

## 🏛️ Arquitectura

El backend sigue una **arquitectura hexagonal** (puertos y adaptadores) en los puntos
donde importa el desacople, y **CQRS** para la ingesta de alta concurrencia.

```
app/
├── api/            # Capa HTTP: routers v1 + dependencias de auth (deps.py)
├── core/           # Configuración y seguridad (JWT, hashing)
├── crud/           # Acceso a datos (consultas PostGIS: ST_DWithin, ST_AsGeoJSON)
├── db/             # Motor async, sesión, base declarativa, cliente Redis
├── models/         # Modelos SQLAlchemy 2.0 (PostGIS via GeoAlchemy2)
├── schemas/        # Contratos Pydantic v2 (entrada/salida)
├── services/       # Lógica de dominio (SIATA hexagonal, telemetría, ruteo, alertas)
├── tasks/          # Celery: app + beat schedule + workers
├── websocket/      # Gestor de conexiones + router de telemetría en vivo
└── ml/             # Clustering espacial DBSCAN (zonas calientes)
```

### Decisiones de diseño destacadas

- **CQRS en telemetría**: los dispositivos GPS emiten miles de pings; escribir directo
  a Postgres no escala. El endpoint **encola en Redis** (respuesta inmediata `202`) y un
  **worker Celery drena el buffer a Postgres en lotes**. Separa el camino de escritura
  rápida del de persistencia.
- **Ingesta SIATA hexagonal**: el servicio depende de la interfaz `SiataGaugeClient`, no
  de una fuente concreta. Hoy un adaptador seed con estaciones reales; mañana un cliente
  HTTP, sin tocar el dominio.
- **Clustering en la base de datos**: `ST_ClusterDBSCAN` (PostGIS nativo) en vez de
  traer los puntos a Python con scikit-learn. El cómputo espacial vive donde están los datos.

---

## 🧰 Stack

| Capa | Tecnología |
|------|-----------|
| API | FastAPI 0.111 (async) |
| Base de datos | PostgreSQL 16 + **PostGIS 3.4** |
| ORM / geo | SQLAlchemy 2.0 + GeoAlchemy2 |
| Migraciones | Alembic |
| Cola / cache | Redis 7 |
| Tareas async | Celery 5 (worker + beat) |
| Tiempo real | WebSockets (Starlette) |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| Tests | pytest + pytest-asyncio sobre PostGIS real |

---

## 🔌 API

Base: `/api/v1`

| Recurso | Endpoints |
|---------|-----------|
| **Auth** | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| **Vehículos** | CRUD `/vehicles` (roles: admin/authority) |
| **Telemetría** | `POST /telemetry` (CQRS, protegido por API key) |
| **Reportes** | `/reports` (incidentes ciudadanos) |
| **Zonas de accidentalidad** | `/accident-zones` (+ búsqueda por proximidad `ST_DWithin`) |
| **Riesgos de inundación** | `/flood-hazards` |
| **Rutas** | `GET /routes?destination=lat,lng` (ruteo resiliente) |
| **Público (mapa)** | `/public/telemetry/latest`, `/public/alerts`, `/public/accidents/geojson`, `/public/fatalities`, `/public/flood-zones` |
| **Tiempo real** | `WS /ws/telemetry?channel=global` |

Documentación interactiva: `http://localhost:8000/docs`

### Tiempo real (WebSocket)

`/ws/telemetry` emite la última posición de cada vehículo y las alertas activas:
```json
{ "type": "telemetry", "data": [{ "vehicle_id": "...", "lat": 6.25, "lng": -75.56, "speed": 42, "heading": 180 }] }
{ "type": "alerts",     "data": [{ "type": "siata", "severity": "CRITICAL", "message": "..." }] }
```

### Ruteo resiliente

`GET /routes` traza una ruta origen→destino y, si cruza una **zona de riesgo activa**
(inundación `watch`/`flooded` o zona de accidentalidad severa), inserta un waypoint que
la rodea. Devuelve `{ coordinates, distance_km, avoided_zones }`.

### Inteligencia (DBSCAN)

`ST_ClusterDBSCAN` agrupa los reportes de accidente por densidad espacial y genera
**zonas calientes** (`accident_zones`) con su conteo de incidentes. Corre como tarea
Celery periódica.

---

## 🔐 Seguridad

- **Usuarios**: JWT (OAuth2 password flow) con roles `citizen` / `authority` / `admin`;
  contraseñas con bcrypt. Dependencias `get_current_active_user` y `require_role`.
- **Dispositivos GPS**: la ingesta de telemetría se protege con **API key** (`X-API-Key`),
  no con JWT — los dispositivos son máquinas, no usuarios. Comparación de tiempo constante.

---

## ⚙️ Tareas en segundo plano (Celery beat)

| Tarea | Frecuencia | Función |
|-------|-----------|---------|
| `telemetry.flush` | 1 min | drena el buffer Redis → Postgres (CQRS) |
| `siata.sync_flood_hazards` | 15 min | sincroniza niveles SIATA → `flood_hazards` |
| `overspeed.check` | 1 min | genera alertas por exceso de velocidad |
| `ml.cluster_accident_hotspots` | 1 h | reclustriza accidentes (DBSCAN) |

---

## 🚀 Cómo correr

### Con Docker (recomendado)

```bash
cd backend
docker compose up --build
```

Levanta PostGIS, Redis, la API (aplica migraciones automáticamente), el worker y el beat.
API en `http://localhost:8000/docs`.

### Local (desarrollo)

```bash
cd backend
python3.11 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Requiere PostgreSQL+PostGIS y Redis accesibles (ver .env.example)
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

---

## 🧪 Tests

**63 pruebas** sobre **PostGIS real** (no SQLite): auth, telemetría CQRS, WebSocket,
ruteo, clustering, endpoints públicos y CRUD geoespacial.

```bash
cd backend
docker compose -f docker-compose.test.yml up -d   # PostGIS + Redis de prueba
source venv/bin/activate
export TEST_DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5433/movimed_test"
pytest -q
```

---

## 🌐 Origen de los datos (Open Data Medellín)

- **SIATA** — niveles del Río Medellín y quebradas → `flood_hazards`.
- **MEData** — incidentes viales y malla vial → `accident_zones`.
- **Reportes ciudadanos** — alimentados en tiempo real por los usuarios.

PostGIS cachea y optimiza estos datos para responder rápido al frontend sin saturar las
APIs oficiales.

---
*Desarrollado para el Hackatón HackData CTGI SENA 2026.*
