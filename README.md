<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/PPTMaps-Inteligencia%20Geoespacial-1a5c3a?style=for-the-badge&logo=matrix&logoColor=white&labelColor=0d1117">
    <img alt="PPTMaps" src="https://img.shields.io/badge/PPTMaps-Inteligencia%20Geoespacial-1a5c3a?style=for-the-badge&logo=matrix&logoColor=white&labelColor=ffffff">
  </picture>
</p>

<p align="center">
  <img alt="Python" src="https://img.shields.io/badge/Python-3.12+-3776AB?style=flat&logo=python&logoColor=white">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-0.111-009688?style=flat&logo=fastapi&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646CFF?style=flat&logo=vite&logoColor=white">
  <img alt="Tailwind" src="https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat&logo=tailwindcss&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16+-4169E1?style=flat&logo=postgresql&logoColor=white">
  <img alt="PostGIS" src="https://img.shields.io/badge/PostGIS-3.5-4169E1?style=flat&logo=postgresql&logoColor=white">
  <img alt="Redis" src="https://img.shields.io/badge/Redis-7-DC382D?style=flat&logo=redis&logoColor=white">
  <img alt="Celery" src="https://img.shields.io/badge/Celery-5.4-37814A?style=flat&logo=celery&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-yellow?style=flat">
</p>

<p align="center">
  <strong>Plataforma de Movilidad Inteligente para Medellín · HackData CTGI SENA 2026</strong>
</p>

<br>

---

## ¿Qué es PPTMaps?

**PPTMaps** es una plataforma de inteligencia geoespacial que integra datos oficiales de movilidad de Medellín con reportes ciudadanos en tiempo real. Consume fuentes gubernamentales (SIATA, MEData, Open-Meteo), los cachea y optimiza en PostGIS, y los expone mediante una API REST + WebSockets a un dashboard interactivo construido en React.

### Problemas que resuelve

| Problema | Solución PPTMaps |
|---|---|
| APIs oficiales lentas y sin filtros espaciales | Cache inteligente en PostGIS con queries geoespaciales optimizadas |
| Datos de movilidad dispersos en múltiples fuentes | Unificación en un solo backend con API coherente |
| Sin alertas en tiempo real para incidentes viales | WebSockets + Celery + `alert_broadcaster` para notificaciones push |
| Reportes ciudadanos no digitalizados | Formulario público con geolocalización y soporte multimedia |
| Sin información climática integrada | Proxy Open-Meteo con caché Redis y widget en el dashboard |

---

## Stack Tecnológico

```
FRONTEND                     BACKEND                        BASE DE DATOS
+-----------------+        +---------------------+        +------------------+
|   React 19      |        |   FastAPI           |        |   PostgreSQL 16+ |
|   Vite 8        | -----> |   Uvicorn           | -----> |   PostGIS 3.5    |
|   Tailwind 4    |  HTTP  |   Pydantic v2       |  SQL   |   Redis 7        |
|   Leaflet       | <----  |   SQLAlchemy 2.0    | <----  |                  |
|   React Router  |  REST  |   AsyncPG           |        +------------------+
|   React Icons   |   WS   |   Celery + Beat     |
|   GSAP          |        |   WebSockets        |        +------------------+
+-----------------+        |   Alembic           |        |   APIs Externas  |
                           |   JWT / OAuth2      | -----> |   SIATA          |
                           +---------------------+        |   MEData         |
                                                          |   Open-Meteo     |
                                                          +------------------+
```

---

## Arquitectura del Proyecto

