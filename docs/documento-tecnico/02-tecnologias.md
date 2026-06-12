# 2. Tecnologías Utilizadas

## 2.1 Backend (Python)

| Categoría | Paquete | Versión (requirements.txt) |
|-----------|---------|----------------------------|
| Framework | `fastapi` | `>=0.115.0` |
| Servidor ASGI | `uvicorn[standard]` | `>=0.34.0` |
| Rate limiting | `slowapi` | `>=0.1.9` |
| Multipart | `python-multipart` | `>=0.0.12` |
| Validación | `pydantic` | `>=2.10.0` |
| Configuración | `pydantic-settings` | `>=2.6.0` |
| Entorno | `python-dotenv` | `>=1.0.1` |
| ORM | `SQLAlchemy` (async) | `>=2.0.36` |
| Driver PostgreSQL | `asyncpg` | `>=0.30.0` |
| Geoespacial | `GeoAlchemy2[shapely]` | `>=0.15.0` |
| Migraciones | `alembic` | `>=1.14.0` |
| Tiempo real | `websockets` | `>=14.0` |
| Cola de tareas | `celery` | `>=5.4.0` |
| Cache / broker | `redis` | `>=5.2.0` |
| Async compat | `nest-asyncio` | `>=1.6.0` |

**Testing:** `pytest>=8.3`, `pytest-asyncio>=0.24`, `httpx>=0.28`, `anyio>=4.7`,
`fakeredis>=2.26`.

**Dependencias adicionales presentes en el código** (vía extras o transitivamente):
`shapely` (geometría en `routing.py`, `siata_sync.py`), `openpyxl` (lectura del XLSX de
accidentes en `scripts/ingest_accidents.py`).

> El driver de base de datos es **`asyncpg`** (no `psycopg2`): la URI es
> `postgresql+asyncpg://...` y todo el acceso a datos es asíncrono.

## 2.2 Frontend (Node / npm)

### Dependencias de runtime

| Paquete | Versión (package.json) |
|---------|------------------------|
| `react` | `^19.2.6` |
| `react-dom` | `^19.2.6` |
| `react-router-dom` | `^7.16.0` |
| `chart.js` | `^4.5.1` |
| `react-chartjs-2` | `^5.3.1` |
| `gsap` | `^3.15.0` |
| `react-icons` | `^5.6.0` |

### Dependencias de desarrollo

| Paquete | Versión |
|---------|---------|
| `vite` | `^8.0.14` |
| `@vitejs/plugin-react` | `^6.0.2` |
| `tailwindcss` | `^4.3.0` |
| `@tailwindcss/postcss` | `^4.3.0` |
| `autoprefixer` | `^10.5.0` |
| `postcss` | `^8.5.15` |

### Leaflet — vía CDN, no npm

**Leaflet 1.9.4 NO es una dependencia de npm.** Se carga por CDN (unpkg) en
`frontend/index.html`:

```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" ... />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" ...></script>
```

El objeto global `L` queda disponible para el servicio de mapas
(`src/static/js/map/map-service.js`).

## 2.3 Base de datos y geoespacial

- **PostgreSQL** con la extensión **PostGIS** (creada en la migración inicial con
  `CREATE EXTENSION IF NOT EXISTS postgis`).
- **GeoAlchemy2** mapea las columnas `Geometry` de SQLAlchemy a tipos PostGIS.
- CRS de almacenamiento: **EPSG:4326** (WGS84) en todas las geometrías.

## 2.4 Infraestructura y herramientas

- **Docker / docker-compose**: `backend/docker-compose.yml` (stack) y
  `backend/docker-compose.test.yml` (BD de pruebas aislada), más `backend/Dockerfile`.
- **Scripts de arranque**: `start.sh` (Linux), `start.bat` (Windows), `backend/run.sh`.
- **PWA**: `manifest.webmanifest` + Service Worker manual (`public/sw.js`).

## 2.5 Notas de versión

- El README muestra un badge "FastAPI 0.111"; el requisito real es **`fastapi>=0.115.0`**.
- El stack frontend usa versiones de vanguardia (React 19, Vite 8, Tailwind 4). Por eso
  la PWA es **manual**: `vite-plugin-pwa` aún no soporta Vite 8
  (issue `vite-pwa/vite-plugin-pwa#923`), documentado en el propio `sw.js`.

---
