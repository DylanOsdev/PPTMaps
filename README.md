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
  <img alt="Three.js" src="https://img.shields.io/badge/Three.js-R3F-ffffff?style=flat&logo=threedotjs&logoColor=white">
  <img alt="GSAP" src="https://img.shields.io/badge/GSAP-3-88CE02?style=flat&logo=greensock&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16+-4169E1?style=flat&logo=postgresql&logoColor=white">
  <img alt="PostGIS" src="https://img.shields.io/badge/PostGIS-3.5-4169E1?style=flat&logo=postgresql&logoColor=white">
  <img alt="Redis" src="https://img.shields.io/badge/Redis-7-DC382D?style=flat&logo=redis&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-yellow?style=flat">
</p>

<p align="center">
  <strong>Plataforma de Inteligencia Climática y Seguridad Ciudadana para Medellín · HackData CTGI SENA 2026</strong>
</p>

<br>

---

## ¿Qué es PPTMaps?

**PPTMaps** es una plataforma de inteligencia geoespacial que integra datos oficiales de movilidad de Medellín con reportes ciudadanos en tiempo real. Consume fuentes gubernamentales (SIATA, MEData, Open-Meteo), los cachea y optimiza en PostGIS, y los expone mediante una API REST + WebSockets a un dashboard interactivo construido en React con un **motor de rendimiento adaptativo** que detecta la GPU del usuario y ajusta los efectos visuales automáticamente.

### Problemas que resuelve

| Problema | Solución PPTMaps |
|---|---|
| APIs oficiales lentas y sin filtros espaciales | Cache inteligente en PostGIS con queries geoespaciales optimizadas |
| Datos de movilidad dispersos en múltiples fuentes | Unificación en un solo backend con API coherente |
| Sin alertas en tiempo real para incidentes viales | WebSockets + Celery + `alert_broadcaster` para notificaciones push |
| Reportes ciudadanos no digitalizados | Formulario público con geolocalización y soporte multimedia |
| Sin información climática integrada | Proxy Open-Meteo con caché Redis y widget en el dashboard |
| Dashboards lentos en PCs de bajos recursos | Motor de rendimiento adaptativo que detecta GPU y ajusta efectos |

---

## Stack Tecnológico

```
FRONTEND                          BACKEND                        BASE DE DATOS
+---------------------------+    +---------------------+        +------------------+
|   React 19                |    |   FastAPI           |        |   PostgreSQL 16+ |
|   Vite 8                  |    |   Uvicorn           | -----> |   PostGIS 3.5    |
|   Tailwind 4              | -> |   Pydantic v2       |  SQL   |   Redis 7        |
|   Three.js / R3F          |    |   SQLAlchemy 2.0    | <----  |                  |
|   GSAP (ScrollTrigger)    | HTTP|   AsyncPG           |        +------------------+
|   Framer Motion 12        | <-> |   Celery + Beat     |
|   Leaflet                 | REST|   WebSockets        |        +------------------+
|   React Router            |  WS |   Alembic           |        |   APIs Externas  |
|   Lenis (smooth scroll)   |    |   JWT / OAuth2      | -----> |   SIATA          |
+---------------------------+    +---------------------+        |   MEData         |
                                                                |   Open-Meteo     |
                                                                +------------------+
```

---

## Motor de Rendimiento Adaptativo

PPTMaps incluye un sistema de detección de hardware en tiempo real que ajusta automáticamente la calidad visual según el dispositivo del usuario.

### Detección de GPU

```
┌─────────────────────────────────────────────────────────┐
│  1. Detectar GPU via WebGL debug renderer               │
│  2. Clasificar: Dedicada / Integrada / Móvil            │
│  3. Benchmark: renderizar 500 triángulos (100ms)        │
│  4. Score combinado: CPU (30%) + GPU (40%) + HW (30%)   │
│  5. Asignar tier: HIGH / MEDIUM / LOW                   │
└─────────────────────────────────────────────────────────┘
```

| GPU Detectada | Clasificación | Bonus |
|---|---|---|
| NVIDIA GeForce RTX / GTX | Dedicada | +25 pts |
| AMD Radeon RX | Dedicada | +25 pts |
| Apple M1/M2/M3/M4 | Dedicada | +45 pts |
| Intel Iris Xe / Arc | Dedicada | +25 pts |
| Intel UHD / HD | Integrada | -10 pts |
| Qualcomm Adreno | Móvil Dedicada | +25 pts |
| Mali / PowerVR | Móvil Integrada | +10 pts |

### Tiers de Renderizado

