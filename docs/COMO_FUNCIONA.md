# Cómo Funciona PPTMaps

## Índice

1. [Arquitectura General](#1-arquitectura-general)
2. [Frontend — Páginas y Rutas](#2-frontend--páginas-y-rutas)
3. [Mapa Interactivo (CommandCenter)](#3-mapa-interactivo-commandcenter)
4. [Sistema de Capas](#4-sistema-de-capas)
5. [Reporte de Incidentes](#5-reporte-de-incidentes)
6. [Dashboard Analítico](#6-dashboard-analítico)
7. [Backend — API](#7-backend--api)
8. [Flujo de Datos](#8-flujo-de-datos)
9. [Sistema de Alertas en Tiempo Real](#9-sistema-de-alertas-en-tiempo-real)
10. [Modelo de Riesgo ML](#10-modelo-de-riesgo-ml)
11. [Servicios Externos](#11-servicios-externos)
12. [Despliegue](#12-despliegue)
13. [Stack Tecnológico](#13-stack-tecnológico)

---

## 1. Arquitectura General

```
┌─────────────────────────────────────────────────────────┐
│                   NAVEGADOR (SPA)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ Landing  │  │   Map    │  │  Report  │  │Dashboard│ │
│  │  /       │  │  /map    │  │ /report  │  │/dashbrd│ │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘ │
│         │            │             │             │       │
│         └──────┬─────┴──────┬──────┘             │       │
│                │            │                     │       │
│         ┌──────▼────────────▼──────┐              │       │
│         │   API Service (api.js)    │              │       │
│         │  fetch() + WebSocket      │              │       │
│         └───────────┬──────────────┘              │       │
└─────────────────────┼─────────────────────────────┘       │
                      │ HTTP / WS                           │
┌─────────────────────▼─────────────────────────────────────┐
│              FASTAPI + UVICORN (:8000)                     │
│                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐    │
│  │  API v1  │  │    ①    │  │  StaticFiles (SPA)   │    │
│  │ /api/v1/ │──│  Health  │  │  frontend/dist/*      │    │
│  └────┬─────┘  └──────────┘  └──────────────────────┘    │
│       │                                                   │
│  ┌────▼─────────────────────────────────────────────┐    │
│  │  Endpoints (public, reports, air_quality, ...)    │    │
│  └────┬─────────────────────────────────────────────┘    │
│       │                                                   │
│  ┌────▼────┐  ┌────────┐  ┌───────────────────────┐     │
│  │  CRUD   │  │Services│  │  ML (Risk Model)       │     │
│  └────┬────┘  └───┬────┘  └───────────┬───────────┘     │
│       │            │                   │                  │
│  ┌────▼────────────▼───────────────────▼────────────┐    │
│  │              PostgreSQL + PostGIS                  │    │
│  │  (accident_incidents, zones, reports, weather)     │    │
│  └───────────────────────────────────────────────────┘    │
│                                                           │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Redis   │  │   Celery     │  │  WebSocket/Alert   │  │
│  │ Cache    │  │   Workers    │  │  Broadcaster       │  │
│  │ Pub/Sub  │  │   (cron)     │  │                    │  │
│  └──────────┘  └──────────────┘  └───────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Principios de diseño

- **SPA con servidor dual**: FastAPI sirve el frontend compilado (`frontend/dist`) y la API en el mismo puerto. En desarrollo, Vite hot-reload en `:5173` con proxy a la API en `:8000`.
- **Hexagonal**: Todos los servicios externos (clima, calidad del aire, SIATA) siguen puerto/adaptador. Fallan elegantemente a datos semilla si la API real no está disponible.
- **Event-driven**: Redis Pub/Sub conecta workers de Celery con conexiones WebSocket para alertas en tiempo real.
- **Offline-first**: Cada fuente de datos externa tiene un fallback seed que permite desarrollo y demo sin conexión.

---

## 2. Frontend — Páginas y Rutas

| Ruta | Página | Carga | Propósito |
|------|--------|-------|-----------|
| `/` | `Landing.jsx` | Eager | Página de aterrizaje con animaciones GSAP, globe 3D, y 7 secciones informativas |
| `/map` | `CommandCenter.jsx` | Lazy | Interfaz principal: mapa full-screen con capas, búsqueda, alertas, clima |
| `/report` | `Report.jsx` | Lazy | Formulario para reportar incidentes ciudadanos con geolocalización |
| `/dashboard` | `Dashboard.jsx` | Lazy | Analítica con KPIs, gráficos Chart.js (accidentalidad + clima histórico) |
| `*` | — | — | Redirecciona a `/` |

### Landing (`/`)

7 secciones con scroll animado (GSAP + Lenis):

1. **HeroSection** — Globe 3D interactivo (Three.js), texto typewriter, stats en vivo, CTA con transición expansiva a `/map`
2. **SatelliteNetwork** — Visualización de red satelital
3. **WeatherSection** — Datos climáticos
4. **ReportsSection** — Explicación del sistema de reportes
5. **BackendSection** — Arquitectura backend
6. **LayersSection** — Capas del mapa
7. **FinalCTA** — Llamado final a la acción

Respeta `prefers-reduced-motion`: si el usuario lo activó, las secciones se renderizan como divs apilados normales.

---

## 3. Mapa Interactivo (CommandCenter)

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  TopBar (TPPMAPS · status · API docs · support)             │
├──────────────┬───────────────────────────┬──────────────────┤
│  Left Panel  │                           │   Right Panel    │
│  (Capas)     │       MAPA LEaFLET        │   (Herramientas) │
│              │                           │                  │
│  • Comunas   │   Full screen background  │  • Buscador      │
│  • AQI       │                           │  • ESCANEAR      │
│  • Clima     │   Tile layers:            │  • Mi ubicación  │
│  • Reportes  │   OSM ↔ Esri Satellite    │  • Briefing      │
│  • Riesgo    │                           │  • Clima         │
│              │   Layer groups superpuestos│  • AQI           │
│              │                           │  • Alertas Live  │
├──────────────┴───────────────────────────┴──────────────────┤
│  BottomBar (coords · zoom · capas · alerts · weather · loc) │
├─────────────────────────────────────────────────────────────┤
│  Ticker (noticias en tiempo real)                           │
└─────────────────────────────────────────────────────────────┘
```

### Inicialización del mapa

1. **`initMap()`** — Crea mapa Leaflet centrado en el Valle de Aburrá (6.25, -75.55), zoom 11, tiles OSM con fallback a Esri Satellite.
2. **`setupMapLayers()`** — Carga comunas desde API o JSON estático, crea capas Medellín + demo layers, vincula toggles.
3. **`applySavedLayerState()`** — Restaura estado de checkboxes desde localStorage.
4. **`initSearch()`** — Inicializa búsqueda geocodificada.
5. **`initAlerts()`**, **`initClock()`**, **`initTicker()`**, **`initThroughput()`** — Widgets UI.
6. **`connectWebSocket()`** — Conecta a WebSocket de telemetría.
7. **`pingHealth()`** — Health check periódico cada 30s.

### Búsqueda (Search)

Flujo de `runScan()` en `search.js`:

1. **Índice local**: Busca en comunas, corregimientos, alias ("Belén", "Poblado", "Comuna 13", "Laureles")
2. **Coordenadas**: Si el input es `lat,lng`, lo parsea directamente
3. **Nominatim (OSM)**: Si no encuentra localmente, consulta OpenStreetMap Nominatim
4. **Geocodificación colombiana**: `parseColombianAddress()` entiende direcciones tipo "Calle 105A #39A-38"

Al encontrar un destino: vuela a las coordenadas, muestra popup, y automáticamente consulta la ruta segura al destino desde la ubicación actual. La ruta se dibuja con color según nivel de peligro (verde/amarillo/rojo).

### Parámetros URL

`/map?lat=6.2442&lng=-75.5812&zoom=16` — vuela a coordenadas y muestra popup.

---

## 4. Sistema de Capas

### Organización

Panel izquierdo agrupa las capas en secciones colapsables:

**Valle de Aburrá — Comunas y Corregimientos**
- Contorno ciudad + etiqueta "MEDELLÍN"
- 16 comunas + corregimientos (polígonos interactivos con popups)
- 9 municipios del área metropolitana
- Capa satelital (Esri) con slider de opacidad

**Calidad del Aire**
- Estaciones de monitoreo AQI con círculos de colores (verde=bueno, amarillo=moderado, naranja=no saludable, rojo=peligroso)
- Popups con datos completos: AQI, PM2.5, PM10, NO2, O3, SO2, temp, humedad

**SIATA y Clima**
- Zonas de inundación (polígonos con borde azul/ámbar/rojo según nivel)
- Riesgo de lluvia 2h (círculos con probabilidad)
- Alertas meteorológicas

**Reportes Ciudadanos**
- Reportes de accidente (MarkerCluster)
- Reportes de inundación (MarkerCluster)
- Reportes de obstáculos

**Riesgo de Accidentes (Clima + ML)**
- Heatmap de riesgo (Leaflet.heat con gradiente verde→rojo)
- Cacheado en Redis 1h

### Arquitectura de capas

```
demo-layers.js
├── createDemoLayers(map)
│   └── Crea layerGroups en AppState.layerGroups
│       ├── blocked-roads        → L.layerGroup
│       ├── accident-clusters    → L.markerClusterGroup
│       ├── accident-zones       → L.layerGroup
│       ├── fatalities-layer     → L.layerGroup
│       ├── air-quality-stations → L.layerGroup
│       ├── flood-zones          → L.layerGroup
│       ├── rain-risk            → L.layerGroup
│       ├── weather-alerts       → L.layerGroup
│       ├── reports-collision    → L.markerClusterGroup
│       ├── reports-flood        → L.markerClusterGroup
│       ├── reports-obstacle     → L.markerClusterGroup
│       └── accident-risk        → L.layerGroup
│
├── updateAccidents(data)         → Renderiza markers de accidentes
├── updateFatalitiesMarkers(data) → Círculos de fatalidades
├── updateFloodZones(map, data)   → Polígonos de inundación
├── updateWeather(rain, weather)  → Riesgo lluvia + estaciones
├── updateAirQualityStations(data)→ Marcadores AQI
├── updateReportsLayers(reports)  → Reportes ciudadanos (con dedup)
├── addSingleReport(data)         → Reporte individual vía WS
├── updateAccidentZones(geojson)  → Zonas DBSCAN
└── updateAccidentRiskHeatmap(map)→ Heatmap ML

medellin-layers.js
├── createMedellinLayers(map, data)
│   ├── Municipios metropolitanos (9)
│   ├── Contorno ciudad + label MEDELLÍN
│   └── Comunas (16) + corregimientos
└── renderComunasList(container, data, map)
```

### Presets y atajos

- **NAV**: navegación base (ciudad, comunas, accidentes, inundaciones)
- **ALL**: todas las capas
- **CLIMA**: capas climáticas
- **MIN**: solo contorno ciudad

Atajos de teclado: `1`-`9` para capas individuales.

---

## 5. Reporte de Incidentes

### Flujo completo

```
Usuario en /report
       │
       ▼
watchPosition() con enableHighAccuracy: true
       │
       ├── ✅ GPS real (±5-20m) → "📡 GPS Real: lat, lng"
       └── ❌ Permiso denegado → "Ubicación bloqueada. Permite el acceso."
       │
       ▼
Usuario selecciona tipo:
  • Accidente de tránsito → report_type: 'accident'
  • Accidente fatal      → report_type: 'accident'
  • Inundación           → report_type: 'flood'
       │
       ▼
Usuario escribe descripción (opcional) + nombre (obligatorio)
       │
       ▼
POST /api/v1/reports/
  Body: {
    report_type,
    description,
    latitude,
    longitude,
    reporter_name
  }
       │
       ├── ✅ 201 Created → Pantalla de éxito
       │     └── "Ver en el mapa" → /map?lat=...&lng=...&zoom=16
       │
       └── ❌ Error → Mensaje de error, formulario sigue visible
```

### Backend

El endpoint `POST /api/v1/reports/` en `endpoints/reports.py`:
1. Valida con `ReportCreate` schema (Pydantic v2)
2. Rate-limited: 5 reportes/hora por IP (`slowapi`)
3. Crea registro en tabla `reports` con geometría PostGIS POINT
4. Publica en Redis Pub/Sub (`alerts:live`) para broadcast WebSocket
5. Retorna 201 con el reporte creado

### Actualización en mapa

- **Polling**: `fetchPublicReports()` cada 30s → `updateReportsLayers()`
- **WebSocket**: evento `new_report` → `addSingleReport()` → marker individual sin recargar todo
- **Deduplicación**: `reportsMarkers` (Map) evita duplicados por `report_id`

---

## 6. Dashboard Analítico

### KPIs
- Total incidentes (formateado con locale `es-CO`)
- Víctimas fatales
- Comuna más crítica
- Clase de accidente más frecuente

### Gráficos (Chart.js)

| Gráfico | Tipo | Datos |
|---------|------|-------|
| Por gravedad | Doughnut | SOLO DAÑOS / HERIDO / MUERTO |
| Por clase | Bar | Choque, atropello, volcamiento, etc. |
| Top 10 comunas | Bar (horizontal) | Comunas con más accidentes |
| Evolución anual | Line | Serie 2008-2025 |
| Lluvia anual | Bar | Precipitación total por año |
| Lluvia promedio mensual | Line | Patrón estacional |
| Estadísticas clima | Panel | Total mm 18 años, promedio horario, registros |

### Hooks de datos

- **`useAccidentStats()`** — Consume `GET /public/accidents/stats`
- **`useWeatherStats()`** — Consume `GET /public/weather/stats`

### Responsive

- Mobile (<640px): padding reducido, KPIs en grid 2 columnas, charts apilados, alturas reducidas
- Tablet (640-1024px): KPIs en grid 2 columnas
- Desktop: layout original

---

## 7. Backend — API

### Estructura de routers

```
/api/v1/
├── /public
│   ├── GET  /alerts                    → Alertas activas
│   ├── GET  /accidents/geojson         → Incidentes GeoJSON
│   ├── GET  /fatalities                → Fatalidades GeoJSON
│   ├── GET  /flood-zones               → Zonas inundación
│   ├── GET  /weather                   → Clima actual (5 puntos)
│   ├── GET  /weather/forecast          → Pronóstico detallado Medellín
│   ├── GET  /weather/stats             → Estadísticas lluvia histórica
│   ├── GET  /rain-risk                 → Riesgo lluvia 2h
│   ├── GET  /comunas                   → Comunas + municipios PostGIS
│   ├── GET  /comunas/stats             → Accidentes por comuna
│   ├── GET  /reports                   → Reportes ciudadanos
│   ├── POST /reports                   → Crear reporte
│   ├── GET  /accident-zones            → Zonas DBSCAN (630)
│   ├── GET  /accidents/historical      → 702k históricos
│   ├── GET  /routes/safe-weather       → Ruta evadiendo riesgos
│   ├── GET  /routes                    → Alias safe-weather
│   ├── GET  /accident-risk             → Riesgo ML en punto
│   ├── GET  /accident-risk/heatmap     → Grid ML para heatmap (Redis 1h)
│   └── GET  /accident-risk/train       → Entrenar modelo
│
├── /reports
│   ├── GET  /                          → Listar (con filtros)
│   ├── POST /                          → Crear (rate limit 5/h)
│   ├── GET  /{id}                      → Detalle
│   └── PUT  /{id}                      → Actualizar
│
├── /public/air-quality
│   ├── GET  /current                   → Lecturas actuales
│   ├── GET  /station/{id}              → Historial estación
│   ├── GET  /map                       → GeoJSON para mapa
│   └── GET  /by-comuna                 → AQI promedio por comuna
│
├── /accident-zones
│   ├── GET  /                          → Listar zonas
│   ├── GET  /nearby                    → Cercanas a un punto
│   ├── GET  /{id}                      → Detalle
│   └── POST /                          → Crear
│
└── /flood-hazards
    ├── GET  /                          → Listar
    ├── GET  /nearby                    → Cercanas
    ├── GET  /{id}                      → Detalle
    ├── POST /                          → Crear
    └── PUT  /{id}                      → Actualizar estado
```

### Endpoints de salud

- `GET /health` — `{"status": "ok"}`
- `GET /health/db` — Verifica conexión PostgreSQL

### WebSocket

- `ws://host/ws/alerts?channel=global` — Alertas en tiempo real
- Eventos: `accidents`, `alerts`, `new_report`, `telemetry`, `message`

---

## 8. Flujo de Datos

### Clima

```
Open-Meteo API (free, sin key)
       │
       ▼
WeatherSyncService.sync() (cada 15 min por Celery)
       │
       ▼
weather_snapshots (5 puntos: Medellín, Bello, Itagüí, Envidado, Sabaneta)
       │
       ├── GET /public/weather       → Frontend: estaciones + temperaturas
       ├── GET /public/weather/forecast → Frontend: widget detallado
       ├── GET /public/rain-risk     → Frontend: círculos de probabilidad
       └── GET /public/weather/stats → Dashboard: gráficos históricos
```

### Calidad del Aire

```
WAQI API (con token) ──┐
                        ├──→ AirQualityClient (puerto)
AQISeedClient (fallback)┘         │
                                  ▼
                    air_quality_readings (21 estaciones reales o 5 seed)
                                  │
                                  ├── GET /public/air-quality/current
                                  ├── GET /public/air-quality/map
                                  └── GET /public/air-quality/by-comuna
```

### Inundaciones (SIATA)

```
SIATA API (Nivel.json) ──┐
                          ├──→ SiataGaugeClient (puerto)
SiataSeedClient (fallback)┘         │
                                    ▼
                      flood_hazards (5 quebradas/ríos)
                                    │
                                    ├── GET /public/flood-zones
                                    └── Usado por routing.py como obstáculos
```

### Heatmap de Riesgo ML

```
GET /public/accident-risk/heatmap
       │
       ▼
  ┌─── Redis: heatmap:accident-risk (TTL 1h) ───┐
  │               ⬆ cache hit                    │
  │                                              │
  └─── cache miss ──→ SimpleRiskModel             │
                      predict_batch(20 puntos)    │
                      │                           │
                      ▼                           │
                Grid de riesgo                    │
                [lat, lng, score]                 │
                      │                           │
                      ▼                           │
                Redis setex 1h ───────────────────┘
                      │
                      ▼
               Frontend Leaflet.heat
               Gradiente: verde→amarillo→naranja→rojo→rojo oscuro
```

---

## 9. Sistema de Alertas en Tiempo Real

### Fuentes de alertas

| Tipo | Fuente | Ejemplo |
|------|--------|---------|
| `siata` | SIATA water levels | "Quebrada La Iguaná — Nivel normal" |
| `weather` | Weather snapshot analysis | "Lluvia inminente: probabilidad 95%" |
| `traffic` | Seed data / ML predictions | "ML predice congestión en Av. Oriental" |
| `reports` | Nuevos reportes ciudadanos | "Nuevo reporte: Accidente de tránsito" |

### Generación de alertas climáticas (`weather_alerts.py`)

Evalúa cada snapshot cada 15 min:
- Probabilidad lluvia ≥ 90% → **CRITICAL**: "⛈ Lluvia inminente"
- Probabilidad 70-89% → **WARNING**: "🌧 Riesgo de lluvia"
- Temperatura > 32°C → **WARNING**: "🌡 Temperatura extrema"
- Temperatura < 12°C → **INFO**: "❄ Temperatura baja"
- 3+ zonas inundación activas → **CRITICAL**: "⚠ Múltiples zonas de inundación activas"

### Pipeline de broadcast

```
Celery Task (cron)
       │
       ▼
notify_alert() en notification.py
       │
       ├── INSERT en tabla alerts (PostgreSQL)
       │
       └── Redis PUBLISH alerts:live
                │
                ▼
       listen_and_broadcast_alerts()
       (tarea asíncrona infinita en main.py)
                │
                ▼
       connection_manager.broadcast()
                │
                ▼
       WebSocket → Frontend → UI alert feed
```

### Frontend WebSocket

- Conecta a `ws://host/ws/telemetry?channel=global`
- Reconexión con backoff exponencial: 1s, 2s, 4s... hasta 30s, máx 10 intentos
- Eventos: `telemetry`, `alerts`, `accident`, `new_report`, `message`

---

## 10. Modelo de Riesgo ML

### SimpleRiskModel (`risk_model.py`)

Modelo lineal ponderado (singleton):

| Feature | Peso | Descripción |
|---------|------|-------------|
| `accident_density` | 0.35 | Densidad de accidentes históricos en 1km |
| `precipitation` | 0.20 | Precipitación actual mm/h |
| `weather_event` | 0.15 | Evento climático cercano (tormenta, granizo) |
| `reports_24h` | 0.10 | Reportes ciudadanos en últimas 24h |
| `night_hours` | 0.10 | Hora nocturna (20:00-06:00) |
| `is_weekend` | 0.05 | Fin de semana |
| `temp_extreme` | 0.05 | Temperatura extrema (<10°C o >35°C) |

### Feature Pipeline (`feature_pipeline.py`)

**Training**: `build_training_features()` — Cruza 702k accidentes históricos con datos climáticos por fecha/hora.

**Inference**: `build_inference_features(lat, lng)` — Para un punto:
1. Busca snapshot climático más cercano (PostGIS `ST_Distance`)
2. Cuenta accidentes en 1km de radio
3. Cuenta reportes ciudadanos en últimas 24h
4. Cuenta eventos climáticos en 2km, últimas 6h
5. Todo en paralelo con `asyncio.gather`

### DBSCAN Clustering (`dbscan_clustering.py`)

Genera `accident_zones` desde los 702k incidentes históricos. Zonas con severidad 1-5 según densidad y gravedad de incidentes.

### Tareas Celery

| Tarea | Frecuencia |
|-------|------------|
| `siata.sync_flood_hazards` | Cada 15 min |
| `weather.sync` | Cada 15 min |
| `weather.generate_alerts` | Cada 15 min |
| `air_quality.sync` | Cada hora |
| `weather_events.sync` | Cada hora |
| `ml.train_risk_model` | Diario 4 AM |
| `ml.update_risk_scores` | Cada hora |

---

## 11. Servicios Externos

| Servicio | Propósito | API Key | Fallback |
|----------|-----------|---------|----------|
| Open-Meteo | Clima actual + histórico | No necesita | — |
| WAQI | Calidad del aire | `WAQI_API_TOKEN` (opcional) | 5 estaciones seed |
| SIATA (Medellín) | Nivel de quebradas + eventos climáticos | No necesita | 5 estaciones seed |
| OSRM | Enrutamiento vehicular | No necesita | Gran círculo (Haversine) |
| OpenStreetMap Nominatim | Geocodificación | No necesita | Índice local de comunas |
| datos.gov.co (SODA) | Datos abiertos accidentes | No necesita | 10 accidentes seed |

---

## 12. Despliegue

### Docker Compose

```
docker-compose.pptmaps.yml
├── db     (postgis/postgis:16-3.4)     → Puerto 5433
├── redis  (redis:7-alpine)             → Puerto 6380
├── api    (build: Dockerfile)          → Puerto 8000
├── worker (Celery)
└── beat   (Celery Beat)
```

### Dockerfile (multi-stage)

1. **frontend** (Node 22): `npm ci` + `npm run build` → `frontend/dist`
2. **backend** (Python 3.11): dependencias sistema + pip + código + `frontend/dist` (copiado desde stage 1)

### Entrypoint

`docker-entrypoint.sh`:
1. Espera PostgreSQL
2. Corre migraciones Alembic
3. Hace ingestión de datos inicial si tablas vacías (zonas, accidentes, inundaciones, alertas, clima)
4. Pre-calienta caché de heatmap
5. Inicia Uvicorn

### Variables de entorno

| Variable | Default | Propósito |
|----------|---------|-----------|
| `POSTGRES_SERVER` | localhost | Host DB |
| `POSTGRES_USER` | postgres | Usuario DB |
| `POSTGRES_PASSWORD` | postgres | Password DB |
| `POSTGRES_DB` | movimed | Base de datos |
| `REDIS_URL` | redis://localhost:6379/0 | Redis |
| `SECRET_KEY` | (dev) 256-bit hex | JWT signing |
| `WAQI_API_TOKEN` | (vacío) | API key WAQI |
| `RATE_LIMIT_REPORTS` | 5/hour | Rate limit reportes |

### Frontend en producción

FastAPI sirve el SPA: `main.py` monta `/assets`, `/static` y un catch-all que devuelve `index.html` para toda ruta que no sea API, docs, health o WebSocket.

El frontend usa `CONFIG.apiBase = window.TPPMAPS_API || "/api/v1"` — configurable via variable global `window.TPPMAPS_API`.

---

## 13. Stack Tecnológico

### Frontend

| Tecnología | Versión | Uso |
|-----------|---------|-----|
| React | 19.2 | UI framework |
| react-router-dom | 7.16 | Routing SPA |
| Vite | 8.0 | Build / dev server |
| Leaflet | 1.9 | Mapas interactivos |
| Chart.js / react-chartjs-2 | 4.4 / 5.2 | Dashboard |
| GSAP | 3.15 | Animaciones scroll |
| Lenis | 1.3 | Smooth scroll |
| Framer Motion | 12 | Micro-animaciones |
| Three.js / @react-three/fiber | 0.184 / 9.6 | Globe 3D |
| Tailwind CSS v4 | — | Estilos utilitarios |
| react-icons | 5.6 | Iconos |
| vitest | 4.1 | Tests unitarios |

### Backend

| Tecnología | Uso |
|-----------|-----|
| Python 3.11 | Runtime |
| FastAPI | Web framework |
| SQLAlchemy (async) | ORM |
| asyncpg | Driver PostgreSQL async |
| PostGIS 3.4 | Extensiones espaciales |
| GeoAlchemy2 | ORM espacial |
| Alembic | Migraciones DB |
| Redis 7 | Caché, Pub/Sub, Celery broker |
| Celery + Beat | Tareas asíncronas y schedule |
| Shapely | Operaciones geométricas |
| httpx | HTTP async |
| slowapi | Rate limiting |
| Pydantic v2 | Validación de datos |
| uvicorn | Servidor ASGI |

### Base de datos

| Tabla | Registros | Propósito |
|-------|-----------|-----------|
| `accident_incidents` | 702,540 | Datos oficiales 2008-2025 |
| `zones` | ~30 | Comunas + municipios (PostGIS) |
| `reports` | Variable | Reportes ciudadanos |
| `weather_snapshots` | ~5 | Clima actual por punto |
| `air_quality_readings` | ~21 por hora | Calidad del aire |
| `flood_hazards` | 5 | Zonas de inundación SIATA |
| `alerts` | Variable | Alertas activas |
| `accident_zones` | ~630 | Clusters DBSCAN |
| `weather_events` | Variable | Eventos climáticos |
| `weather_hazard_zones` | Variable | Zonas de riesgo climático |
| `historical_weather_medellin` | 157,800 | Clima histórico |

### Patrones de arquitectura

- **Hexagonal/Ports & Adapters**: `*Client` (puerto) → `*HttpClient` / `*SeedClient` (adaptadores)
- **Clean Architecture**: `endpoints/` → `crud/` → `models/` + `services/`
- **Event-driven**: Redis Pub/Sub → WebSocket → Frontend
- **Singleton**: `SimpleRiskModel` (instancia única con pesos)
- **Strategy**: Report type config (frontend `REPORT_TYPE_CONFIG`)
- **Observer**: WebSocket event listeners
- **Repository**: CRUD operations encapsuladas en `crud/`
