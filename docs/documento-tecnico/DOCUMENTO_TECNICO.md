# Documento Técnico — PPTMaps

**Plataforma Unificada de Movilidad Inteligente para Medellín**
HackData CTGI SENA 2026 · Medellín, Antioquia, Colombia

---

## 1. Resumen

PPTMaps es una plataforma de inteligencia geoespacial que integra datos oficiales de
movilidad del Valle de Aburrá con reportes ciudadanos en tiempo real. Consume fuentes
abiertas (Secretaría de Movilidad de Medellín, SIATA, Open-Meteo, WAQI), las normaliza y
optimiza en PostGIS, y las expone mediante una API REST a una PWA en React con mapa
interactivo y dashboard analítico.

---

## 2. Arquitectura del Sistema

```
                         FUENTES DE DATOS ABIERTAS
   ┌─────────────────┬─────────────────┬──────────────────────────┬──────────────┐
   │  Sec. Movilidad │      SIATA      │       Open-Meteo         │    WAQI      │
   │  (accidentes)   │(ríos + eventos) │   (clima multipunto)     │ (calidad aire)│
   └────────┬────────┴────────┬────────┴────────────┬─────────────┴──────┬───────┘
            │ ingesta XLSX     │ sync hexagonal      │ proxy + caché      │ proxy
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
   │ PostgreSQL 16 +  │  │  Redis 7           │  │  ML (PostGIS nativo) │
   │ PostGIS 3.5      │  │ (broker + pub/sub) │  │  DBSCAN clustering   │
   │ (geoespacial)    │  └────────────────────┘  └──────────────────────┘
   └──────────────────┘
            ▲
            │ REST
   ┌────────┴─────────────────────────────────────────────────────┐
   │   Frontend PWA (React 19 + Vite 8 + Leaflet + Chart.js)       │
   │   Landing · Mapa (CommandCenter) · Dashboard · Reportes       │
   └──────────────────────────────────────────────────────────────┘
```

La aplicación se despliega como una sola unidad: FastAPI sirve la API y además el
frontend compilado (`frontend/dist`), con fallback SPA para deep-links.

---

## 3. Tecnologías Utilizadas

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19, Vite 8, React Router 7, Leaflet, Chart.js 4, Tailwind 4 |
| Backend | FastAPI, Uvicorn, Pydantic v2, SQLAlchemy 2.0 (async), AsyncPG |
| Base de datos | PostgreSQL 16 + PostGIS 3.5, GeoAlchemy2 |
| Cache / cola | Redis 7, Celery 5.4 + Beat |
| Tiempo real | WebSockets (broadcast de alertas) |
| ML / Analítica | DBSCAN (clustering de accidentalidad), Chart.js |
| Rate limiting | slowapi (5 reportes/h por IP) |
| Migraciones | Alembic |
| PWA | Manifest + Service Worker (app-shell, cache-first) |

---

## 4. APIs y Datasets Consumidos

### Fuentes de datos abiertas
- **Accidentalidad de Medellín** — Secretaría de Movilidad de Medellín, dataset abierto
  publicado en Mendeley (`r6g5dfnpgh`, CC BY 4.0): 702.540 incidentes viales
  georreferenciados (2008–2025) con clase, gravedad, comuna y coordenadas WGS84.
- **SIATA** — niveles del Río Medellín y quebradas para zonas de riesgo de inundación
  y eventos climáticos.
- **Open-Meteo** — pronóstico meteorológico multipunto del Valle de Aburrá (sin API key).
- **WAQI** — calidad del aire (AQI, PM2.5, PM10, O₃, NO₂) con API key.

### Endpoints públicos (todos sin autenticación)
```
GET /api/v1/public/comunas            Comunas/municipios (PostGIS)
GET /api/v1/public/comunas/stats      Accidentes por comuna (cruce espacial)
GET /api/v1/public/accidents/geojson  Incidentes en GeoJSON
GET /api/v1/public/accidents/stats    Agregados de accidentalidad (dashboard)
GET /api/v1/public/fatalities         Incidentes fatales
GET /api/v1/public/flood-zones        Zonas de riesgo de inundación (SIATA)
GET /api/v1/public/weather            Clima actual multipunto
GET /api/v1/public/weather/forecast   Pronóstico detallado (proxy Open-Meteo)
GET /api/v1/public/rain-risk          Puntos con riesgo de lluvia a 2h
GET /api/v1/public/alerts             Alertas activas
GET /api/v1/public/air-quality        Calidad del aire (AQI, PM2.5, PM10)
POST /api/v1/reports                  Crear reporte ciudadano (5/h por IP)
GET  /api/v1/routes                   Ruta resiliente esquivando riesgos
```
Documentación interactiva (Swagger): `/docs`.

