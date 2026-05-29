# Librerías usadas en tppmaps / MoviMed

## Cliente (navegador)

| Librería | Versión | Uso |
|----------|---------|-----|
| **Leaflet** | 1.9.4 (CDN) | Mapa interactivo, capas, marcadores, rutas |
| **Carto Dark** (tiles) | CDN CARTO/OSM | Mapa base oscuro sin API key |
| **Google Fonts** | — | JetBrains Mono, Orbitron |
| **JavaScript ES Modules** | nativo | Sin React/Vue; módulos propios |

No usamos npm en el cliente: carga directa por CDN + módulos en `cliente/estatico/js/`.

## Servidor (Python)

| Librería | Uso |
|----------|-----|
| **FastAPI** | API REST asíncrona, Swagger `/docs` |
| **Uvicorn** | Servidor ASGI |
| **Pydantic / pydantic-settings** | Validación y variables `.env` |
| **SQLAlchemy** | ORM (opcional, cuando `VERIFICAR_BD=true`) |
| **httpx** | Cliente HTTP para SIATA/MEData (futuro) |

### Producción (Docker Compose)

| Servicio | Imagen | Uso |
|----------|--------|-----|
| **PostgreSQL + PostGIS** | postgis/postgis:16 | Geometrías, rutas, reportes |
| **Redis** | redis:7 | Caché telemetría, broker Celery |
| **Celery** | (futuro) | Tareas SIATA cada 2 min |

## Conexión sin depender de localhost

1. Levanta con Docker: `docker compose -f docker/docker-compose.yml up`
2. Accede desde otra máquina: `http://IP-DE-TU-PC:8000/`
3. En `.env`: `ORIGENES_CORS=*` o tu dominio
4. La API usa rutas **relativas** (`/api/v1/...`) — mismo host que sirve el cliente

Si el frontend está en otro dominio:

```html
<script>window.TPPMAPS_API = 'https://api.tudominio.com/api/v1';</script>
```
