<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/PPTMaps-Inteligencia%20Geoespacial-1a5c3a?style=for-the-badge&logo=matrix&logoColor=white&labelColor=0d1117">
    <img alt="PPTMaps" src="https://img.shields.io/badge/PPTMaps-Inteligencia%20Geoespacial-1a5c3a?style=for-the-badge&logo=matrix&logoColor=white&labelColor=ffffff">
  </picture>
</p>

<p align="center">
  <img alt="Python" src="https://img.shields.io/badge/Python-3.12+-3776AB?style=flat&logo=python&logoColor=white">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-0.115-009688?style=flat&logo=fastapi&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646CFF?style=flat&logo=vite&logoColor=white">
  <img alt="Tailwind" src="https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat&logo=tailwindcss&logoColor=white">
  <img alt="Three.js" src="https://img.shields.io/badge/Three.js-R3F-ffffff?style=flat&logo=threedotjs&logoColor=white">
  <img alt="GSAP" src="https://img.shields.io/badge/GSAP-3-88CE02?style=flat&logo=greensock&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16+-4169E1?style=flat&logo=postgresql&logoColor=white">
  <img alt="PostGIS" src="https://img.shields.io/badge/PostGIS-3.5-4169E1?style=flat&logo=postgresql&logoColor=white">
  <img alt="Redis" src="https://img.shields.io/badge/Redis-7-DC382D?style=flat&logo=redis&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-yellow?style=flat">
</p>

<p align="center">
  <strong>Plataforma de Inteligencia Geoespacial para Medellín · HackData CTGI SENA 2026</strong>
</p>

---

## Overview

**PPTMaps** is a geospatial intelligence platform that integrates official mobility data from Medellín with real-time citizen reports, weather data, and air quality monitoring. It consumes government sources (SIATA, MEData), caches and optimizes them in PostGIS, and exposes everything through a REST API + WebSocket dashboard built with React.

### Key Features

- **Interactive map** with Leaflet — accident hotspots (DBSCAN), flood zones (SIATA), weather events, comunas, air quality stations
- **Real-time alerts** via WebSockets backed by Redis pub/sub
- **Weather proxy** over Open-Meteo with Redis cache
- **Air quality monitoring** from 15 WAQI stations
- **702,540 historical incidents** (2008–2025) auto-ingested on first start
- **Citizen reports** with geolocation and rate limiting (5/h per IP)
- **Safe routing** avoiding weather hazard zones

---

## Stack

**PPTMaps** es una plataforma de inteligencia geoespacial que integra datos oficiales de movilidad de Medellín con reportes ciudadanos en tiempo real. Consume fuentes gubernamentales (SIATA, MEData, Open-Meteo), los cachea y optimiza en PostGIS, y los expone mediante una API REST + WebSockets a un dashboard interactivo construido en React con un **motor de rendimiento adaptativo** que detecta la GPU del usuario y ajusta los efectos visuales automáticamente.

### Problemas que resuelve

| Problema | Solución PPTMaps |
|---|---|
| APIs oficiales lentas y sin filtros espaciales | Cache inteligente en PostGIS con queries geoespaciales optimizadas |
| Datos de movilidad dispersos en múltiples fuentes | Unificación en un solo backend con API coherente |
| Sin alertas en tiempo real para incidentes viales | WebSockets + Celery + `alert_broadcaster` para notificaciones push |
| Reportes ciudadanos no digitalizados | Formulario público con geolocalización y soporte multimedia |
| Sin información climática integrada | Proxy Open-Meteo con caché Redis y widget en el dashboard |
| Dashboards lentos en PCs de bajos recursos | Motor de rendimiento adaptativo que detecta GPU y ajusta efectos |

---

## Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (async), Uvicorn, Pydantic v2, SQLAlchemy 2.0 (async), AsyncPG |
| Database | PostgreSQL 16 + PostGIS 3.5, GeoAlchemy2 |
| Cache/Queue | Redis 7, Celery 5.4 + Beat |
| Frontend | React 19, Vite 8, React Router 7, Leaflet 1.9.4 (CDN), Chart.js 4, Tailwind 4, GSAP 3, React Icons 5 |
| PWA | Manifest + network-first service worker |
| ML | PostGIS native `ST_ClusterDBSCAN` |
| Rate Limiting | slowapi (5 reports/hour per IP) |
| Auth | None — all endpoints are public |

---

## Project Structure

```
FRONTEND                          BACKEND                        BASE DE DATOS
+---------------------------+    +---------------------+        +------------------+
|   React 19                |    |   FastAPI           |        |   PostgreSQL 16+ |
|   Vite 8                  |    |   Uvicorn           | -----> |   PostGIS 3.5    |
|   Tailwind 4              | -> |   Pydantic v2       |  SQL   |   Redis 7        |
|   Three.js / R3F          |    |   SQLAlchemy 2.0    | <----  |                  |
|   GSAP (ScrollTrigger)    | HTTP|   AsyncPG           |        +------------------+
|   Framer Motion 12        | <-> |   Celery + Beat     |
|   Leaflet                 | REST|   WebSockets        |        +------------------+
|   React Router            |  WS |   Alembic           |        |   APIs Externas  |
|   Lenis (smooth scroll)   |    |   JWT / OAuth2      | -----> |   SIATA          |
+---------------------------+    +---------------------+        |   MEData         |
                                                                |   Open-Meteo     |
                                                                +------------------+
```

---

## Motor de Rendimiento Adaptativo

PPTMaps incluye un sistema de detección de hardware en tiempo real que ajusta automáticamente la calidad visual según el dispositivo del usuario.

### Detección de GPU

```
┌─────────────────────────────────────────────────────────┐
│  1. Detectar GPU via WebGL debug renderer               │
│  2. Clasificar: Dedicada / Integrada / Móvil            │
│  3. Benchmark: renderizar 500 triángulos (100ms)        │
│  4. Score combinado: CPU (30%) + GPU (40%) + HW (30%)   │
│  5. Asignar tier: HIGH / MEDIUM / LOW                   │
└─────────────────────────────────────────────────────────┘
```

| GPU Detectada | Clasificación | Bonus |
|---|---|---|
| NVIDIA GeForce RTX / GTX | Dedicada | +25 pts |
| AMD Radeon RX | Dedicada | +25 pts |
| Apple M1/M2/M3/M4 | Dedicada | +45 pts |
| Intel Iris Xe / Arc | Dedicada | +25 pts |
| Intel UHD / HD | Integrada | -10 pts |
| Qualcomm Adreno | Móvil Dedicada | +25 pts |
| Mali / PowerVR | Móvil Integrada | +10 pts |

### Tiers de Renderizado

| Tier | Score | Partículas | Globe Cities | Globe Arcs | Efectos Weather | Max Pixel Ratio |
|---|---|---|---|---|---|---|
| **HIGH** | >60 | 60 | 15 | 10 | Todos | 3.0 |
| **MEDIUM** | 30-60 | 30 | 10 | 7 | Max 3 simultáneos | 2.0 |
| **LOW** | <30 | 15 | 6 | 4 | Básicos | 1.0 |

### Auto-downgrade / Auto-upgrade

- Si FPS < 25 por 2 muestras consecutivas → degradar tier
- Si FPS > 50 por 5 muestras consecutivas → mejorar tier
- Monitoreo continuo con `requestAnimationFrame`

---

## Optimizaciones de Rendimiento

### Globe3D (Three.js / React Three Fiber)

| Optimización | Detalle |
|---|---|
| **InstancedMesh** | 15 ciudades + 15 glows → 2 draw calls (antes 30) |
| **Visibility Observer** | `IntersectionObserver` detiene rendering cuando off-screen |
| **frameloop="never"** | Canvas deja de renderizar cuando invisible |
| **Buffer disposal** | `geometry.dispose()` + `material.dispose()` en unmount |
| **Imperative geometry** | `THREE.BufferAttribute` en `useMemo` (no JSX reconciler) |

