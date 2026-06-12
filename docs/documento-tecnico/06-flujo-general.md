# 6. Flujo General del Sistema

## 6.1 Arranque de la aplicación (`lifespan` en `main.py`)

Al iniciar FastAPI, el `lifespan` ejecuta esta secuencia (verificada en `app/main.py`):

1. **Verifica PostGIS/PostgreSQL** con un `SELECT 1`; si falla, aborta el arranque.
2. **Siembra zonas** (comunas/municipios) en PostGIS desde el GeoJSON del frontend, de
   forma idempotente (`seed_zones_on_startup`).
3. **Siembra inicial de datos** si la BD está vacía:
   - `sync_soda_incidents` → accidentes en `reports` (con fallback a 10 demo).
   - SIATA sync (`SiataSyncService`) → `flood_hazards`.
   - 4 alertas demo si no hay alertas activas (panel "LIVE ALERTS" no arranca vacío).
4. **Encola `weather.sync`** (Celery) para poblar el clima sin esperar al próximo *beat*
   de 15 min. Es resiliente: si Redis está caído, el arranque no falla.
5. **Inicia el listener de alertas** (Redis pub/sub `alerts:live` → WebSocket) como tarea
   en segundo plano.

Al apagar, cancela el listener y libera el pool de conexiones (`engine.dispose()`).

## 6.2 Ingesta y actualización periódica (Celery Beat)

`tasks/celery_app.py` programa las tareas recurrentes del sistema:

| Tarea | Frecuencia | Efecto |
|-------|-----------|--------|
| `siata.sync_flood_hazards` | cada 15 min | Niveles SIATA → `flood_hazards` |
| `weather.sync` | cada 15 min | Open-Meteo multipunto → `weather_snapshots` |
| `weather.generate_alerts` | cada 15 min | Genera alertas automáticas por condiciones climáticas |
| `air_quality.sync` | cada hora | WAQI → `air_quality_readings` |
| `weather_events.sync` | cada hora (min :30) | Eventos SIATA → `weather_events` |

Zona horaria del planificador: `America/Bogota`.

## 6.3 Flujo de alertas en tiempo real

```
weather.generate_alerts / weather_events.sync (worker Celery, proceso A)
   │  crea Alert en BD
   │  publish_alert() → canal Redis "alerts:live"
   ▼
listen_and_broadcast_alerts (lifespan FastAPI, proceso B)
   │  recibe del canal
   ▼
ConnectionManager.broadcast() → clientes WebSocket /ws/telemetry
```

El cruce de procesos vía Redis pub/sub es necesario porque el worker y el servidor web
no comparten memoria (ver patrón Pub/Sub en el documento 5).

## 6.4 Flujo de consulta (frontend → backend)

1. El frontend (mapa `CommandCenter` y dashboard) pide capas y agregados a los endpoints
   `/api/v1/public/*` a través de `src/static/js/services/api.js` y los hooks
   (`useWeather`, `useAccidentStats`).
2. El backend lee de las tablas PostGIS y devuelve **GeoJSON** (accidentes, zonas de
   inundación) o **agregados** (estadísticas de accidentalidad, clima, calidad del aire).
3. **Leaflet** pinta polígonos y marcadores sobre el mapa; **Chart.js** grafica los
   agregados en el dashboard.

## 6.5 Flujo de ruteo resiliente

```
GET /api/v1/routes?destination=lat,lng
   ▼
compute_route(db, origin, dest)
   │  traza la línea origen→destino
   │  consulta zonas de riesgo activas (flood_hazards watch/flooded
   │    + accident_zones con severity ≥ 3) vía PostGIS
   ▼
   ¿la línea cruza alguna zona?
     · No  → ruta directa
     · Sí  → inserta un waypoint perpendicular que rodea el obstáculo
             → devuelve coordenadas, distancia (haversine) y nº de zonas evitadas
```

## 6.6 Servido del frontend (un solo origen)

Tras montar la API, `main.py` sirve `frontend/dist` con fallback SPA: las rutas del
router (`/map`, `/dashboard`, etc.) devuelven `index.html`, mientras que los prefijos de
infraestructura (`api/`, `health`, `docs`, `redoc`, `openapi.json`) conservan su 404 real.
Esto permite desplegar backend + frontend como **una sola unidad**.

## 6.7 Capa PWA

- `manifest.webmanifest` define identidad, íconos (incl. *maskable*) y modo `standalone`.
- El **Service Worker** (`public/sw.js`, cache `pptmaps-v2`) usa *network-first* para
  navegación (cae al app-shell offline) y *cache-first* para estáticos del mismo origen.
  **Excluye** `api/`, `health`, `docs`, `redoc` y archivos de media.
- Se registra **solo en producción** (`import.meta.env.PROD`) para no interferir con el
  HMR de Vite en desarrollo.

---