| Tier | Score | Partículas | Globe Cities | Globe Arcs | Efectos Weather | Max Pixel Ratio |
|---|---|---|---|---|---|---|
| **HIGH** | >60 | 60 | 15 | 10 | Todos | 3.0 |
| **MEDIUM** | 30-60 | 30 | 10 | 7 | Max 3 simultáneos | 2.0 |
| **LOW** | <30 | 15 | 6 | 4 | Básicos | 1.0 |

### Auto-downgrade / Auto-upgrade

- Si FPS < 25 por 2 muestras consecutivas → degradar tier
- Si FPS > 50 por 5 muestras consecutivas → mejorar tier
- Monitoreo continuo con `requestAnimationFrame`

---

## Optimizaciones de Rendimiento

### Globe3D (Three.js / React Three Fiber)

| Optimización | Detalle |
|---|---|
| **InstancedMesh** | 15 ciudades + 15 glows → 2 draw calls (antes 30) |
| **Visibility Observer** | `IntersectionObserver` detiene rendering cuando off-screen |
| **frameloop="never"** | Canvas deja de renderizar cuando invisible |
| **Buffer disposal** | `geometry.dispose()` + `material.dispose()` en unmount |
| **Imperative geometry** | `THREE.BufferAttribute` en `useMemo` (no JSX reconciler) |

### Animaciones (GSAP + Framer Motion)

| Optimización | Detalle |
|---|---|
| **will-change lifecycle** | Aplicado solo durante transición GSAP, removido al completar |
| **CSS > Framer Motion** | DigitalRain, Dust, Scanline, GlitchBars → CSS `@keyframes` |
| **clip-path typewriter** | 2 nodos DOM (antes 18 nodos por carácter) |
| **Reduced motion** | Fallback vertical scroll para `prefers-reduced-motion` |
| **Lenis smooth scroll** | Scroll suave con `scrub: 0.5` en GSAP |

### TelemetrySection (CSS Animations)

| Optimización | Detalle |
|---|---|
| **LightRays** | CSS `@keyframes` con transform/opacity (antes RAF + gradient strings) |
| **CausticFloor** | CSS `@keyframes` con translateX/scaleY (antes RAF + radial-gradient) |
| **SurfaceWave** | CSS `@keyframes` mask-position (antes RAF + SVG data URI reconstruido) |
| **AnimatedBars** | CSS `@keyframes` (antes Framer Motion controller) |

### ReportsSection

| Optimización | Detalle |
|---|---|
| **HoloHub isolated RAF** | Elapsed time management interno, parent no re-renderiza |
| **CollidingDots** | `transform: translate()` en vez de `left/top` (no layout thrashing) |
| **Ripple throttle** | `setRipples` throttled a 100ms (antes cada frame) |
| **Seeded random** | `seededRandom()` para voice bars (sin `Math.random()` en useMemo) |

### CSS Containment

| Sección | Propiedad |
|---|---|
| HeroSection | `contain: layout style` |
| TelemetrySection | `contain: layout style` |
| BackendSection | `contain: layout style` |
| FinalCTA | `contain: layout style paint` + `content-visibility: auto` |

### Backdrop Filter

Se eliminó `backdrop-filter: blur()` de 13+ elementos animados (Navbar, DataPanel, StatCards, StatusBar). Se reemplazó con backgrounds semi-transparentes (`bg-[#041327]/90`).

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
│   │   │       │   ├── public.py             # Endpoints públicos (geográficos)
│   │   │       │   ├── reports.py            # Reportes ciudadanos
│   │   │       │   ├── weather.py            # Clima y pronósticos
│   │   │       │   └── chatbot.py            # Asistente IA
│   │   │       └── router.py
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
│       │   ├── Globe3D.jsx         # ★ Globo 3D con Three.js/R3F
│       │   ├── Navbar.jsx          # Navegación con reloj memoizado
│       │   └── CustomCursor.jsx    # Cursor personalizado
│       ├── hooks/
│       │   ├── useDevicePerformance.jsx  # ★ Motor de rendimiento adaptativo
│       │   └── useCountUp.js             # Hook de counter animado
│       ├── utils/
│       │   └── random.js           # seededRandom compartido
│       ├── pages/
│       │   ├── Landing.jsx         # ★ Landing con GSAP scroll + Lenis
│       │   ├── CommandCenter.jsx   # Dashboard de comando geoespacial
│       │   ├── Report.jsx          # Formulario de reporte ciudadano
│       │   └── Navigate.jsx        # Navegación y rutas
│       │   └── landing/
│       │       ├── sections/
│       │       │   ├── HeroSection.jsx      # Globe 3D + typewriter
│       │       │   ├── TelemetrySection.jsx # Animaciones CSS puras
│       │       │   ├── WeatherSection.jsx   # Clima con efectos adaptativos
│       │       │   ├── ReportsSection.jsx   # Colisión de dots + SVG hub
│       │       │   ├── BackendSection.jsx   # Code rain + counters
│       │       │   ├── LayersSection.jsx    # Capas 3D CSS
│       │       │   └── FinalCTA.jsx         # Campo de estrellas
│       │       └── components/
│       │           └── Globe3D.jsx
│       ├── static/
│       │   ├── css/tppmaps.css     # Estilos del mapa Leaflet
│       │   └── js/ui/alerts.js     # ★ Lógica WebSocket de alertas en vivo
│       ├── App.jsx                 # PerformanceProvider wrapper
│       ├── main.jsx                # THREE.Clock warning suppression
│       └── index.css
│   ├── index.html
│   ├── package.json
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

                    -- Reportes Ciudadanos (Público) --
