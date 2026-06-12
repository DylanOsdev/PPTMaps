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

### SIATA — eventos climáticos

- **Endpoint real:** `https://siata.gov.co/data/siata_app/app_siata/Eventos.json`
  (constante `SIATA_EVENTOS_URL` en `services/weather_event_sync.py`).
- Alimenta la tabla `weather_events` con eventos meteorológicos reportados por SIATA:
  tipo de evento, ubicación, fecha/hora y descripción.
- Se sincroniza cada hora (Celery Beat, minuto :30).

### Open-Meteo — clima y pronóstico

- **Endpoint:** `https://api.open-meteo.com/v1/forecast` (constante `OPEN_METEO_URL` en
  `services/weather.py`). **No requiere API key.**
- **Modo multipunto** (`OpenMeteoClient`): consulta en UNA sola llamada los 5 puntos del
  Valle de Aburrá — Medellín, Bello, Itagüí, Envigado, Sabaneta — y persiste el último
  snapshot por ubicación en `weather_snapshots`.
- **Modo pronóstico detallado** (`OpenMeteoForecastClient`): actual + horario + diario
  (5 días) para el centro de Medellín (Parque Berrío: `6.2518, -75.5636`), con la forma
  exacta que consume el widget del frontend.

### WAQI — calidad del aire

- **Endpoint:** `https://api.waqi.info/feed/geo:{lat};{lng}/?token={token}`
  (constante `WAQI_URL` en `services/air_quality_sync.py`).
- **Requiere API key** (`WAQI_API_TOKEN` en variables de entorno).
- Alimenta la tabla `air_quality_readings`: índice AQI, PM2.5, PM10, O₃, NO₂, temperatura
  y humedad por ubicación.
- Se sincroniza cada hora (Celery Beat, minuto :00).

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

**Todos los endpoints son públicos.** No se requiere autenticación JWT, API key ni
ningún otro mecanismo de seguridad.

### Health

```
GET  /health        Health check básico
GET  /health/db     Verifica conexión a PostgreSQL (SELECT 1)
```

### Reportes ciudadanos (con rate limiting)

```
POST /api/v1/reports/          Crear reporte ciudadano (5/h por IP vía slowapi)
GET  /api/v1/reports/          Listar reportes
GET  /api/v1/reports/{id}      Reporte por ID
```


```
```

### Endpoints públicos (sin auth) — alimentan el mapa y el dashboard

```
GET /api/v1/public/alerts              Alertas activas (is_resolved, limit)
GET /api/v1/public/accidents/geojson   Incidentes (FeatureCollection GeoJSON)
GET /api/v1/public/fatalities          Accidentes graves (GeoJSON)
GET /api/v1/public/flood-zones         Zonas de inundación (array con geom GeoJSON)
GET /api/v1/public/weather             Clima actual multipunto
GET /api/v1/public/weather/forecast    Pronóstico detallado (proxy Open-Meteo)
GET /api/v1/public/accidents/stats     Agregados de accidentalidad (dashboard)
GET /api/v1/public/rain-risk           Puntos con riesgo de lluvia a 2h (prob ≥ 50%)
GET /api/v1/public/comunas             Comunas y municipios (desde PostGIS)
GET /api/v1/public/comunas/stats       Accidentes por comuna (cruce espacial)
GET /api/v1/public/air-quality         Calidad del aire (índice AQI, PM2.5, PM10, O₃, NO₂)
```

> Nota: el README lista el clima como `/api/v1/weather/forecast`; la ruta **real** es
> `/api/v1/public/weather/forecast` (bajo el router `public`).

### Zonas de accidentalidad

```
GET /api/v1/accident-zones/          Listar zonas calientes
GET /api/v1/accident-zones/{id}      Zona por ID
GET /api/v1/accident-zones/nearby    Zonas cercanas
```

### Zonas de inundación

```
GET /api/v1/flood-hazards/           Listar zonas de riesgo
GET /api/v1/flood-hazards/{id}       Zona por ID
GET /api/v1/flood-hazards/nearby     Zonas cercanas
```

### Rutas resilientes

```
GET /api/v1/routes/?origin=lat,lng&destination=lat,lng
     Ruta que esquiva zonas de riesgo activas
```

### Documentación interactiva

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 3.3 Consumo desde el frontend

- `src/static/js/services/api.js` centraliza el acceso: `fetchAlerts`,
  `fetchAccidentsGeoJSON`, `fetchFatalities`, `fetchFloodZones`, `fetchRoute`,
  `fetchWeather`, `fetchRainRisk`, `fetchAirQuality`.
- `src/hooks/useWeather.js` consume `/api/v1/public/weather/forecast` (refresco cada 10 min).
- `src/hooks/useAccidentStats.js` consume `/api/v1/public/accidents/stats`.
- En desarrollo, Vite hace **proxy** de `/api`, `/health` y `/docs` hacia
  `http://localhost:8000` (`vite.config.js`).

---
