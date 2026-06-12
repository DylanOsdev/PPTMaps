# PPTMaps — Resumen Ejecutivo

## 1. Descripción General

PPTMaps es una plataforma de inteligencia geoespacial para el Valle de Aburrá (Medellín, Colombia) que integra datos de accidentalidad vial, clima en tiempo real, calidad del aire, niveles de ríos y alertas tempranas en un mapa interactivo con dashboard analítico y soporte de rutas seguras.

**Stack tecnológico:**

| Capa | Tecnología |
|------|-----------|
| Backend | Python 3.11 + FastAPI + Uvicorn |
| Frontend | React 19 + Vite + Leaflet + Chart.js + Three.js |
| Base de datos | PostgreSQL 16 + PostGIS (SRID 4326) |
| Cache / Broker | Redis (Celery backend + pub/sub alertas) |
| Tareas asíncronas | Celery + Redis |
| Contenedores | Docker Compose (5 servicios) |
| Testing | pytest + Vitest + happy-dom |

---

## 2. Datos

### 2.1 Datos históricos (almacenados)

| Dataset | Registros | Período | Fuente |
|---------|-----------|---------|--------|
| Accidentes viales Medellín | **702,540** | 2008–2025 | Secretaría de Movilidad — Mendeley Data (CC BY 4.0) |
| Clima histórico horario | **157,800** | 2008–2025 | Estaciones meteorológicas procesadas |

Ambos datasets se cargan **una sola vez** al iniciar el contenedor por primera vez (vía entrypoint script) y son verificados por Alembic migrations. La ingesta es idempotente (ON CONFLICT DO NOTHING).

### 2.2 APIs externas en tiempo real

| API | Endpoint | Datos | Clave | Frecuencia |
|-----|----------|-------|-------|------------|
| **Open-Meteo** | `api.open-meteo.com/v1/forecast` | Temp, humedad, precipitación, código WMO | No (gratuita) | Cada 15 min |
| **SIATA Niveles** | `siata.gov.co/.../Nivel.json` | Nivel de ríos (cm) | No | Cada 15 min |
| **SIATA Lluvias** | `siata.gov.co/.../Precipitacion/datos` | Precipitación por estación | No | Cada hora |
| **SIATA Rayos** | `siata.gov.co/.../Rayos/datos` | Descargas eléctricas | No | Cada hora |
| **WAQI** | `api.waqi.info/feed/@...` | AQI, PM2.5, PM10, NO2, O3, SO2 | `WAQI_API_TOKEN` | Cada hora |
| **SODA** | `datos.gov.co/resource/9wqu-juqb.json` | Incidentes de tránsito | No | Startup |
| **OSRM** | `router.project-osrm.org/route/v1/driving/...` | Rutas de conducción | No | Bajo demanda |

**Todas** las APIs externas tienen fallback incorporado (datos semilla) cuando la conexión falla o no hay token configurado.

### 2.3 APIs externas desde el frontend

| API | Uso | Clave |
|-----|-----|-------|
| OpenStreetMap Tiles | Mapa base raster | No |
| Esri/Google Satellite | Imagen satelital (fallback automático) | No |
| Nominatim (OSM) | Geocoding de direcciones | No (rate-limited) |
| Open-Meteo (directo) | Widget visual de clima en landing page | No |
| Google Fonts | Tipografía JetBrains Mono + Orbitron | No |
| unpkg CDN | Leaflet, MarkerCluster, Leaflet.heat | No |

---

## 3. Arquitectura

```
                         ┌──────────────────┐
                         │   React + Vite   │
                         │  (Leaflet maps)  │
                         └────────┬─────────┘
                                  │ HTTP / WS
                         ┌────────▼─────────┐
                         │   FastAPI (api)  │
                         │   Puerto 8000    │
                         └──┬────┬────┬─────┘
                            │    │    │
              ┌─────────────┘    │    └─────────────┐
              ▼                  ▼                  ▼
     ┌────────────────┐ ┌──────────────┐ ┌──────────────────┐
     │ PostgreSQL 16  │ │    Redis     │ │    Celery        │
     │ + PostGIS      │ │ cache/broker │ │ (worker + beat)  │
     │ (12 tablas)    │ │ pub/sub      │ │ 7 tareas program │
     └────────────────┘ └──────────────┘ └──────────────────┘
```

### 3.1 Servicios Docker