### Animaciones (GSAP + Framer Motion)

| Optimización | Detalle |
|---|---|
| **will-change lifecycle** | Aplicado solo durante transición GSAP, removido al completar |
| **CSS > Framer Motion** | DigitalRain, Dust, Scanline, GlitchBars → CSS `@keyframes` |
| **clip-path typewriter** | 2 nodos DOM (antes 18 nodos por carácter) |
| **Reduced motion** | Fallback vertical scroll para `prefers-reduced-motion` |
| **Lenis smooth scroll** | Scroll suave con `scrub: 0.5` en GSAP |

### TelemetrySection (CSS Animations)

| Optimización | Detalle |
|---|---|
| **LightRays** | CSS `@keyframes` con transform/opacity (antes RAF + gradient strings) |
| **CausticFloor** | CSS `@keyframes` con translateX/scaleY (antes RAF + radial-gradient) |
| **SurfaceWave** | CSS `@keyframes` mask-position (antes RAF + SVG data URI reconstruido) |
| **AnimatedBars** | CSS `@keyframes` (antes Framer Motion controller) |

### ReportsSection

| Optimización | Detalle |
|---|---|
| **HoloHub isolated RAF** | Elapsed time management interno, parent no re-renderiza |
| **CollidingDots** | `transform: translate()` en vez de `left/top` (no layout thrashing) |
| **Ripple throttle** | `setRipples` throttled a 100ms (antes cada frame) |
| **Seeded random** | `seededRandom()` para voice bars (sin `Math.random()` en useMemo) |

### CSS Containment

| Sección | Propiedad |
|---|---|
| HeroSection | `contain: layout style` |
| TelemetrySection | `contain: layout style` |
| BackendSection | `contain: layout style` |
| FinalCTA | `contain: layout style paint` + `content-visibility: auto` |

### Backdrop Filter

Se eliminó `backdrop-filter: blur()` de 13+ elementos animados (Navbar, DataPanel, StatCards, StatusBar). Se reemplazó con backgrounds semi-transparentes (`bg-[#041327]/90`).

---


## Project Structure

```
backend/
├── alembic/                    # 12 migrations (PostGIS, schema, data drops)
├── app/
│   ├── api/v1/endpoints/       # Router mounts + endpoint modules
│   │   ├── public.py           # Geo, weather, accident, routes endpoints
│   │   ├── air_quality.py      # WAQI air quality endpoints
│   │   ├── reports.py          # Citizen reports CRUD
│   │   └── router.py           # Main router
│   ├── core/                   # Config, security (unused)
│   ├── db/                     # Async session, Base, database.py
│   ├── models/                 # 12 SQLAlchemy + PostGIS models
│   ├── schemas/                # Pydantic v2 validators
│   ├── services/               # 11 service modules (hexagonal)
│   ├── tasks/                  # Celery app, worker, cron_jobs (5 tasks)
│   └── main.py                 # FastAPI entry point
├── frontend/                   # React + Vite SPA
│   └── src/
│       ├── components/         # TopBar, WeatherWidget, AirQualityWidget, StatusCluster
│       ├── hooks/              # useWeather, useAccidentStats, useAirQuality, useWeatherStats
│       ├── pages/              # Landing, CommandCenter, Dashboard, Report
│       ├── static/js/services/api.js   # REST + WebSocket client
│       └── App.jsx             # Router: /, /map, /dashboard, /report
├── tests/                      # pytest (e2e, unit, integration)
├── docker-compose.pptmaps.yml  # 5 services: api, db, redis, worker, beat
└── docker-compose.test.yml     # Isolated test infrastructure
```

---

## API Endpoints

