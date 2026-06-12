# 1. Arquitectura del Sistema

## 1.1 Visión general

PPTMaps es un **monolito modular** construido sobre **FastAPI asíncrono**. Una sola
aplicación expone la API REST y, además, sirve el frontend compilado (`frontend/dist`)
con fallback SPA. Las tareas pesadas y periódicas se delegan a un worker **Celery**
independiente, y **Redis** actúa como broker y canal pub/sub.

```
                         FUENTES DE DATOS ABIERTAS
   ┌─────────────────┬─────────────────┬──────────────────────────┬──────────────┐
   │  Sec. Movilidad │      SIATA      │       Open-Meteo         │    WAQI      │
   │  (accidentes)   │  (niveles río)  │   (clima multipunto)     │ (calidad aire)│
   └────────┬────────┴────────┬────────┴────────────┬─────────────┴──────┬───────┘
            │ ingesta XLSX     │ sync hexagonal      │ proxy HTTP         │ proxy
            ▼                  ▼                     ▼                    ▼
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │                FastAPI (Uvicorn, async)                                        │
   │  ┌────────────┐  ┌─────────────────────┐                                     │
   │  │ API REST   │  │  Celery + Beat      │                                     │
   │  │ /api/v1    │  │  (tareas periódicas)│                                     │
   │  └─────┬──────┘  └──────────┬──────────┘                                     │
   └────────┼─────────────────────┼──────────────────────────────────────────────┘
            ▼                     ▼
   ┌──────────────────┐  ┌────────────────────┐  ┌──────────────────────┐
   │ PostgreSQL +     │  │  Redis             │  │  ML (PostGIS nativo) │
   │ PostGIS          │  │  (broker + pub/sub)│  │  DBSCAN clustering   │
   │ (geoespacial)    │  └────────────────────┘  └──────────────────────┘
   └──────────────────┘
            ▲
            │ REST
   ┌────────┴─────────────────────────────────────────────────────┐
   │   Frontend PWA (React 19 + Vite 8 + Leaflet + Chart.js)       │
   │   Landing · Mapa (CommandCenter) · Dashboard · Reportes       │
   └──────────────────────────────────────────────────────────────┘
```

## 1.2 Capas del backend

El backend sigue una separación de responsabilidades por capas (`backend/app/`):

| Capa | Directorio | Responsabilidad |
|------|-----------|-----------------|
| **API / Routers** | `api/v1/endpoints/` | Endpoints HTTP, validación de entrada |
| **Esquemas** | `schemas/` | Modelos Pydantic v2 (validación y serialización) |
| **CRUD / Repository** | `crud/` | Operaciones atómicas sobre la BD, aisladas del transporte |
| **Modelos** | `models/` | Entidades SQLAlchemy 2.0 + PostGIS (GeoAlchemy2) |
| **Servicios** | `services/` | Lógica de negocio e integraciones externas |
| **Tareas** | `tasks/` | Worker Celery + planificador Beat |
| **ML** | `ml/` | Analítica geoespacial (clustering DBSCAN) |
| **Núcleo** | `core/` | Configuración, excepciones |
| **Datos** | `db/` | Motor async, sesiones, cliente Redis |

### Routers REST (`api/v1/router.py`)

Montados bajo el prefijo `/api/v1`. **Todos los endpoints son públicos** (sin JWT, OAuth2,
API keys ni autenticación):

```
/reports              Reportes ciudadanos
/public               Endpoints públicos para el mapa y el dashboard
/public/air-quality   Calidad del aire vía WAQI
/accident-zones       Zonas de accidentalidad
/flood-hazards        Zonas de riesgo de inundación
```

> El rate limiting se aplica solo al endpoint de reportes (5 reportes/hora por IP) vía
> **slowapi**. No hay其余 autenticación ni autorización en ningún punto.

## 1.3 Servicios (`app/services/`)

| Servicio | Rol |
|----------|-----|
| `ingestion.py` | Siembra de accidentes/zonas de inundación (con fallback de datos demo) |
| `siata_sync.py` | Sincronización SIATA → `flood_hazards` (arquitectura hexagonal) |
| `weather.py` | Clima multipunto y pronóstico desde Open-Meteo (hexagonal) |
| `routing.py` | Ruteo resiliente que esquiva zonas de riesgo activas |
| `notification.py` | Creación y broadcast de alertas |
| `alert_broadcaster.py` | Puente Redis pub/sub → (reservado para WebSocket futuro) |
| `zones_seed.py` | Importa comunas/municipios (GeoJSON) a PostGIS |
| `air_quality_sync.py` | Sincronización de calidad del aire vía WAQI (hexagonal) |
| `weather_alerts.py` | Generación automática de alertas meteorológicas |
| `weather_event_sync.py` | Sincronización de eventos climáticos desde SIATA |

## 1.4 Capa asíncrona (Celery)

`tasks/celery_app.py` define el worker `movimed_worker` (broker y backend en Redis) y el
planificador **Beat** con cinco tareas periódicas. La lógica de negocio vive en módulos
`async` testeables; los tasks de Celery son envoltorios finos que abren una sesión y
ejecutan el core con `asyncio.run(...)`.

## 1.5 Frontend

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

## 1.6 Despliegue como unidad única

En `main.py`, tras montar la API, si existe `frontend/dist/index.html` se monta `/assets`
como estáticos y se registra un **fallback SPA** (`/{full_path:path}`) que:

1. Devuelve 404 real para prefijos de infraestructura (`api/`, `health`, `docs`, `redoc`,
   `openapi.json`) para no enmascararlos.
2. Sirve el archivo si existe en `dist`.
3. Si no, devuelve `index.html` (para que funcionen los deep-links del router).

---
