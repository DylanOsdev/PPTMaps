# Fuentes de Datos — PPTMaps

## 1. Archivos Estáticos

| Archivo | Ruta | Registros | Carga |
|---------|------|-----------|-------|
| Medellín Comunas GeoJSON | `frontend/src/assets/data/medellin-comunas.json` | 25 polígonos (16 comunas + 9 municipios) | `zones_seed.py` al iniciar la app |
| Medellín Comunas GeoJSON (copia) | `frontend/public/assets/data/medellin-comunas.json` | Ídem | Frontend vía `CONFIG.dataUrl` |
| Accidentes muestra GeoJSON | `frontend/src/assets/data/accidents-metro.json` | ~155 puntos demo | Frontend vía `CONFIG.accidentsUrl` |
| Accidentes muestra GeoJSON (copia) | `frontend/public/assets/data/accidents-metro.json` | Ídem | Frontend |
| Rutas Medellín GeoJSON | `frontend/public/assets/data/rutas_medellin.json` | Rutas de bus/Metro | Demo layers del frontend |
| Clima histórico CSV | `backend/data/processed/clima_historico_medellin.csv` | 157,801 filas (2008–2025) | `load_historical_weather.py` |
| Accidentes fatales XLSX | `backend/data/raw/Fatal_Road_Traffic.xlsx` | 702,540 registros (2008–2025) | `ingest_accidents.py` |

## 2. APIs Externas (Backend → Externa)

| Fuente | Endpoint | Datos | Clave | Fallback |
|--------|----------|-------|-------|----------|
| **SIATA** — Niveles | `GET siata.gov.co/.../Nivel.json` | Nivel de ríos (cm) | No | 5 estaciones hardcodeadas |
| **SIATA** — Lluvias | `GET siata.gov.co/.../Precipitacion/datos` | Precipitación por estación | No | Datos sintéticos (10 ubicaciones) |
| **SIATA** — Rayos | `GET siata.gov.co/.../Rayos/datos` | Descargas eléctricas | No | Datos sintéticos |
| **SIATA** — Niveles (legacy, sin uso) | `GET siata.gov.co/.../getNiveles` | Nivel de ríos — **definido pero no llamado** | No | — |
| **SODA** — Incidentes | `GET www.datos.gov.co/resource/9wqu-juqb.json` | Incidentes de tránsito Medellín | No | 10 accidentes hardcodeados |
| **WAQI** — Calidad del Aire | `GET api.waqi.info/feed/@...` | AQI, PM2.5, PM10, NO2, O3, SO2 | `WAQI_API_TOKEN` | 5 estaciones semilla |
| **Open-Meteo** — Clima | `GET api.open-meteo.com/v1/forecast` | Temp, humedad, lluvia, código climático | No (gratuita) | — |
| **OSRM** — Rutas | `GET router.project-osrm.org/route/v1/driving/...` | Geometría de ruta vehicular | No | Distancia haversine |

## 3. APIs Externas (Frontend → Externa)

| Fuente | URL | Datos | Clave |
|--------|-----|-------|-------|
| OpenStreetMap Tiles | `tile.openstreetmap.org/{z}/{x}/{y}.png` | Mapa base raster | No |
| Esri Satellite Tiles | `server.arcgisonline.com/ArcGIS/.../tile/{z}/{y}/{x}` | Imagen satelital | No |
| Google Satellite Tiles (fallback) | `mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}` | Imagen satelital cuando Esri falla | No |
| Nominatim (OSM) | `nominatim.openstreetmap.org/search` | Geocoding direcciones → lat/lng | No (rate-limited) |
| **Open-Meteo** (directo) | `api.open-meteo.com/v1/forecast?latitude=6.2442&longitude=-75.5812` | Widget visual de clima en landing page | No (gratuita) |

## 4. CDN / Librerías Externas (Frontend)

| Recurso | URL | Propósito |
|---------|-----|-----------|
| Google Fonts | `fonts.googleapis.com` + `fonts.gstatic.com` | Fuentes JetBrains Mono + Orbitron |
| Leaflet CSS | `unpkg.com/leaflet@1.9.4/dist/leaflet.css` | Estilos del motor de mapas |
| MarkerCluster CSS | `unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css` | Estilos de agrupación de marcadores |
| MarkerCluster Default CSS | `unpkg.com/.../MarkerCluster.Default.css` | Estilos por defecto de clusters |
| Leaflet JS | `unpkg.com/leaflet@1.9.4` | Motor de mapas |
| MarkerCluster JS | `unpkg.com/leaflet.markercluster@1.4.1` | Agrupación de marcadores |
| Leaflet.heat JS | `unpkg.com/leaflet.heat@0.2.0` | Mapas de calor |

## 5. Tareas Periódicas (Celery)

| Tarea | Schedule | Fuente | Destino |
|-------|----------|--------|---------|
| `siata.sync_flood_hazards` | Cada 15 min | SIATA Nivel.json | `flood_hazards` |
| `weather.sync` | Cada 15 min | Open-Meteo | `weather_snapshots` |
| `weather.generate_alerts` | Cada 15 min | `weather_snapshots` | `alerts` |
| `air_quality.sync` | Cada hora (:00) | WAQI (21 estaciones) | `air_quality_readings` |
| `weather_events.sync` | Cada hora (:30) | SIATA lluvia + rayos | `weather_events` |
| `ml.train_risk_model` | Diario (4:00 AM) | `accident_incidents` + clima histórico | Modelo ML en memoria |
| `ml.update_risk_scores` | Cada hora (:45) | Riesgo actual + clima | `accident_zones` (severidad) |

## 6. Semillas (Startup)

Ejecutadas en `startup.py → seed_initial_data()` si las tablas están vacías:

| Semilla | Registros | Fallback de |
|---------|-----------|-------------|
| Zonas (comunas + municipios) | 16 + 9 desde GeoJSON | — |
| Accidentes | 10 hardcodeados | SODA API |
| Flood zones | 5 polígonos hardcodeados | — |
| Alertas | 4 hardcodeadas (2 tráfico, 2 SIATA) | — |
| Estaciones SIATA | 5 hardcodeadas | SIATA API |
| Estaciones WAQI | 5 hardcodeadas | WAQI API |
| Eventos climáticos | 8–12 sintéticos | SIATA lluvia/rayos |

## 7. Dependencias Externas (Resumen)

```
SIATA (siata.gov.co)          ──→ Nivel ríos, lluvias, rayos    (público)
Datos.gov.co (SODA)           ──→ Incidentes de tránsito         (público)
WAQI (api.waqi.info)          ──→ Calidad del aire               (requiere WAQI_API_TOKEN)
Open-Meteo (backend)          ──→ Pronóstico climático           (gratuito, sin key)
Open-Meteo (frontend)         ──→ Widget clima landing page      (gratuito, sin key)
OSRM                          ──→ Rutas de conducción            (público)
OpenStreetMap (tiles)         ──→ Mapas base                     (público)
Esri Satellite                ──→ Imágenes satelitales           (público)
Google Satellite (fallback)   ──→ Imágenes satelitales           (público)
Nominatim                     ──→ Geocoding                      (público, rate-limited)
Google Fonts                  ──→ Fuentes tipográficas           (público)
unpkg CDN                     ──→ Leaflet + MarkerCluster + heat (público)
Mendeley Dataset              ──→ Accidentes históricos XLSX     (CC BY 4.0, archivo estático)
```

La **única clave requerida** para datos reales (no semilla) es `WAQI_API_TOKEN`. Todo lo demás tiene endpoint público o fallback incorporado.
