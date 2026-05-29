# Encarpetado tppmaps / MoviMed

## Vista general

```
ttpmap/
├── frontend/          # Presentación (HTML, CSS, JS)
├── backend/           # API FastAPI (DDD / Clean Architecture)
├── docker/            # Contenedores producción
├── docs/              # Documentación
├── scripts/           # Utilidades desarrollo
└── index.html         # Redirección → frontend/
```

## Frontend — capas

| Carpeta | Responsabilidad |
|---------|-----------------|
| `static/js/config` | Constantes y URLs |
| `static/js/core` | Estado y utilidades |
| `static/js/map` | Leaflet, comunas, capas |
| `static/js/services` | HTTP API, geocoding |
| `static/js/ui` | DOM, alertas, responsive |
| `assets/data` | Datos geográficos JSON |

## Backend — capas (escalable)

| Carpeta | Responsabilidad |
|---------|-----------------|
| `api/v1/endpoints` | Controladores HTTP |
| `schemas` | Validación Pydantic |
| `services` | Lógica de negocio |
| `models` | SQLAlchemy + PostGIS |
| `core` | Config, seguridad, errores |

### Próximos módulos (producción)

```
backend/app/
├── ml/                 # predict_traffic, dbscan_clustering
├── tasks/              # Celery + cron SIATA
└── tests/              # pytest
```

## Principios aplicados

- **Separación frontend/backend** — despliegue independiente.
- **Módulos ES6** — un archivo, una responsabilidad.
- **Datos fuera del código** — `medellin-comunas.json`.
- **API versionada** — `/api/v1/`.
- **Config por entorno** — `.env` + `pydantic-settings`.
