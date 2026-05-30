<p align="center">
  <picture>
    <source media="(prefers-color-scheme: green)" srcset="https://img.shields.io/badge/TPPMAPS-Inteligencia%20Geoespacial-1a5c3a?style=for-the-badge&logo=matrix&logoColor=white&labelColor=0d1117">
    <img alt="TPPMAPS" src="https://img.shields.io/badge/TPPMAPS-Inteligencia%20Geoespacial-1a5c3a?style=for-the-badge&logo=matrix&logoColor=white&labelColor=ffffff">
  </picture>
</p>

<p align="center">
  <img alt="Python" src="https://img.shields.io/badge/Python-3.14-3776AB?style=flat&logo=python&logoColor=white">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-0.111-009688?style=flat&logo=fastapi&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-18-4169E1?style=flat&logo=postgresql&logoColor=white">
  <img alt="PostGIS" src="https://img.shields.io/badge/PostGIS-3.5-4169E1?style=flat&logo=postgresql&logoColor=white">
  <img alt="Redis" src="https://img.shields.io/badge/Redis-7-DC382D?style=flat&logo=redis&logoColor=white">
  <img alt="Celery" src="https://img.shields.io/badge/Celery-5.4-37814A?style=flat&logo=celery&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646CFF?style=flat&logo=vite&logoColor=white">
  <img alt="Tailwind" src="https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat&logo=tailwindcss&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-yellow?style=flat">
</p>

<p align="center">
  <strong>Movilidad Inteligente para Medellin HackData CTGI SENA 2026</strong>
</p>

<br>


---

## Stack Tecnologico

```
FRONTEND                     BACKEND                        BASE DE DATOS
+-----------------+        +---------------------+        +------------------+
|   React 19      |        |   FastAPI           |        |   PostgreSQL 18  |
|   Vite 8        | ---->  |   Uvicorn           | ---->  |   PostGIS 3.5    |
|   Tailwind 4    |  HTTP  |   Pydantic          |  SQL   |   Redis 7        |
|   GSAP          | <----  |   SQLAlchemy 2.0    | <----  |                  |
|   Leaflet       |  REST  |   AsyncPG           |        +------------------+
|   React Router  |        |   Celery            |
|   React Icons   |        |   WebSockets        |        +------------------+
+-----------------+        |   Alembic           |        |   APIs Externas  |
                           |   JWT / OAuth2      | ---->  |   SIATA          |
                           +---------------------+        |   MEData         |
                                                          |   Open Data      |
                                                          +------------------+
```

---

## Vistazo General

**PPTMaps** es una plataforma de inteligencia geoespacial que integra datos oficiales de movilidad de Medellin con reportes ciudadanos en tiempo real. Consume datos de APIs gubernamentales (SIATA, MEData), los optimiza y cachea en PostGIS, y los expone mediante una API REST + WebSockets para dashboards interactivos.

### Que resuelve?

| Problema | Solucion PPTMaps |
|---|---|
| APIs oficiales lentas y sin filtros geoespaciales | Cache inteligente en PostGIS con queries espaciales optimizadas |
| Datos de movilidad dispersos en multiples fuentes | Unificacion en un solo backend con una API coherente |
| Sin alertas en tiempo real para incidentes viales | WebSockets + Celery para notificaciones push instantaneas |
| Reportes ciudadanos no digitalizados | Formulario publico con geolocalizacion y foto |

---

## Arquitectura del Proyecto

