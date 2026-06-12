# 5. Patrones de Diseño Implementados

## 5.1 Arquitectura hexagonal (puertos y adaptadores)

Las integraciones externas dependen de **interfaces abstractas** (`ABC`), no de fuentes
concretas. Esto permite intercambiar implementaciones reales por *seeds*/fakes sin tocar
la lógica de negocio ni golpear APIs externas en los tests.

| Puerto (interfaz) | Adaptadores | Archivo |
|-------------------|-------------|---------|
| `SiataGaugeClient` | `SiataHttpClient` (real) · `SiataSeedClient` (respaldo) | `services/siata_sync.py` |
| `WeatherClient` | `OpenMeteoClient` (multipunto) | `services/weather.py` |
| `ForecastClient` | `OpenMeteoForecastClient` (pronóstico detallado) | `services/weather.py` |
| `AirQualityClient` | `WaqiHttpClient` (real) | `services/air_quality_sync.py` |
| `WeatherEventClient` | `SiataEventosHttpClient` (real) | `services/weather_event_sync.py` |

La fábrica `_create_siata_client()` hace una prueba rápida de conectividad y devuelve el
adaptador HTTP si SIATA responde, o el *seed* en caso contrario. Los servicios
(`SiataSyncService`, `WeatherSyncService`, `AirQualitySyncService`) reciben el cliente por
constructor (inversión de dependencias) y solo conocen la interfaz.

## 5.2 Repository / CRUD

Las operaciones de datos están aisladas en `app/crud/` (`crud_user`, `crud_report`,
`crud_alert`, `crud_accident_zone`, `crud_flood_hazard`). Los endpoints y servicios no
escriben SQL crudo de entidades: delegan en estas funciones, manteniendo el acceso a datos
desacoplado del transporte HTTP.

## 5.3 Inyección de dependencias (DI)

Vía `Depends` de FastAPI:

- `get_db` — sesión async con commit/rollback automático.
- `get_redis` — cliente Redis compartido (sobre-escribible con `fakeredis` en tests).
- `get_forecast_client` — provee el `ForecastClient` (intercambiable en tests).

La DI es la pieza que hace testeable la arquitectura hexagonal: en los tests se
sobreescriben los proveedores con dobles de prueba (`app.dependency_overrides`).

## 5.4 Pub/Sub para cruzar la frontera de procesos

Los workers Celery viven en un proceso distinto al servidor FastAPI, así que **no pueden
llamar al `ConnectionManager` directamente**. El módulo `services/alert_broadcaster.py`
resuelve esto con **Redis pub/sub**:

1. El worker publica la alerta en el canal `alerts:live` (`publish_alert`).
2. Un listener arrancado en el `lifespan` de FastAPI (`listen_and_broadcast_alerts`)
   escucha ese canal y reenvía cada alerta a los clientes WebSocket vía `manager.broadcast`.

## 5.5 Singleton

`ConnectionManager` (`websocket/connection_manager.py`) se instancia una sola vez
(`manager = ConnectionManager()`) y es importado por `ws_router` y `notification`. Agrupa
las conexiones activas por canal y centraliza el `broadcast`.

## 5.6 Funciones puras y testabilidad

- `parse_zones(data)` (`services/zones_seed.py`) normaliza el GeoJSON **sin tocar la BD**:
  es una función pura, testeable de forma aislada. `import_zones` se encarga del efecto
  de lado (persistir con upsert por `kind+slug`).
- La lógica de negocio de las tareas Celery (`cluster_accident_hotspots`, los `sync`) vive
  en funciones `async` independientes; los tasks son envoltorios finos.

## 5.7 Resiliencia (fallback / idempotencia)

- **Fallback de fuentes:** SIATA y la ingesta de accidentes degradan a datos *seed* si la
  API externa falla, para que la demo nunca arranque vacía.
- **Idempotencia:** la siembra de zonas y la ingesta de accidentes (`ON CONFLICT
  (llave) DO NOTHING`, upsert por `siata_station_id`/`kind+slug`) se pueden re-ejecutar
  sin duplicar.
- **Arranque tolerante a fallos:** encolar `weather.sync` al inicio no rompe el arranque
  si Redis está caído (se captura la excepción y se loguea un *warning*).

## 5.8 Machine Learning — clustering geoespacial en la BD

`ml/dbscan_clustering.py` usa **`ST_ClusterDBSCAN` nativo de PostGIS** en lugar de
sklearn: el agrupamiento espacial se hace *in-place* en la base de datos, sin mover los
puntos a Python ni traer numpy/scipy. Cada cluster genera una zona en `accident_zones`
(casco convexo + buffer).

> Estado real del ML: `ml/dbscan_clustering.py` está **implementado y operativo**;
> `ml/predict_traffic.py` está **vacío** (0 bytes) — la predicción de tráfico (XGBoost)
> que menciona el README está como trabajo futuro.

---