All under `/api/v1`. Public — no authentication required.

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/health/db` | Database connectivity |
| `WS` | `/ws/telemetry?channel=global` | Real-time alerts WebSocket |

### Reports
| `GET` | `/reports/` | List citizen reports |
| `POST` | `/reports/` | Create report |
| `GET` | `/reports/{id}` | Report by ID |
| `PUT` | `/reports/{id}` | Update report |

### Public
| `GET` | `/public/alerts` | Active alerts |
| `GET` | `/public/accidents/geojson` | Incidents as GeoJSON |
| `GET` | `/public/fatalities` | Fatal incidents |
| `GET` | `/public/flood-zones` | SIATA flood risk zones |
| `GET` | `/public/weather` | Current multi-point weather |
| `GET` | `/public/weather/forecast` | Open-Meteo forecast proxy |
| `GET` | `/public/weather/stats` | Historical rain statistics |
| `GET` | `/public/accidents/stats` | Aggregated accident stats |
| `GET` | `/public/rain-risk` | Rain risk points (2h) |
| `GET` | `/public/comunas` | Comunas + municipios |
| `GET` | `/public/comunas/stats` | Accidents per comuna (spatial join) |
| `GET` | `/public/reports` | Public reports |
| `POST` | `/public/reports` | Create public report |
| `GET` | `/public/accident-zones` | DBSCAN hotspot GeoJSON |
| `GET` | `/public/accidents/historical` | 702k historical incidents |
| `GET` | `/public/routes/safe-weather` | Safe route avoiding weather zones |
| `GET` | `/public/routes` | Alias for safe-weather |

### Air Quality
| `GET` | `/public/air-quality/current` | Latest readings per station |
| `GET` | `/public/air-quality/station/{id}` | Station history |
| `GET` | `/public/air-quality/map` | GeoJSON for map layers |
| `GET` | `/public/air-quality/by-comuna` | AQI by comuna |


Interactive docs: `http://localhost:8000/docs` (Swagger UI)

---

## Celery Tasks

| Task | Schedule |
|---|---|
| `siata.sync_flood_hazards` | Every 15 min |
| `weather.sync` | Every 15 min |
| `weather.generate_alerts` | On snapshot analysis |
| `air_quality.sync` | Every hour |
| `weather_events.sync` | Every hour (:30 offset) |

---

## Quick Start

```bash
# Clone
git clone https://github.com/DylanOsdev/PPTMaps.git
cd PPTMaps/backend

# Start full stack (auto-ingests 702k incidents)
docker-compose -f docker-compose.pptmaps.yml up -d --build

# Frontend:    http://localhost:8000
# API Docs:    http://localhost:8000/docs
```

On first start the system builds images, applies migrations, ingests 702,540 road traffic incidents (2008–2025), seeds 30 zones (comunas + municipios), and starts the API.

---

## Data Sources

| Source | Data | Access |
|---|---|---|
| **SIATA** | Flood levels, weather events (rain, lightning, hail) | Public API |
| **MEData** | 702,540 road traffic incidents (2008–2025) | Mendeley r6g5dfnpgh |
| **Open-Meteo** | Weather forecast | Free, no API key |
| **WAQI** | Air quality — 15 stations in Valle de Aburrá | Public API |
| **Citizen Reports** | Geolocated incident reports | Via platform |

---

## ML

## ML

- **DBSCAN Clustering** — PostGIS native `ST_ClusterDBSCAN` (eps: 0.002, minpoints: 3) for accident hotspot detection
- XGBoost model trained separately (not in `app/ml/`)

---

## Tests

```bash
cd backend
pytest -v
```

---

## License

**MIT** — Free for academic and competition use.

---

<p align="center">
  <sub>Built for HackData CTGI SENA 2026</sub>
  <br>
  <strong>Medellín, Colombia</strong>
</p>

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=1a5c3a:2d9e5e:3db84f&height=120&section=footer" width="100%">
</p>