| Servicio | Imagen | Puerto | Rol |
|----------|--------|--------|-----|
| `db` | `postgis/postgis:16-3.4` | 5433:5432 | Base de datos geoespacial |
| `redis` | `redis:7-alpine` | 6380:6379 | Cache + Celery broker + alertas |
| `api` | Custom | 8000:8000 | API REST + WebSocket + frontend estático |
| `worker` | Custom | — | Ejecuta tareas Celery asíncronas |
| `beat` | Custom | — | Scheduler de tareas periódicas |

### 3.2 Base de datos — 12 tablas

| Tabla | Registros | Descripción |
|-------|-----------|-------------|
| `zones` | 25 | 16 comunas + 9 municipios del Valle de Aburrá (GeoJSON) |
| `accident_incidents` | 702,540 | Accidentes viales históricos 2008–2025 |
| `historical_weather_medellin` | 157,800 | Clima histórico horario |
| `weather_snapshots` | ~5 | Clima actual de 5 puntos geográficos |
| `weather_events` | Variable | Eventos climáticos (lluvia, rayos, tormenta, granizo) |
| `weather_hazard_zones` | Variable | Zonas de riesgo climático (PostGIS) |
| `air_quality_readings` | Variable | Calidad del aire de 21 estaciones WAQI |
| `flood_hazards` | ~5 | Zonas de inundación por estación SIATA |
| `accident_zones` | Variable | Zonas de accidentalidad (DBSCAN) |
| `reports` | Variable | Reportes ciudadanos de incidentes |
| `alerts` | Variable | Alertas generadas (tráfico, clima, SIATA) |
| `users` | Variable | Usuarios del sistema |

Todas las columnas geométricas usan PostGIS con índices GiST para búsquedas espaciales eficientes.

---

## 4. API — 34 endpoints REST + 1 WebSocket

### 4.1 Públicos (`/api/v1/public/`)

| Endpoint | Descripción |
|----------|-------------|
| `GET /health` | Health check (PostgreSQL + Redis) |
| `GET /api/v1/public/alerts` | Alertas activas |
| `GET /api/v1/public/accidents/stats` | Estadísticas agregadas de accidentalidad |
| `GET /api/v1/public/accidents/geojson` | Accidentes como GeoJSON |
| `GET /api/v1/public/accidents/historical` | Datos históricos de accidentes |
| `GET /api/v1/public/fatalities` | Víctimas fatales |
| `GET /api/v1/public/accident-zones` | Zonas de accidentes (DBSCAN) |
| `GET /api/v1/public/accident-risk` | Score de riesgo para coordenada |
| `GET /api/v1/public/accident-risk/heatmap` | Mapa de calor de riesgo |
| `GET /api/v1/public/accident-risk/train` | Entrenar/reentrenar modelo |
| `GET /api/v1/public/weather` | Clima actual multi-punto |
| `GET /api/v1/public/weather/forecast` | Pronóstico extendido (5 días) |
| `GET /api/v1/public/weather/stats` | Estadísticas de lluvia histórica |
| `GET /api/v1/public/rain-risk` | Riesgo de lluvia próximo 2h |
| `GET /api/v1/public/comunas` | Comunas y municipios (GeoJSON) |
| `GET /api/v1/public/comunas/stats` | Estadísticas por comuna |
| `GET /api/v1/public/flood-zones` | Zonas de inundación |
| `GET /api/v1/public/routes/safe-weather` | Ruta evitando zonas de riesgo |
| `GET /api/v1/public/air-quality/current` | Calidad del aire actual |
| `GET /api/v1/public/air-quality/station/{id}` | Datos de estación específica |
| `GET /api/v1/public/air-quality/map` | Todas las estaciones para mapa |
| `GET /api/v1/public/air-quality/by-comuna` | AQI promedio por comuna |
| `GET /api/v1/public/reports` | Reportes ciudadanos |
| `POST /api/v1/public/reports` | Crear reporte ciudadano |

### 4.2 Autenticados (`/api/v1/reports/`, etc.)

| Endpoint | Descripción |
|----------|-------------|
| `POST /api/v1/reports/` | Crear reporte (rate-limited 5/h) |
| `GET /api/v1/reports/` | Listar reportes |
| `GET /api/v1/reports/{id}` | Obtener reporte |
| `PUT /api/v1/reports/{id}` | Actualizar reporte |
| `GET /api/v1/accident-zones/nearby` | Zonas de accidente cercanas |
| `POST /api/v1/accident-zones/` | Crear zona de accidente |
| `GET /api/v1/flood-hazards/nearby` | Zonas de inundación cercanas |
| `POST /api/v1/flood-hazards/` | Crear zona de inundación |

### 4.3 WebSocket

