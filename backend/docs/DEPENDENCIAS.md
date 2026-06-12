# Dependencias — PPTMaps Backend

> Para qué se usa cada paquete en el proyecto.

---

## Core Framework

| Paquete | Uso en PPTMaps |
|---------|----------------|
| `fastapi` | Framework web asíncrono. Define la API REST, WebSockets, validación de rutas, inyección de dependencias. |

## Configuración

| Paquete | Uso |
|---------|-----|
| `pydantic` | Schemas de validación de entrada/salida en todos los endpoints. Modelos de configuración. |
| `pydantic-settings` | Carga `.env` y expone `settings` tipado (`app/core/config.py`). |

## Base de Datos

| Paquete | Uso |
|---------|-----|
| `SQLAlchemy` | ORM asíncrono para todos los modelos (`app/models/`) y operaciones CRUD (`app/crud/`). |
| `asyncpg` | Driver PostgreSQL asíncrono — la URI `postgresql+asyncpg://` lo usa SQLAlchemy en runtime. |
| `GeoAlchemy2` | Extensión geoespacial: mapea columnas PostGIS (POINT, POLYGON, GEOMETRY) a SQLAlchemy. Usa Shapely para operaciones geométricas. |
| `alembic` | Migraciones de base de datos — 12 migraciones en `alembic/versions/`. |

## Seguridad

| Paquete | Uso |
|---------|-----|
| `passlib` | Hashing de contraseñas con bcrypt en `app/core/security.py`. Usado por `crud_user.py`. |
| `python-jose` | Creación/verificación de tokens JWT en `app/core/security.py`. |

## HTTP Client

| Paquete | Uso |
|---------|-----|
| `httpx` | Cliente HTTP asíncrono para todas las integraciones externas: SIATA, Open-Meteo, WAQI. Usado en 6 servicios. |

## Tareas en Segundo Plano

| Paquete | Uso |
|---------|-----|
| `celery` | Cola de tareas distribuidas + Beat scheduler. 5 tareas periódicas (SIATA sync, weather sync, air quality sync, weather events, weather alerts). |
| `redis` | Broker de Celery, caché de pronóstico, buffer pub/sub para alertas en vivo. |
| `nest-asyncio` | Permite `asyncio.run()` dentro de tareas Celery (que corren en su propio event loop). Aplicado dentro de cada tarea en `cron_jobs.py`. |

## Data Processing

| Paquete | Uso |
|---------|-----|
| `openpyxl` | Lectura del dataset XLSX de accidentalidad (702k registros) en `scripts/ingest_accidents.py`. |

## Machine Learning

| Paquete | Uso |
|---------|-----|


## Rate Limiting

| Paquete | Uso |
|---------|-----|
| `slowapi` | Rate limiting por IP (5 reportes/hora) en endpoints de reportes ciudadanos. Middleware global en `main.py`. |

## Testing

| Paquete | Uso |
|---------|-----|
| `pytest` | Runner de tests. |
| `pytest-asyncio` | Soporte para fixtures y tests asíncronos. |
| `fakeredis` | Mock de Redis en memoria para tests que usan Redis sin conexión real. |

---

> **Nota**: Dependencias como `uvicorn`, `python-multipart`, `python-dotenv`, `psycopg2-binary`, `bcrypt`, `websockets`, `pandas`, `numpy`, `scikit-learn`, `xgboost`, `joblib` y `anyio` fueron eliminadas porque no se importan directamente en el código. Algunas son transitivas de FastAPI/Starlette y se instalan igual sin estar listadas.