```text
TTPMaps/
├── backend/                        # API REST en FastAPI
│   ├── alembic/                    # Migraciones de la base de datos
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/                 # Endpoints versión 1
│   │   │       ├── endpoints/
│   │   │       │   ├── auth.py             # Login / Registro JWT
│   │   │       │   ├── users.py            # CRUD de usuarios
│   │   │       │   ├── reports.py          # Reportes ciudadanos
│   │   │       │   ├── public.py           # Endpoints públicos (geográficos)
│   │   │       │   ├── vehicles.py         # Gestión de vehículos
│   │   │       │   └── routes.py           # Optimización de rutas
│   │   │       └── router.py       # Agrupador de rutas v1
│   │   ├── core/                   # Configuración central y seguridad
│   │   │   ├── config.py           # Settings con Pydantic
│   │   │   ├── security.py         # JWT, hashing, autenticación
│   │   │   └── exceptions.py       # Manejador global de errores
│   │   ├── db/                     # Capa de datos (Conexión asíncrona)
│   │   │   ├── base.py             # Import consolidado de modelos (para Alembic)
│   │   │   ├── base_class.py       # DeclarativeBase de SQLAlchemy 2.0
│   │   │   └── database.py         # Engine asíncrono (asyncpg) y sesión
│   │   ├── models/                 # Modelos SQLAlchemy + PostGIS
│   │   │   ├── user.py             # Usuarios y roles
│   │   │   ├── report.py           # Reportes ciudadanos
│   │   │   ├── accident_zone.py    # Zonas de accidentalidad
│   │   │   ├── flood_hazard.py     # Riesgos de inundación (SIATA)
│   │   │   ├── vehicle.py          # Vehículos registrados
│   │   │   ├── telemetry.py        # Telemetría en tiempo real
│   │   │   └── alert.py            # Alertas y notificaciones
│   │   ├── schemas/                # Validadores de datos (Pydantic)
│   │   │   ├── user.py             # Schemas de usuario
│   │   │   ├── report.py           # Schemas de reportes
│   │   │   ├── token.py            # Schemas JWT
│   │   │   └── route.py            # Schemas de rutas
│   │   ├── crud/                   # Operaciones atómicas de BD (Select, Insert, etc.)
│   │   ├── services/               # Lógica de negocio e integraciones de datos
│   │   │   ├── ingestion.py        # Ingesta de datos de MEData
│   │   │   ├── siata_sync.py       # Sincronización API SIATA
│   │   │   ├── notification.py     # Servicio de notificaciones externas
│   │   │   └── routing.py          # Motor/Algoritmo de cálculo de rutas
│   │   ├── websocket/              # Controladores de conexiones en tiempo real
│   │   ├── tasks/                  # Tareas asíncronas en segundo plano (Celery)
│   │   │   ├── celery_app.py       # Configuración e instancia de Celery
│   │   │   ├── worker.py           # Definición de tareas / Workers
│   │   │   └── cron_jobs.py        # Tareas programadas recurrentes
│   │   ├── ml/                     # Módulos de Inteligencia Artificial / Data Science
│   │   │   ├── predict_traffic.py  # Predicción de tráfico y congestión
│   │   │   ├── dbscan_clustering.py# Clusterización espacial de accidentes
│   │   │   └── models/             # Artefactos y binarios de modelos entrenados
│   │   └── main.py                 # Archivo de entrada de FastAPI
│   ├── tests/                      # Pruebas unitarias y de integración (pytest)
│   ├── .env.example                # Variables de entorno de muestra
│   └── requirements.txt            # Dependencias de Python
│
├── frontend/                       # Dashboard Web (React + Vite)
│   ├── public/                     # Assets estáticos globales
│   ├── src/                        # Código fuente de la aplicación
│   │   ├── assets/                 # Imágenes, logos, mapas base estáticos
│   │   ├── components/             # Componentes reutilizables de UI
│   │   ├── pages/                  # Vistas principales del Dashboard / SPA
│   │   ├── services/               # Clientes API para consumir el backend
│   │   ├── App.jsx                 # Componente raíz
│   │   └── main.jsx                # Punto de entrada de React
│   ├── index.html                  # Plantilla HTML principal de Vite
│   ├── package.json                # Scripts y dependencias de Node
│   ├── tailwind.config.js          # Configuración de estilos de Tailwind CSS
│   └── vite.config.js              # Configuración del empaquetador Vite
│
├── tppmaps.html                    # Landing page / Acceso rápido (SPA independiente)
├── start.sh                        # Script de automatización para Linux
├── start.bat                       # Script de automatización para Windows
└── README.md                       # Documentación general del proyecto

## Endpoints de la API

```
Metodo  Ruta                              Descripcion
------  --------------------------------  -------------------------------------
GET     /health                           Health check
GET     /health/db                        Verificacion de base de datos

                    -- Autenticacion --