```text
PPTMaps/
├── backend/                        # API REST en FastAPI
│   ├── alembic/                    # Migraciones de base de datos
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── endpoints/
│   │   │       │   ├── auth.py             # Login / Registro JWT
│   │   │       │   ├── users.py            # CRUD de usuarios
│   │   │       │   ├── reports.py          # Reportes ciudadanos
│   │   │       │   ├── public.py           # Endpoints públicos (geográficos)
│   │   │       │   ├── vehicles.py         # Gestión de vehículos
│   │   │       │   └── routes.py           # Optimización de rutas
│   │   │       └── router.py
│   │   ├── core/                   # Configuración central y seguridad
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   └── exceptions.py
│   │   ├── db/                     # Capa de datos asíncrona
│   │   │   ├── base.py
│   │   │   ├── base_class.py
│   │   │   └── database.py
│   │   ├── models/                 # Modelos SQLAlchemy + PostGIS
│   │   │   ├── user.py
│   │   │   ├── report.py
│   │   │   ├── accident_zone.py
│   │   │   ├── flood_hazard.py
│   │   │   ├── vehicle.py
│   │   │   ├── telemetry.py
│   │   │   └── alert.py
│   │   ├── schemas/                # Validadores Pydantic v2
│   │   ├── crud/                   # Operaciones atómicas de BD
│   │   ├── services/               # Lógica de negocio e integraciones
│   │   │   ├── alert_broadcaster.py  # ★ Broadcast de alertas via WebSocket
│   │   │   ├── ingestion.py          # Ingesta MEData
│   │   │   ├── siata_sync.py         # Sincronización SIATA
│   │   │   ├── weather.py            # Proxy Open-Meteo con caché Redis
│   │   │   ├── telemetry.py          # Telemetría en tiempo real
│   │   │   ├── notification.py       # Notificaciones externas
│   │   │   └── routing.py            # Motor de cálculo de rutas
│   │   ├── tasks/                  # Tareas Celery
│   │   │   ├── celery_app.py
│   │   │   ├── worker.py
│   │   │   └── cron_jobs.py        # Tareas programadas (beat)
│   │   ├── ml/                     # Módulos de IA / Data Science
│   │   │   ├── predict_traffic.py
│   │   │   └── dbscan_clustering.py
│   │   └── main.py                 # Entrada FastAPI
│   ├── tests/
│   ├── seed_demo.py                # Datos de demostración
│   ├── .env.example
│   └── requirements.txt
│
├── frontend/                       # Dashboard React + Vite
│   ├── public/
│   └── src/
│       ├── components/             # Componentes reutilizables de UI
│       ├── hooks/                  # Custom React hooks
│       ├── pages/
│       │   ├── Landing.jsx         # ★ Landing page con mapa en vivo
│       │   ├── CommandCenter.jsx   # Dashboard de comando geoespacial
│       │   ├── Report.jsx          # Formulario de reporte ciudadano
│       │   └── Navigate.jsx        # Navegación y rutas
│       ├── static/
│       │   ├── css/tppmaps.css     # Estilos del mapa Leaflet
│       │   └── js/ui/alerts.js     # ★ Lógica WebSocket de alertas en vivo
│       ├── App.jsx
│       ├── main.jsx
│       └── index.css
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── start.sh                        # Script de inicio Linux (backend + frontend)
├── start.bat                       # Script de inicio Windows
└── README.md
```

---

## Endpoints de la API

```
Método  Ruta                              Descripción
------  --------------------------------  -------------------------------------
GET     /health                           Health check
GET     /health/db                        Verificación de base de datos

                    -- Autenticación --
POST    /api/v1/auth/register             Registrar nuevo usuario
POST    /api/v1/auth/login                Iniciar sesión (JWT)

                    -- Usuarios --
GET     /api/v1/users/                    Listar usuarios (auth)
GET     /api/v1/users/me                  Mi perfil
GET     /api/v1/users/{id}                Usuario por ID
PUT     /api/v1/users/{id}                Actualizar usuario

                    -- Reportes Ciudadanos --
POST    /api/v1/reports/                  Crear reporte (auth)
GET     /api/v1/reports/                  Listar reportes (auth)
GET     /api/v1/reports/{id}              Reporte por ID
PUT     /api/v1/reports/{id}              Actualizar reporte

                    -- Endpoints Públicos --
GET     /api/v1/public/reports            Reportes públicos
GET     /api/v1/public/accidents          Accidentes geolocalizados
GET     /api/v1/public/accident-zones     Zonas de accidentalidad
GET     /api/v1/public/fatalities         Incidentes fatales
GET     /api/v1/public/flood-zones        Zonas de inundación
GET     /api/v1/public/nearby             Búsqueda geográfica cercana
GET     /api/v1/public/stats              Estadísticas generales

                    -- Clima --
GET     /api/v1/weather/forecast          Pronóstico Open-Meteo (proxy con caché)

                    -- Vehículos --
GET     /api/v1/vehicles/                 Listar vehículos
POST    /api/v1/vehicles/                 Registrar vehículo
GET     /api/v1/vehicles/{id}             Vehículo por ID
PUT     /api/v1/vehicles/{id}             Actualizar vehículo
DELETE  /api/v1/vehicles/{id}             Eliminar vehículo

                    -- WebSockets --
WS      /api/v1/ws/telemetry              Streaming de datos en tiempo real
WS      /api/v1/ws/alerts                 ★ Alertas en vivo (broadcast)
```