| Ruta | Descripción |
|------|-------------|
| `WS /ws/alerts?channel=global` | Alertas en vivo vía Redis pub/sub |

---

## 5. Frontend

### 5.1 Páginas

| Ruta | Página | Descripción |
|------|--------|-------------|
| `/` | Landing | Landing page animada con 7 secciones (GSAP + Lenis + Three.js) |
| `/map` | CommandCenter | Mapa interactivo con 16 capas, WebSocket, búsqueda, clima, calidad del aire |
| `/dashboard` | Dashboard | Dashboard analítico con gráficos Chart.js (702K accidentes) |
| `/report` | Report | Formulario de reporte ciudadano con GPS |

### 5.2 Mapas — 16 capas

| Capa | Grupo | Descripción |
|------|-------|-------------|
| `medellin-city` | comunas | Perímetro de la ciudad |
| `medellin-comunas` | comunas | 16 polígonos de comunas con etiquetas |
| `metro-municipios` | comunas | 9 municipios del área metropolitana |
| `satellite-base` | comunas | Imagen satelital (ArcGIS → Google fallback) |
| `air-quality-stations` | air-quality | Estaciones de calidad del aire |
| `flood-zones` | climate | Zonas de inundación (seco/alerta/inundado) |
| `rain-risk` | climate | Probabilidad de lluvia próximas 2h |
| `weather-alerts` | climate | Marcadores de clima actual |
| `reports-collision` | reports | Reportes de accidentes (cluster) |
| `reports-flood` | reports | Reportes de inundación (cluster) |
| `reports-obstacle` | reports | Reportes de obstrucción (cluster) |
| `accident-clusters` | telemetry | Accidentes históricos (cluster) |
| `accident-zones` | telemetry | Zonas DBSCAN (GeoJSON) |
| `fatalities-layer` | telemetry | Víctimas fatales |
| `blocked-roads` | telemetry | Vías bloqueadas |
| `accident-risk` | risk | Mapa de calor de riesgo ML |

### 5.3 Hooks principales

| Hook | Endpoint | Frecuencia |
|------|----------|------------|
| `useWeather` | `/api/v1/public/weather/forecast` | Cada 10 min |
| `useAirQuality` | `/api/v1/public/air-quality/current` | Cada 5 min |
| `useAccidentStats` | `/api/v1/public/accidents/stats` | Una vez (timeout 8s) |
| `useWeatherStats` | `/api/v1/public/weather/stats` | Una vez (timeout 8s) |
| `useDevicePerformance` | — | Detecta GPU/CPU/RAM/FPS, ajusta calidad |

---

## 6. ML — Modelo de Riesgo

**No usa XGBoost ni redes neuronales.** Implementa `SimpleRiskModel` — un modelo lineal ponderado con 7 factores:

| Factor | Peso base |
|--------|-----------|
| Densidad de accidentes (1km) | 0.35 |
| Precipitación actual | 0.20 |
| Evento climático cercano | 0.15 |
| Reportes ciudadanos (24h) | 0.10 |
| Horario nocturno | 0.10 |
| Fin de semana | 0.05 |
| Temperatura extrema | 0.05 |

El entrenamiento (`ml.train_risk_model`, diario a las 4:00 AM) ajusta los pesos según la proporción de accidentes de alta severidad en los datos históricos. La inferencia se hace bajo demanda (`/api/v1/public/accident-risk`) o batch para el mapa de calor (`/heatmap`).

---

## 7. Tareas Periódicas (Celery Beat)

| Tarea | Schedule | Qué hace |
|-------|----------|----------|
| `siata.sync_flood_hazards` | Cada 15 min | Sincroniza niveles SIATA → `flood_hazards` |
| `weather.sync` | Cada 15 min | Actualiza clima desde Open-Meteo → `weather_snapshots` |
| `weather.generate_alerts` | Cada 15 min | Genera alertas por lluvia≥70%, temp extrema, riesgo inundación |
| `air_quality.sync` | :00 cada hora | Sincroniza 21 estaciones WAQI → `air_quality_readings` |
| `weather_events.sync` | :30 cada hora | Sincroniza lluvias y rayos SIATA → `weather_events` |
| `ml.train_risk_model` | 4:00 AM diario | Reentrena modelo de riesgo |
| `ml.update_risk_scores` | :45 cada hora | Actualiza puntajes de riesgo en `accident_zones` |

---

## 8. Tests

### Backend (~26 archivos)