POST    /api/v1/auth/register             Registrar nuevo usuario
POST    /api/v1/auth/login                Iniciar sesion (JWT)

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

                    -- Endpoints Publicos --
GET     /api/v1/public/reports            Reportes publicos
GET     /api/v1/public/accidents          Accidentes geolocalizados
GET     /api/v1/public/accident-zones     Zonas de accidentalidad
GET     /api/v1/public/fatalities         Incidentes fatales
GET     /api/v1/public/flood-zones        Zonas de inundacion
GET     /api/v1/public/nearby             Busqueda geografica cercana
GET     /api/v1/public/stats              Estadisticas generales

                    -- Vehiculos --
GET     /api/v1/vehicles/                 Listar vehiculos
POST    /api/v1/vehicles/                 Registrar vehiculo
GET     /api/v1/vehicles/{id}             Vehiculo por ID
PUT     /api/v1/vehicles/{id}             Actualizar vehiculo
DELETE  /api/v1/vehicles/{id}             Eliminar vehiculo

                    -- Rutas --
GET     /api/v1/routes/*                  (Proximamente)

                    -- WebSockets --
WS      /api/v1/ws/telemetry              Streaming de datos en tiempo real
```

Documentacion interactiva: http://localhost:8000/docs (Swagger UI)

---

## Inicio Rapido

### Linux

```bash
# 1. Clonar
git clone https://github.com/tu-usuario/tppmaps.git
cd tppmaps

# 2. Crear la base de datos (la migración instala PostGIS y crea todas las tablas)
sudo -u postgres psql -c "CREATE DATABASE movimed;"

# 3. Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 4. Aplicar las migraciones (crea la extensión PostGIS + el esquema completo)
alembic upgrade head

# 5. Frontend
cd ../frontend
npm install
npm run build

# 6. Correr el servidor (sirve la API + el frontend compilado)
cd ../backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
echo "Abre http://localhost:8000"
```

### Windows

```powershell
.\start.bat
```

---

## Fuentes de Datos

```
  +--------+     +--------+     +-----------+
  | SIATA  |     | MEData |     | Ciudadanos|
  +--------+     +--------+     +-----------+
       |              |              |
       v              v              v
  +---------------------------------------+
  |            PostGIS (cache)            |
  +---------------------------------------+
                    |
                    v
             +------------+
             |  FastAPI   |
             +------------+
              /          \
             v            v
      +--------+      +--------+
      |Frontend|      |  Apps  |
      +--------+      +--------+
```

1. **SIATA** -- Sistema de Alerta Temprana de Medellin. Niveles en tiempo real del Rio Medellin y quebradas para poligonos de riesgo de inundacion.
2. **MEData** -- Portal de Datos Abiertos de la Alcaldia de Medellin. Incidentes viales y geometria de la malla vial.
3. **Reportes Ciudadanos** -- Reportes en tiempo real ingresados por los usuarios de la plataforma.

---

## ML & Analitica

```
Motor de Machine Learning (en desarrollo)

  DBSCAN Clustering    ->  Zonas calientes de accidentes
  Prediccion Trafico   ->  Modelo temporal XGBoost
  Flood Forecasting    ->  Alertas tempranas crecidas
  Dashboard Analitico  ->  Estadisticas en tiempo real
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
source .venv/bin/activate
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

**MIT** -- Libre uso para fines academicos y de competencia.

---

<p align="center">
  <sub>Desarrollado para el Hackaton HackData CTGI SENA 2026</sub>
  <br>
  <strong>Medellin, Colombia</strong>
</p>

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=1a5c3a:2d9e5e:3db84f&height=120&section=footer" width="100%">
</p>

