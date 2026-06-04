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

La fábrica `_create_siata_client()` hace una prueba rápida de conectividad y devuelve el
adaptador HTTP si SIATA responde, o el *seed* en caso contrario. El
`SiataSyncService`/`WeatherSyncService` reciben el cliente por constructor (inversión de
dependencias) y solo conocen la interfaz.

## 5.2 CQRS para telemetría de alta concurrencia

La escritura de telemetría separa el comando de la persistencia (`services/telemetry.py`):

- **Comando (rápido):** `enqueue_telemetry(redis, pings)` empuja el lote al buffer Redis
  (`LPUSH telemetry:buffer`). El endpoint `POST /telemetry` responde `202 Accepted` sin
  tocar Postgres.
- **Persistencia diferida:** la tarea Celery `telemetry.flush` ejecuta
  `flush_telemetry(db, redis)`, que drena el buffer de forma atómica
  (`LRANGE` + `DELETE` en pipeline transaccional) e inserta los pings en lote.

Esto absorbe ráfagas de pings GPS sin saturar la base de datos.

## 5.3 Repository / CRUD

Las operaciones de datos están aisladas en `app/crud/` (`crud_user`, `crud_report`,
`crud_vehicle`, `crud_alert`, `crud_accident_zone`, `crud_flood_hazard`). Los endpoints y
servicios no escriben SQL crudo de entidades: delegan en estas funciones, manteniendo el
acceso a datos desacoplado del transporte HTTP.

## 5.4 Inyección de dependencias (DI)

Vía `Depends` de FastAPI:

- `get_db` — sesión async con commit/rollback automático.
- `get_redis` — cliente Redis compartido (sobre-escribible con `fakeredis` en tests).
- `get_forecast_client` — provee el `ForecastClient` (intercambiable en tests).
- `require_api_key`, `get_current_user`, `require_role(...)` — dependencias de seguridad.

La DI es la pieza que hace testeable la arquitectura hexagonal: en los tests se
sobreescriben los proveedores con dobles de prueba (`app.dependency_overrides`).

## 5.5 Pub/Sub para cruzar la frontera de procesos

Los workers Celery viven en un proceso distinto al servidor FastAPI, así que **no pueden
llamar al `ConnectionManager` directamente**. El módulo `services/alert_broadcaster.py`
resuelve esto con **Redis pub/sub**:

1. El worker publica la alerta en el canal `alerts:live` (`publish_alert`).
2. Un listener arrancado en el `lifespan` de FastAPI (`listen_and_broadcast_alerts`)
   escucha ese canal y reenvía cada alerta a los clientes WebSocket vía `manager.broadcast`.

## 5.6 Singleton

`ConnectionManager` (`websocket/connection_manager.py`) se instancia una sola vez
(`manager = ConnectionManager()`) y es importado por `ws_router` y `notification`. Agrupa
las conexiones activas por canal y centraliza el `broadcast`.

## 5.7 Factory de autorización

`require_role(*roles)` (`api/deps.py`) es una **fábrica de dependencias**: devuelve un
`role_checker` configurado con los roles permitidos, que FastAPI inyecta en los endpoints
protegidos.

## 5.8 Seguridad por diseño

- **JWT / OAuth2** (`OAuth2PasswordBearer`) para usuarios; contraseñas con `bcrypt`
  (passlib).
- **API key** para máquinas (ingesta de telemetría) validada con
  `secrets.compare_digest` — comparación de **tiempo constante** para evitar *timing
  attacks*. El header `X-API-Key` usa `auto_error=False` para devolver un `401` explícito.

## 5.9 Funciones puras y testabilidad

- `parse_zones(data)` (`services/zones_seed.py`) normaliza el GeoJSON **sin tocar la BD**:
  es una función pura, testeable de forma aislada. `import_zones` se encarga del efecto
  de lado (persistir con upsert por `kind+slug`).
- La lógica de negocio de las tareas Celery (`detect_overspeed`, `cluster_accident_hotspots`,
  los `sync`) vive en funciones `async` independientes; los tasks son envoltorios finos.

## 5.10 Resiliencia (fallback / idempotencia)

- **Fallback de fuentes:** SIATA y la ingesta de accidentes degradan a datos *seed* si la
  API externa falla, para que la demo nunca arranque vacía.
- **Idempotencia:** la siembra de zonas y la ingesta de accidentes (`ON CONFLICT
  (llave) DO NOTHING`, upsert por `siata_station_id`/`kind+slug`) se pueden re-ejecutar
  sin duplicar.
- **Arranque tolerante a fallos:** encolar `weather.sync` al inicio no rompe el arranque
  si Redis está caído (se captura la excepción y se loguea un *warning*).

## 5.11 Machine Learning — clustering geoespacial en la BD

`ml/dbscan_clustering.py` usa **`ST_ClusterDBSCAN` nativo de PostGIS** en lugar de
sklearn: el agrupamiento espacial se hace *in-place* en la base de datos, sin mover los
puntos a Python ni traer numpy/scipy. Cada cluster genera una zona en `accident_zones`
(casco convexo + buffer).

> Estado real del ML: `ml/dbscan_clustering.py` está **implementado y operativo**;
> `ml/predict_traffic.py` está **vacío** (0 bytes) — la predicción de tráfico (XGBoost)
> que menciona el README está como trabajo futuro.

---