| Categoría | Archivos | Stack |
|-----------|----------|-------|
| Tests de API | 10 | pytest + httpx (TestClient asíncrono) |
| Tests de servicios | 7 | pytest + unittest.mock (AsyncMock) |
| Tests E2E | 4 | pytest + requests + docker-compose.test.yml |
| Tests de modelos | 1 | pytest |
| Tests de tareas | 1 | pytest + mock |
| Test de rate limiting | 1 | pytest |
| Test de SPA fallback | 1 | pytest |
| Test de startup enqueue | 1 | pytest |

### Frontend (~18 archivos, 226 tests)

| Categoría | Tests | Stack |
|-----------|-------|-------|
| Components (Dashboard, CommandCenter, etc.) | ~10 | Vitest + @testing-library/react |
| Hooks (useWeather, useAccidentStats) | ~20 | Vitest + renderHook |
| Static JS (api, search, state, map-service, etc.) | ~50+ | Vitest |
| Legacy (geocode, alerts, layers) | ~30+ | Vitest |

---

## 9. Infraestructura

### 9.1 Despliegue

```bash
docker compose -f docker-compose.pptmaps.yml up -d --build
```

5 contenedores: `db` → `redis` → `api` → `worker` → `beat`.

El entrypoint del contenedor `api`:
1. Espera a PostgreSQL
2. Ejecuta `alembic upgrade head` (12 migraciones)
3. Carga accidentes (702K) si tabla vacía
4. Carga clima histórico (157K) si tabla vacía
5. Precalienta cache de mapa de calor
6. Inicia uvicorn

### 9.2 Seed data (startup — tablas vacías)

Datos semilla que se cargan automáticamente al primer inicio:
- 25 zonas (16 comunas + 9 municipios) desde GeoJSON local
- 4 alertas iniciales (2 tráfico, 2 SIATA)
- 10 accidentes semilla (fallback SODA)
- 5 zonas de inundación semilla
- 5 estaciones SIATA semilla
- 5 estaciones WAQI semilla
- 8–12 eventos climáticos sintéticos

### 9.3 Service Worker

El frontend registra un service worker (`sw.js`) que cachea:
- App shell (caché-first)
- Assets estáticos (caché-first con refresco background)
- Navegación (network-first, fallback a index.html)
- **Nunca cachea**: `/api/*`, `/ws/*`, `/health`, `/docs`, `/redoc`

---

## 10. Estado del Proyecto

| Aspecto | Estado |
|---------|--------|
| API REST (34 endpoints) | ✅ Implementado |
| WebSocket en vivo | ✅ Implementado |
| Mapa con 16 capas | ✅ Implementado |
| Dashboard analítico | ✅ Implementado |
| Landing page animada | ✅ Implementado |
| Modelo de riesgo | ✅ Implementado (SimpleRiskModel) |
| Rutas climáticamente seguras | ✅ Implementado (OSRM + PostGIS) |
| Alertas en tiempo real | ✅ Implementado (Redis pub/sub) |
| Reportes ciudadanos | ✅ Implementado |
| Calidad del aire | ✅ Implementado (WAQI) |
| Sincronización SIATA | ✅ Implementado |
| Docker Compose multi-servicio | ✅ Implementado |
| Tests backend | ✅ 26 archivos |
| Tests frontend | ✅ 226 tests |
| Alembic migrations | ✅ 12 migraciones |
| CI/CD Pipeline | ❌ No configurado |
| Autenticación JWT completa | ⚠️ Parcial (schemas listos, endpoints protegidos pendientes) |
| Kubernetes | ❌ No implementado |
| Kafka | ❌ No implementado |
| XGBoost / ML avanzado | ❌ No implementado |
| GraphQL | ❌ No implementado |
| App móvil nativa | ❌ No implementado |
| Chatbot | ❌ Eliminado del códigobase |

---

## 11. Dependencias clave

### Backend (`requirements.txt`)
`fastapi`, `uvicorn`, `pydantic`, `pydantic-settings`, `SQLAlchemy`, `asyncpg`, `GeoAlchemy2[shapely]`, `alembic`, `passlib[bcrypt]`, `python-jose[cryptography]`, `httpx`, `celery`, `redis`, `nest-asyncio`, `openpyxl`, `slowapi`, `pytest`, `pytest-asyncio`, `fakeredis`

### Frontend (`package.json`)
`react`, `react-dom`, `react-router-dom`, `react-icons`, `leaflet`, `chart.js`, `react-chartjs-2`, `@react-three/fiber`, `three`, `framer-motion`, `gsap`, `lenis`

Dev: `vite`, `vitest`, `@vitejs/plugin-react`, `tailwindcss`, `@testing-library/react`, `@testing-library/jest-dom`, `happy-dom`