Documentación interactiva: `http://localhost:8000/docs` (Swagger UI)

---

## Inicio Rápido

### Linux (script automatizado)

```bash
# 1. Clonar el repositorio
git clone https://github.com/DylanOsdev/PPTMaps.git
cd PPTMaps

# 2. Copiar y configurar variables de entorno
cp backend/.env.example backend/.env

# 3. Ejecutar el stack completo
chmod +x start.sh
./start.sh
```

El script `start.sh` inicializa automáticamente el entorno virtual, instala dependencias, aplica migraciones y levanta backend + frontend.

### Paso a paso (manual)

```bash
# --- Backend ---
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Crear la base de datos
sudo -u postgres psql -c "CREATE DATABASE movimed;"

# Aplicar migraciones (PostGIS + esquema completo)
alembic upgrade head

# Opcional: cargar datos de demo
python seed_demo.py

# Iniciar API
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# --- Frontend (nueva terminal) ---
cd frontend
npm install
npm run dev
```

### Windows

```powershell
.\start.bat
```

---

## Fuentes de Datos

```
  +--------+     +--------+     +------------+     +-----------+
  | SIATA  |     | MEData |     | Open-Meteo |     | Ciudadanos|
  +--------+     +--------+     +------------+     +-----------+
       |              |               |                   |
       v              v               v                   v
  +----------------------------------------------------------+
  |                  PostGIS + Redis (cache)                 |
  +----------------------------------------------------------+
                            |
                            v
                     +------------+
                     |  FastAPI   |
                     +------------+
                    /      |      \
                   v       v       v
            +--------+ +------+ +-------+
            |Frontend| | REST | |  WS   |
            +--------+ +------+ +-------+
```

1. **SIATA** — Sistema de Alerta Temprana de Medellín. Niveles en tiempo real del Río Medellín y quebradas para polígonos de riesgo de inundación.
2. **MEData** — Portal de Datos Abiertos de la Alcaldía de Medellín. Incidentes viales y geometría de la malla vial.
3. **Open-Meteo** — Pronóstico meteorológico libre servido como proxy desde el backend con caché Redis.
4. **Reportes Ciudadanos** — Reportes en tiempo real ingresados por usuarios de la plataforma.

---

## Funcionalidades Destacadas

-  **Mapa interactivo en vivo** con Leaflet — capas de accidentes, zonas de inundación y reportes
-  **Alertas en tiempo real** via WebSockets con broadcast automático (`alert_broadcaster.py`)
-  **Widget de clima** integrado con datos de Open-Meteo (proxy backend + caché Redis)
-  **Reportes ciudadanos** geolocalizados con formulario público
-  **Dashboard de comando** con estadísticas y telemetría en tiempo real
-  **Autenticación JWT** con roles y permisos
-  **ML en desarrollo**: clustering DBSCAN de zonas de accidentalidad + predicción de tráfico XGBoost

---

## ML & Analítica

```
Motor de Machine Learning (en desarrollo)

  DBSCAN Clustering    ->  Zonas calientes de accidentes
  Predicción Tráfico   ->  Modelo temporal XGBoost
  Flood Forecasting    ->  Alertas tempranas de crecidas
  Dashboard Analítico  ->  Estadísticas en tiempo real
```

---

## Variables de Entorno

```env
# Proyecto
PROJECT_NAME="PPTMaps API"
API_V1_STR="/api/v1"

# Base de Datos
POSTGRES_SERVER=localhost
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=movimed
POSTGRES_PORT=5432

# Redis / Celery
REDIS_URL=redis://localhost:6379/0

# JWT
SECRET_KEY=cambia_esta_clave_en_produccion
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# CORS
BACKEND_CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]
```

---

## Tests

```bash
cd backend
source venv/bin/activate
pytest -v --cov=app --cov-report=term-missing
```

---

## Contribuir

1. Fork el repositorio
2. Crea tu rama: `git checkout -b feature/algo-increible`
3. Commit: `git commit -m 'feat: agrega algo increible'`
4. Push: `git push origin feature/algo-increible`
5. Abre un Pull Request

---

## Licencia

**MIT** — Libre uso para fines académicos y de competencia.

---

<p align="center">
  <sub>Desarrollado para el Hackathon HackData CTGI SENA 2026</sub>
  <br>
  <strong>Medellín, Colombia 🇨🇴</strong>
</p>

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=1a5c3a:2d9e5e:3db84f&height=120&section=footer" width="100%">
</p>