POST    /api/v1/reports/                  Crear reporte anónimo
GET     /api/v1/reports/                  Listar reportes
GET     /api/v1/reports/{id}              Reporte por ID
PUT     /api/v1/reports/{id}              Actualizar reporte

                    -- Endpoints Públicos --
GET     /api/v1/public/reports            Reportes públicos geolocalizados
GET     /api/v1/public/accidents          Accidentes históricos
GET     /api/v1/public/accident-zones     Zonas de accidentalidad
GET     /api/v1/public/fatalities         Incidentes fatales
GET     /api/v1/public/flood-zones        Zonas de inundación
GET     /api/v1/public/nearby             Búsqueda geográfica cercana
GET     /api/v1/public/stats              Estadísticas generales

                    -- Clima --
GET     /api/v1/weather/forecast          Pronóstico Open-Meteo (proxy con caché)
GET     /api/v1/weather/stats             Estadísticas climáticas históricas

                    -- Chatbot IA --
POST    /api/v1/chatbot/query             Consulta al asistente geoespacial

                    -- WebSockets --
WS      /api/v1/ws/telemetry              Streaming de datos en tiempo real
WS      /api/v1/ws/alerts                 ★ Alertas en vivo (broadcast)
```

**Nota**: Todos los endpoints son públicos — no requieren autenticación.

Documentación interactiva: `http://localhost:8000/docs` (Swagger UI)
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

### Opción 1: Docker (Recomendado)

```bash
# 1. Clonar el repositorio
git clone https://github.com/DylanOsdev/PPTMaps.git
cd PPTMaps

# 2. Levantar el stack completo (incluye ingesta automática de 702k registros)
cd backend
docker-compose -f docker-compose.pptmaps.yml up -d --build

# 3. Esperar ~2 minutos para que la ingesta termine
# Verificar progreso:
docker-compose -f docker-compose.pptmaps.yml logs -f api

# 4. Verificar que todo funcione
chmod +x test_docker_stack.sh
./test_docker_stack.sh

# 5. Acceder a la aplicación
# - Frontend: http://localhost:8000
# - Dashboard: http://localhost:8000/dashboard
# - API Docs: http://localhost:8000/docs
```

**Nota**: La primera vez que ejecutás `docker-compose up`, el sistema:
1. Construye las imágenes (backend + frontend)
2. Aplica migraciones de PostGIS
3. Ingesta automáticamente 702,540 incidentes viales (2008-2025)
4. Siembra 30 zonas (comunas + municipios)
5. Arranca la API en http://localhost:8000

### Opción 2: Linux (script automatizado)

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
-  **Reportes ciudadanos anónimos** geolocalizados con formulario público
-  **Dashboard de comando** con estadísticas y telemetría en tiempo real
-  **Rate limiting** — protección anti-spam (5 reportes/hora por IP)
-  **ML en desarrollo**: clustering DBSCAN de zonas de accidentalidad + predicción de tráfico XGBoost

---

## Rendimiento por Dispositivo

| Dispositivo | Tier | FPS esperado | Efectos visuales |
|---|---|---|---|
| PC Gaming / Workstation | HIGH | 60 fps | Globe 3D completo, todas las partículas, todos los efectos weather |
| Laptop integrada / Mac | MEDIUM | 30-45 fps | Globe reducido, partículas limitadas, max 3 efectos weather |
| PC viejo / Notebook básico | LOW | 20-30 fps | Globe mínimo, sin partículas, efectos básicos |

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
