# 1. Arquitectura del Sistema

## 1.1 Visión general

PPTMaps es un **monolito modular** construido sobre **FastAPI asíncrono**. Una sola
aplicación expone la API REST, los WebSockets y, además, sirve el frontend compilado
(`frontend/dist`) con fallback SPA. Las tareas pesadas y periódicas se delegan a un
worker **Celery** independiente, y **Redis** actúa como broker, buffer y canal pub/sub.

```·tipunto)     │
   └────────┬────────┴────────┬────────┴────────────┬─────────────┘
            │ ingesta XLSX     │ sync hexagonal      │ proxy HTTP
            ▼                  ▼                     ▼
   ┌──────────────────────────────────────────────────────────────┐
   │                FastAPI (Uvicorn, async)                        │
   │  ┌────────────┐  ┌──────────────┐  ┌─────────────────────┐    │
   │  │ API REST   │  │  WebSocket   │  │  Celery + Beat      │    │
   │  │ /api/v1    │  │ /ws/telemetry│  │  (tareas periódicas)│    │
   │  └─────┬──────┘  └──────┬───────┘  └──────────┬──────────┘    │
   └────────┼─────────────────┼───────────────────┼───────────────┘
            ▼                 ▼                     ▼
   ┌──────────────────┐  ┌────────────┐  ┌──────────────────────┐
   │ PostgreSQL +     │  │  Redis     │  │  ML (PostGIS nativo) │
   │ PostGIS          │  │ (buffer +  │  │  DBSCAN clustering   │
   │ (geoespacial)    │  │  pub/sub)  │  └──────────────────────┘
   └──────────────────┘  └────────────┘
            ▲
            │ REST + WS (mismo origen)
   ┌────────┴─────────────────────────────────────────────────────┐
   │   Frontend PWA (React 19 + Vite 8 + Leaflet + Chart.js)       │
   │   Landing · Mapa (CommandCenter) · Dashboard · Reportes       │
   └──────────────────────────────────────────────────────────────┘
```

## 1.2 Capas del backend

El backend sigue una separación de responsabilidades por capas (`backend/app/`):

| Capa | Directorio | Responsabilidad |
|------|-----------|-----------------|
| **API / Routers** | `api/v1/endpoints/` | Endpoints HTTP, validación de entrada, dependencias |
| **Esquemas** | `schemas/` | Modelos Pydantic v2 (validación y serialización) |
| **CRUD / Repository** | `crud/` | Operaciones atómicas sobre la BD, aisladas del transporte |
| **Modelos** | `models/` | Entidades SQLAlchemy 2.0 + PostGIS (GeoAlchemy2) |
| **Servicios** | `services/` | Lógica de negocio e integraciones externas |
| **Tareas** | `tasks/` | Worker Celery + planificador Beat |
| **ML** | `ml/` | Analítica geoespacial (clustering DBSCAN) |
| **WebSocket** | `websocket/` | Streaming en tiempo real |
| **Núcleo** | `core/` | Configuración, seguridad, excepciones |
| **Datos** | `db/` | Motor async, sesiones, cliente Redis |

### Routers REST (`api/v1/router.py`)

Montados bajo el prefijo `/api/v1`:

```
/auth          Autenticación JWT (registro, login)
/users         CRUD de usuarios
/reports       Reportes ciudadanos
/vehicles      Gestión de la flota
/telemetry     Ingesta de telemetría (protegida con API key)
/public        Endpoints públicos para el mapa y el dashboard
/accident-zones  Zonas de accidentalidad
/flood-hazards   Zonas de riesgo de inundación
/routes        Cálculo de rutas resilientes
```

El **WebSocket** se monta aparte, bajo `/ws` (fuera de `/api/v1`), por contrato con el
frontend: `app.include_router(ws_router, prefix="/ws")` en `main.py`.

## 1.3 Servicios (`app/services/`)

| Servicio | Rol |
|----------|-----|
| `ingestion.py` | Siembra de accidentes/zonas de inundación (con fallback de datos demo) |
| `siata_sync.py` | Sincronización SIATA → `flood_hazards` (arquitectura hexagonal) |
| `weather.py` | Clima multipunto y pronóstico desde Open-Meteo (hexagonal) |
| `routing.py` | Ruteo resiliente que esquiva zonas de riesgo activas |
| `telemetry.py` | CQRS de telemetría (encolar en Redis / drenar a Postgres) |
| `notification.py` | Creación y broadcast de alertas |
| `alert_broadcaster.py` | Puente Redis pub/sub → WebSocket |
| `zones_seed.py` | Importa comunas/municipios (GeoJSON) a PostGIS |

## 1.4 Capa de tiempo real

- **WebSocket** (`websocket/ws_router.py`): canal `/ws/telemetry?channel=global`. Al
  conectar, envía la última posición de cada vehículo y las alertas no resueltas.
- **`ConnectionManager`** (`websocket/connection_manager.py`): **singleton** que agrupa
  conexiones por canal y difunde mensajes (`broadcast`).
- Los workers de Celery viven en un proceso distinto al servidor FastAPI, por lo que no
  pueden tocar el `ConnectionManager` directamente. Para salvar esa frontera, las alertas
  se publican en un canal **Redis pub/sub** (`alerts:live`) y un listener iniciado en el
  `lifespan` las reenvía a los clientes WebSocket.

## 1.5 Capa asíncrona (Celery)

`tasks/celery_app.py` define el worker `movimed_worker` (broker y backend en Redis) y el
planificador **Beat** con cinco tareas periódicas. La lógica de negocio vive en módulos
`async` testeables; los tasks de Celery son envoltorios finos que abren una sesión y
ejecutan el core con `asyncio.run(...)`.

## 1.6 Frontend

SPA en **React 19 + Vite 8**, enrutada con `react-router-dom` v7
(`createBrowserRouter` en `src/App.jsx`):

| Ruta | Página | Rol |
|------|--------|-----|
| `/` | `Landing.jsx` | Página de aterrizaje |
| `/map` | `CommandCenter.jsx` | Centro de comando con mapa en vivo (Leaflet) |
| `/dashboard` | `Dashboard.jsx` | Dashboard analítico (Chart.js) |
| `/report` | `Report.jsx` | Formulario de reporte ciudadano |
| `/navigate` | `Navigate.jsx` | Navegación / rutas |

El mapa **Leaflet** se carga vía CDN (unpkg) en `index.html`, no como dependencia npm.
La capa de acceso a datos vive en `src/static/js/services/api.js` (REST + WebSocket con
reconexión exponencial) y en hooks de React (`useWeather`, `useAccidentStats`).

## 1.7 Despliegue como unidad única

En `main.py`, tras montar la API y el WS, si existe `frontend/dist/index.html` se monta
`/assets` como estáticos y se registra un **fallback SPA** (`/{full_path:path}`) que:

1. Devuelve 404 real para prefijos de infraestructura (`api/`, `ws/`, `health`, `docs`,
   `redoc`, `openapi.json`) para no enmascararlos.
2. Sirve el archivo si existe en `dist`.
3. Si no, devuelve `index.html` (para que funcionen los deep-links del router).

---
