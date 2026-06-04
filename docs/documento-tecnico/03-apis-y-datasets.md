# 3. APIs y Datasets Consumidos

## 3.1 Fuentes de datos externas

### SIATA — niveles de río y quebradas

- **Endpoint real:** `https://siata.gov.co/data/siata_app/app_siata/Nivel.json`
  (constante `SIATA_NIVEL_URL` en `services/siata_sync.py`).
- El API devuelve niveles en **centímetros**; el adaptador los convierte a metros
  (`valor / 100.0`).
- Alimenta la tabla `flood_hazards`. Cada estación se aproxima a una zona con un buffer
  (`Point(...).buffer(0.01)` ≈ 1.1 km) y se clasifica por umbrales:
  `watch ≥ 1.0 m`, `flooded ≥ 2.0 m`, en otro caso `dry`.
- **Resiliencia:** si el endpoint HTTP no responde, se usa un cliente *seed* con 5
  estaciones reales del Valle de Aburrá y variación pseudoaleatoria (ver patrón hexagonal
  en el documento 5).

### Open-Meteo — clima y pronóstico

- **Endpoint:** `https://api.open-meteo.com/v1/forecast` (constante `OPEN_METEO_URL` en
  `services/weather.py`). **No requiere API key.**
- **Modo multipunto** (`OpenMeteoClient`): consulta en UNA sola llamada los 5 puntos del
  Valle de Aburrá — Medellín, Bello, Itagüí, Envigado, Sabaneta — y persiste el último
  snapshot por ubicación en `weather_snapshots`.
- **Modo pronóstico detallado** (`OpenMeteoForecastClient`): actual + horario + diario
  (5 días) para el centro de Medellín (Parque Berrío: `6.2518, -75.5636`), con la forma
  exacta que consume el widget del frontend.

### Secretaría de Movilidad de Medellín — accidentalidad

- **Dataset principal:** dataset abierto publicado en **Mendeley** (`r6g5dfnpgh`,
  CC BY 4.0): **702.540 incidentes viales** georreferenciados (2008–2025) con clase,
  gravedad, comuna, barrio y coordenadas WGS84.
- Se ingiere desde un **XLSX** mediante `scripts/ingest_accidents.py` (con `openpyxl`),
  en lotes de 2000 e idempotente por la columna `LLAVE` (`ON CONFLICT DO NOTHING`).
  Persiste en la tabla `accident_incidents`.
- **Datos.gov.co (SODA):** `services/ingestion.py` referencia el recurso
  `https://www.datos.gov.co/resource/9wqu-juqb.json`, pero el flujo está diseñado con
  **fallback**: si la API no responde, se siembran 10 accidentes de demostración en
  `reports`. (En la práctica el dataset oficial completo entra por el XLSX de Mendeley.)

## 3.2 API REST propia

Base: `/api/v1`. Documentación interactiva (Swagger): `/docs` · ReDoc: `/redoc`.

### Health

```
GET  /health        Health check básico
GET  /health/db     Verifica conexión a PostgreSQL (SELECT 1)
```

### Autenticación y usuarios

```
POST /api/v1/auth/register     Registro de usuario
POST /api/v1/auth/login        Login (JWT, OAuth2 password flow)
GET  /api/v1/users/...         CRUD de usuarios (protegido)
```

### Reportes, vehículos y rutas

```
POST/GET/PUT /api/v1/reports        Reportes ciudadanos (protegido)
CRUD         /api/v1/vehicles       Gestión de flota
GET          /api/v1/routes?destination=lat,lng[&origin=lat,lng]
             Ruta resiliente que esquiva zonas de riesgo activas
```

### Telemetría (máquina-a-máquina)

```
POST /api/v1/telemetry    Ingesta masiva de pings GPS → 202 Accepted
                          Requiere header X-API-Key (no JWT)
```

### Endpoints públicos (sin auth) — alimentan el mapa y el dashboard

```
GET /api/v1/public/telemetry/latest    Última posición de cada vehículo
GET /api/v1/public/alerts              Alertas activas (is_resolved, limit)
GET /api/v1/public/accidents/geojson   Incidentes (FeatureCollection GeoJSON)
GET /api/v1/public/fatalities          Accidentes graves (GeoJSON)
GET /api/v1/public/flood-zones         Zonas de inundación (array con geom GeoJSON)
GET /api/v1/public/weather             Clima actual multipunto
GET /api/v1/public/weather/forecast    Pronóstico detallado (proxy Open-Meteo)
GET /api/v1/public/accidents/stats     Agregados de accidentalidad (dashboard)
GET /api/v1/public/rain-risk           Puntos con riesgo de lluvia a 2h (prob ≥ 50%)
GET /api/v1/public/comunas             Comunas y municipios (desde PostGIS)
GET /api/v1/public/comunas/stats       Accidentes y vehículos por comuna (cruce espacial)
```

> Nota: el README lista el clima como `/api/v1/weather/forecast`; la ruta **real** es
> `/api/v1/public/weather/forecast` (bajo el router `public`).

### WebSocket

```
WS /ws/telemetry?channel=global
   Al conectar envía:
     {"type":"telemetry","data":[{id, vehicle_id, lat, lng, speed, heading, timestamp}]}
     {"type":"alerts","data":[{id, type, severity, message, created_at, is_resolved}]}
```

## 3.3 Consumo desde el frontend

- `src/static/js/services/api.js` centraliza el acceso: `fetchTelemetry`, `fetchAlerts`,
  `fetchAccidentsGeoJSON`, `fetchFatalities`, `fetchFloodZones`, `fetchRoute`,
  `fetchWeather`, `fetchRainRisk`, más el WebSocket (`connectWebSocket`) con reconexión
  exponencial (hasta 10 intentos).
- `src/hooks/useWeather.js` consume `/api/v1/public/weather/forecast` (refresco cada 10 min).
- `src/hooks/useAccidentStats.js` consume `/api/v1/public/accidents/stats`.
- En desarrollo, Vite hace **proxy** de `/api`, `/health`, `/ws` y `/docs` hacia
  `http://localhost:8000` (`vite.config.js`).

---

