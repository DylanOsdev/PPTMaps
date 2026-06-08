# Documento Técnico — PPTMaps

**Plataforma Unificada de Movilidad Inteligente para Medellín**
HackData CTGI SENA 2026 · Medellín, Antioquia, Colombia

---

## 1. Resumen

PPTMaps es una plataforma de inteligencia geoespacial que integra datos oficiales de
movilidad del Valle de Aburrá con reportes ciudadanos en tiempo real. Consume fuentes
abiertas (Secretaría de Movilidad de Medellín, SIATA, Open-Meteo), las normaliza y
optimiza en PostGIS, y las expone mediante una API REST + WebSockets a una PWA en React
con mapa interactivo y dashboard analítico.

---

## 2. Arquitectura del Sistema

```
                        FUENTES DE DATOS ABIERTAS
   ┌─────────────────┬─────────────────┬──────────────────────────┐
   │  Sec. Movilidad │      SIATA      │       Open-Meteo         │
   │  (accidentes)   │  (niveles río)  │   (clima multipunto)     │
   └────────┬────────┴────────┬────────┴────────────┬─────────────┘
            │ ingesta XLSX     │ sync hexagonal      │ proxy + caché
            ▼                  ▼                     ▼
   ┌──────────────────────────────────────────────────────────────┐
   │                FastAPI (Uvicorn, async)                        │
   │  ┌────────────┐  ┌──────────────┐  ┌─────────────────────┐    │
   │  │ API REST   │  │  WebSockets  │  │  Celery + Beat      │    │
   │  │ /api/v1    │  │ /ws/telemetry│  │  (tareas periódicas)│    │
   │  └─────┬──────┘  │ /ws/alerts   │  └──────────┬──────────┘    │
   └────────┼─────────┴──────┬───────┴─────────────┼───────────────┘
            ▼                 ▼                     ▼
   ┌──────────────────┐  ┌────────────┐  ┌──────────────────────┐
   │ PostgreSQL 16 +  │  │  Redis 7   │  │  Modelos ML          │
   │ PostGIS 3.5      │  │ (buffer +  │  │  DBSCAN / tráfico    │
   │ (geoespacial)    │  │  pub/sub)  │  └──────────────────────┘
   └──────────────────┘  └────────────┘
            ▲
            │ REST + WS
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
| Tiempo real | WebSockets (telemetría + alertas con broadcast) |
| ML / Analítica | DBSCAN (clustering de accidentalidad), Chart.js |
| Migraciones | Alembic |
| PWA | Manifest + Service Worker (app-shell, cache-first) |

---

## 4. APIs y Datasets Consumidos

### Fuentes de datos abiertas
- **Accidentalidad de Medellín** — Secretaría de Movilidad de Medellín, dataset abierto
  publicado en Mendeley (`r6g5dfnpgh`, CC BY 4.0): 702.540 incidentes viales
  georreferenciados (2008–2025) con clase, gravedad, comuna y coordenadas WGS84.
- **SIATA** — niveles del Río Medellín y quebradas para zonas de riesgo de inundación.
- **Open-Meteo** — pronóstico meteorológico multipunto del Valle de Aburrá (sin API key).

### Endpoints públicos (sin autenticación)
```
GET /api/v1/public/comunas            Comunas/municipios (PostGIS)
GET /api/v1/public/comunas/stats      Accidentes y vehículos por comuna (cruce espacial)
GET /api/v1/public/accidents/geojson  Incidentes en GeoJSON
GET /api/v1/public/accidents/stats    Agregados de accidentalidad (dashboard)
GET /api/v1/public/fatalities         Incidentes fatales
GET /api/v1/public/flood-zones        Zonas de riesgo de inundación (SIATA)
GET /api/v1/public/weather            Clima actual multipunto
GET /api/v1/public/weather/forecast   Pronóstico detallado (proxy Open-Meteo)
GET /api/v1/public/rain-risk          Puntos con riesgo de lluvia a 2h
GET /api/v1/public/telemetry/latest   Última posición de cada vehículo
GET /api/v1/public/alerts             Alertas activas
WS  /ws/telemetry                     Streaming de telemetría
WS  /ws/alerts                        Broadcast de alertas en vivo
```
Documentación interactiva (Swagger): `/docs`.

---

## 5. Estructura de Base de Datos

Esquema PostGIS gestionado con Alembic. Tablas principales:

| Tabla | Rol |
|-------|-----|
| `users` | Usuarios y roles (auth JWT) |
| `vehicles` | Flota (ambulancias, patrullas, bomberos) |
| `telemetry` | Pings GPS (lat/lng, velocidad, geom POINT 4326) |
| `alerts` | Alertas (tráfico, SIATA, overspeed) con severidad |
| `reports` | Reportes ciudadanos georreferenciados |
| `accident_incidents` | 702k incidentes oficiales (año, clase, gravedad, comuna, geom) |
| `accident_zones` | Zonas calientes de accidentalidad (clustering) |
| `flood_hazards` | Zonas de inundación (polígonos, nivel, estación SIATA) |
| `weather_snapshots` | Último snapshot de clima por punto del Valle |
| `zones` | Comunas y municipios (polígonos PostGIS) |

Convención CRS: almacenamiento en **EPSG:4326** (WGS84) para interoperabilidad GIS.
Índices espaciales GiST sobre todas las columnas `geom`.

---

## 6. Patrones de Diseño Implementados

- **Arquitectura hexagonal (puertos y adaptadores)** — en ingesta de datos externos:
  `WeatherClient`/`OpenMeteoClient`, `ForecastClient`/`OpenMeteoForecastClient`,
  `SiataClient`/`StaticSeedSiataClient`. El servicio depende de la interfaz, no de la
  fuente concreta, lo que permite testear con fakes sin tocar APIs externas.
- **CQRS para telemetría de alta concurrencia** — los pings GPS se encolan en Redis
  (escritura rápida) y un worker Celery los drena a PostgreSQL en lotes (`telemetry.flush`).
- **Repository / CRUD** — operaciones de datos aisladas en `app/crud`.
- **Inyección de dependencias** — vía `Depends` de FastAPI (sesión DB, clientes),
  clave para el testing con dobles de prueba.
- **Pub/Sub** — `alert_broadcaster` retransmite alertas vía WebSocket a los clientes.

---

## 7. Flujo General del Sistema

1. **Arranque**: la app verifica PostGIS, siembra zonas (comunas/municipios) de forma
   idempotente y encola la sincronización inicial de clima.
2. **Ingesta periódica (Celery Beat)**:
   - `siata.sync_flood_hazards` (cada 15 min) — niveles SIATA → `flood_hazards`
   - `weather.sync` (cada 15 min) — Open-Meteo → `weather_snapshots`
   - `telemetry.flush` (cada min) — drena buffer Redis → `telemetry`
   - `overspeed.check` (cada min) — detecta excesos de velocidad → alertas
   - `ml.cluster_accident_hotspots` (cada hora) — DBSCAN → zonas calientes
3. **Consulta**: el frontend pide capas y agregados a la API; el mapa Leaflet pinta
   polígonos/marcadores y el dashboard grafica los agregados de accidentalidad.
4. **Tiempo real**: telemetría y alertas se transmiten por WebSocket.

---

## 8. Calidad y Verificación

- Suite de **87 pruebas** automatizadas (pytest + pytest-asyncio) sobre PostGIS real.
- Estrategia TDD en endpoints y servicios (rojo → verde).
- Infraestructura de test aislada (`docker-compose.test.yml`).

---

## 9. PWA

- `manifest.webmanifest` con íconos (incluido maskable) e identidad de marca.
- Service Worker con caché de app-shell (network-first para navegación, cache-first
  para estáticos; excluye API/WS y media).
- Instalable y operable con conectividad intermitente.

---

*Documento técnico — PPTMaps · HackData CTGI SENA 2026.*