---

## 5. Estructura de Base de Datos

Esquema PostGIS gestionado con Alembic. 12 tablas principales:

| Tabla | Rol |
|-------|-----|
| `users` | Usuarios y roles (sin uso activo en la UI) |
| `reports` | Reportes ciudadanos georreferenciados |
| `accident_incidents` | 702k incidentes oficiales (año, clase, gravedad, comuna, geom) |
| `accident_zones` | Zonas calientes de accidentalidad (clustering DBSCAN) |
| `flood_hazards` | Zonas de inundación (polígonos, nivel, estación SIATA) |
| `weather_snapshots` | Último snapshot de clima por punto del Valle |
| `alerts` | Alertas (clima, SIATA, tráfico) con severidad |
| `zones` | Comunas y municipios (polígonos PostGIS) |
| `air_quality_readings` | Índice AQI, PM2.5, PM10, O₃, NO₂ por ubicación |
| `weather_hazard_zones` | Zonas de riesgo meteorológico (SIATA) |
| `weather_events` | Eventos climáticos SIATA |
| `historical_weather_medellin` | Datos históricos de clima de Medellín |

Convención CRS: almacenamiento en **EPSG:4326** (WGS84) para interoperabilidad GIS.
Índices espaciales GiST sobre todas las columnas `geom`.

---

## 6. Patrones de Diseño Implementados

- **Arquitectura hexagonal (puertos y adaptadores)** — en ingesta de datos externos:
  `WeatherClient`/`OpenMeteoClient`, `ForecastClient`/`OpenMeteoForecastClient`,
  `SiataGaugeClient`/`SiataSeedClient`, `AirQualityClient`/`WaqiHttpClient`,
  `WeatherEventClient`/`SiataEventosHttpClient`. El servicio depende de la interfaz, no
  de la fuente concreta, lo que permite testear con fakes sin tocar APIs externas.
- **Repository / CRUD** — operaciones de datos aisladas en `app/crud`.
- **Inyección de dependencias** — vía `Depends` de FastAPI (sesión DB, clientes),
  clave para el testing con dobles de prueba.
- **Pub/Sub** — `alert_broadcaster` retransmite alertas vía Redis pub/sub hacia los
  clientes WebSocket.

---

## 7. Flujo General del Sistema

1. **Arranque**: la app verifica PostGIS, siembra zonas (comunas/municipios) de forma
   idempotente y encola la sincronización inicial de clima.
2. **Ingesta periódica (Celery Beat)**:
   - `siata.sync_flood_hazards` (cada 15 min) — niveles SIATA → `flood_hazards`
   - `weather.sync` (cada 15 min) — Open-Meteo → `weather_snapshots`
   - `weather.generate_alerts` (cada 15 min) — alertas meteorológicas automáticas
   - `air_quality.sync` (cada hora) — WAQI → `air_quality_readings`
   - `weather_events.sync` (cada hora, min :30) — eventos SIATA → `weather_events`
3. **Consulta**: el frontend pide capas y agregados a la API; el mapa Leaflet pinta
   polígonos/marcadores y el dashboard grafica los agregados de accidentalidad.

---

## 8. Calidad y Verificación

- Suite de pruebas automatizadas (pytest + pytest-asyncio) sobre PostGIS real.
- Estrategia TDD en endpoints y servicios (rojo → verde).
- Infraestructura de test aislada (`docker-compose.test.yml`).

---

## 9. PWA

- `manifest.webmanifest` con íconos (incluido maskable) e identidad de marca.
- Service Worker con caché de app-shell (network-first para navegación, cache-first
  para estáticos; excluye API y media).
- Instalable y operable con conectividad intermitente.

---

*Documento técnico — PPTMaps · HackData CTGI SENA 2026.*
