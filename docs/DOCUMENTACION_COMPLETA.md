# PPTMaps — Documentación Completa

**Plataforma de Movilidad Inteligente para Medellín**
*HackData CTGI SENA 2026*

---

## Índice

1. [Visión General](#1-visión-general)
2. [Problema y Solución](#2-problema-y-solución)
3. [Arquitectura del Sistema](#3-arquitectura-del-sistema)
4. [Stack Tecnológico](#4-stack-tecnológico)
5. [Backend — FastAPI](#5-backend--fastapi)
6. [Base de Datos — PostGIS](#6-base-de-datos--postgis)
7. [Frontend — React + Vite](#7-frontend--react--vite)
8. [Tiempo Real — WebSockets + Redis Pub/Sub](#8-tiempo-real--websockets--redis-pubsub)
9. [Tareas Asíncronas — Celery](#9-tareas-asíncronas--celery)
10. [Servicios de Integración](#10-servicios-de-integración)
11. [Machine Learning](#11-machine-learning)
12. [Flujo de Datos Completo](#12-flujo-de-datos-completo)
13. [Infraestructura y Despliegue](#13-infraestructura-y-despliegue)
14. [API REST — Endpoints](#14-api-rest--endpoints)
15. [Seguridad](#15-seguridad)
16. [Guía de Inicio Rápido](#16-guía-de-inicio-rápido)
17. [Demo y Datos de Prueba](#17-demo-y-datos-de-prueba)

---

## 1. Visión General

**PPTMaps** es una **plataforma unificada de inteligencia geoespacial** que integra datos oficiales de movilidad de Medellín con reportes ciudadanos en tiempo real. Su objetivo es centralizar fuentes de información dispersas (SIATA, MEData, Open-Meteo) en un solo sistema con capacidades de análisis espacial, alertas en vivo y visualización interactiva.

### ¿Por qué PPTMaps?

Medellín cuenta con múltiples fuentes de datos abiertos y sistemas de monitoreo, pero estos operan de forma aislada. No existe un punto único donde confluyan:

- Los niveles de los ríos y quebradas monitoreados por SIATA
- Los incidentes de tránsito reportados en MEData
- El pronóstico meteorológico
- Los reportes ciudadanos
- La telemetría de vehículos en tiempo real

PPTMaps resuelve esto proporcionando **una sola API coherente** que unifica todas estas fuentes con un **dashboard geográfico interactivo** y **alertas en vivo**.

---

## 2. Problema y Solución

| Problema | Solución PPTMaps |
|---|---|
| Datos de movilidad dispersos en APIs oficiales sin filtros espaciales | Unificación en un solo backend con API REST coherente y caché inteligente en PostGIS |
| Sin alertas en tiempo real para incidentes viales o crecidas | Sistema de alertas con WebSockets + Redis Pub/Sub + Celery para notificaciones push al navegador |
| Reportes ciudadanos no digitalizados ni geolocalizados | Formulario público de reportes con captura de ubicación geográfica y soporte multimedia |
| Sin información climática integrada al análisis de movilidad | Proxy Open-Meteo con caché en Redis y widget de pronóstico en el dashboard |
| APIs oficiales lentas y sin capacidad geoespacial | Cache en PostGIS con índices GiST y consultas espaciales optimizadas (`ST_DWithin`, `ST_ClusterDBSCAN`) |
| Sin capacidad de análisis de zonas de riesgo | Motor de clustering DBSCAN nativo en PostGIS para detección de zonas calientes de accidentes |

---

## 3. Arquitectura del Sistema

```
 ┌─────────────────────────────────────────────────────────────────────┐
 │                          CLIENTES                                    │
 │  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────────────┐  │
 │  │ Dashboard│  │  App     │  │  Sistemas  │  │   Dispositivos    │  │
 │  │  React   │  │  Mobile  │  │  Externos  │  │     GPS (IoT)     │  │
 │  └────┬─────┘  └────┬─────┘  └─────┬─────┘  └────────┬──────────┘  │
 │       │              │              │                  │             │
 └───────┼──────────────┼──────────────┼──────────────────┼─────────────┘
         │              │              │                  │
    ┌────┴──────────────┴──────────────┴──────────────────┴────┐
    │                      FASTAPI (Uvicorn)                    │
    │  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐  │
    │  │ REST API│ │WebSocket│ │  Celery  │ │  Proxy APIs  │  │
    │  │/api/v1  │ │/ws/*    │ │  Tasks   │ │  Externas    │  │
    │  └────┬────┘ └────┬────┘ └────┬─────┘ └──────┬───────┘  │
    └───────┼───────────┼───────────┼───────────────┼──────────┘
            │           │           │               │
    ┌───────┴───────────┴───────────┴───────────────┴──────────┐
    │                    REDIS (7)                              │
    │  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐  │
    │  │   Cache  │ │  Broker  │ │  Pub/Sub  │ │  Buffer  │  │
    │  │  (Clima) │ │ (Celery) │ │ (Alertas) │ │(Telemetría)│ │
    │  └──────────┘ └──────────┘ └───────────┘ └──────────┘  │
    └──────────────────────────────────────────────────────────┘
            │
    ┌───────┴──────────────────────────────────────────────────┐
    │              POSTGRESQL 16 + POSTGIS 3.5                  │
    │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
    │  │  Capa    │ │  Capa    │ │  Capa    │ │   Capa     │  │
    │  │Usuario/  │ │Geográfica│ │  ML/     │ │  Tiempo    │  │
    │  │ Auth     │ │(PostGIS) │ │Clustering│ │  Real      │  │
    │  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │
    └──────────────────────────────────────────────────────────┘
            │
    ┌───────┴──────────────────────────────────────────────────┐
    │                FUENTES EXTERNAS                           │
    │  ┌──────────┐ ┌──────────┐ ┌──────────────┐             │
    │  │  SIATA   │ │  MEData  │ │  Open-Meteo  │             │
    │  │(Ríos y   │ │(Abiertos │ │  (Clima      │             │
    │  │Quebradas)│ │Medellín) │ │  Gratuito)   │             │
    │  └──────────┘ └──────────┘ └──────────────┘             │
    └──────────────────────────────────────────────────────────┘
```

### Flujo de Comunicación

1. **Frontend ↔ Backend**: Comunicación vía HTTP REST (datos) y WebSockets (tiempo real)
2. **Backend ↔ Base de Datos**: SQLAlchemy 2.0 asíncrono con AsyncPG para consultas geoespaciales
3. **Backend ↔ Redis**: Caché de pronósticos meteorológicos, buffer de telemetría, broker de tareas Celery
4. **Celery ↔ Redis**: Publicación de alertas en canal Pub/Sub `alerts:live`
5. **FastAPI ↔ WebSocket**: Consumidor del canal Pub/Sub de Redis que reenvía alertas a los clientes conectados
6. **Backend ↔ APIs Externas**: Clientes HTTP con patrón Port/Adapter para SIATA, MEData y Open-Meteo

---

## 4. Stack Tecnológico

### Backend

| Tecnología | Versión | Propósito |
|---|---|---|
| **Python** | 3.12+ | Lenguaje base |
| **FastAPI** | 0.111+ | Framework web asíncrono |
| **Uvicorn** | — | Servidor ASGI |
| **Pydantic** | v2 | Validación de datos y schemas |
| **SQLAlchemy** | 2.0 | ORM asíncrono |
| **AsyncPG** | — | Driver PostgreSQL asíncrono |
| **GeoAlchemy2** | — | Extensiones geoespaciales para SQLAlchemy |
| **Celery** | 5.4+ | Cola de tareas distribuidas |
| **Celery Beat** | — | Programador de tareas periódicas |
| **Redis** | 7 | Cache, broker y Pub/Sub |
| **Alembic** | — | Migraciones de base de datos |
| **Shapely** | — | Operaciones geoespaciales (rutas seguras) |
| **Passlib** | — | Hashing de contraseñas (bcrypt) |
| **python-jose** | — | JWT |

### Frontend

| Tecnología | Versión | Propósito |
|---|---|---|
| **React** | 19 | UI declarativa por componentes |
| **Vite** | 8 | Bundler y dev server ultrarrápido |
| **Tailwind CSS** | 4 | Framework de estilos utility-first |
| **React Router** | 7 | Enrutamiento SPA |
| **Leaflet** | — | Mapas interactivos (OpenStreetMap) |
| **React Icons** | 5 | Iconografía |
| **GSAP** | 3 | Animaciones |

### Base de Datos

| Tecnología | Versión | Propósito |
|---|---|---|
| **PostgreSQL** | 16+ | Motor relacional |
| **PostGIS** | 3.5 | Extensiones geoespaciales (tipos, índices, funciones) |
| **Índices GiST** | — | Indexación espacial para búsquedas geográficas rápidas |

---

## 5. Backend — FastAPI

### Estructura del Proyecto

```
backend/
├── app/
│   ├── main.py                  # Punto de entrada — configuración, lifespan, routers
│   ├── api/
│   │   └── v1/
│   │       ├── router.py        # Agrupación de todos los endpoints
│   │       └── endpoints/       # Módulos de rutas
│   │           ├── auth.py           # Registro, login, JWT
│   │           ├── users.py          # CRUD de usuarios
│   │           ├── reports.py        # Reportes ciudadanos
│   │           ├── public.py         # Endpoints públicos (mapa, stats, clima)
│   │           ├── vehicles.py       # Gestión de flota vehicular
│   │           ├── routes.py         # Cálculo de rutas seguras
│   │           ├── telemetry.py      # Ingesta de telemetría GPS
│   │           ├── accident_zones.py # Zonas de accidentalidad
│   │           └── flood_hazards.py  # Zonas de inundación
│   ├── core/
│   │   ├── config.py            # Configuración centralizada (Settings Pydantic)
│   │   ├── security.py          # JWT, hashing de contraseñas
│   │   └── exceptions.py        # Manejadores de errores personalizados
│   ├── db/
│   │   ├── database.py          # Engine asíncrono, session factory
│   │   ├── base.py              # Importación de modelos para Alembic
│   │   ├── base_class.py        # DeclarativeBase de SQLAlchemy
│   │   └── redis.py             # Cliente Redis singleton asíncrono
│   ├── models/                  # Modelos SQLAlchemy + PostGIS
│   │   ├── user.py              # Usuarios y roles
│   │   ├── report.py            # Reportes ciudadanos
│   │   ├── accident_zone.py     # Zonas de accidentalidad
│   │   ├── flood_hazard.py      # Zonas de riesgo de inundación
│   │   ├── vehicle.py           # Vehículos de la flota
│   │   ├── telemetry.py         # Pings GPS
│   │   ├── alert.py             # Alertas del sistema
│   │   └── weather.py           # Snapshots meteorológicos
│   ├── schemas/                 # Validadores Pydantic v2
│   ├── crud/                    # Operaciones atómicas de base de datos
│   ├── services/                # Lógica de negocio (Hexagonal)
│   │   ├── alert_broadcaster.py # Puente Redis Pub/Sub → WebSocket
│   │   ├── ingestion.py         # Ingesta de datos MEData
│   │   ├── siata_sync.py        # Sincronización SIATA (Port/Adapter)
│   │   ├── weather.py           # Proxy Open-Meteo (Port/Adapter)
│   │   ├── telemetry.py         # Buffer CQRS para telemetría
│   │   ├── routing.py           # Cálculo de rutas seguras
│   │   ├── notification.py      # Notificaciones externas
│   │   └── zones_seed.py        # Siembra de comunas/municipios
│   ├── tasks/                   # Tareas Celery
│   │   ├── celery_app.py        # Configuración Celery + Beat schedule
│   │   ├── worker.py            # Tareas del worker (detección excesos)
│   │   └── cron_jobs.py         # Wrappers asíncronos para tareas periódicas
│   ├── ml/                      # Machine Learning
│   │   ├── dbscan_clustering.py # Clustering espacial (ST_ClusterDBSCAN)
│   │   └── predict_traffic.py   # Predicción de tráfico (placeholder)
│   └── websocket/               # Gestión de WebSockets
│       ├── ws_router.py         # Endpoint /ws/telemetry
│       └── connection_manager.py # Pool de conexiones por canal
├── alembic/                     # Migraciones de base de datos
├── tests/
├── requirements.txt
├── seed_demo.py                 # Datos de demostración
├── Dockerfile
└── docker-compose.yml
```

### Ciclo de Vida (Lifespan)

El archivo `main.py` define un manejador `lifespan` que se ejecuta al arrancar y al detener la aplicación:

**Al iniciar:**
1. Verifica conectividad con PostgreSQL
2. Siembra comunas y municipios del Valle de Aburrá desde un archivo GeoJSON (`medellin-comunas.json`) usando `ST_GeomFromGeoJSON`
3. Sincroniza incidentes de MEData (SODA API) — si falla, usa datos semilla locales
4. Sincroniza zonas de inundación desde SIATA — si falla, usa datos semilla
5. Siembra alertas iniciales para que el panel LIVE ALERTS no arranque vacío
6. Siembra 8 vehículos demo con telemetría (ambulancias, patrullas, bomberos) dispersos por Medellín
7. Encola una sincronización inicial del clima para evitar mapa vacío
8. Inicia tarea asíncrona de listener de alertas en Redis Pub/Sub

**Al detener:**
1. Cancela el listener de alertas
2. Libera conexiones de la base de datos (`engine.dispose()`)

### Patrón Hexagonal (Port/Adapter)

El backend implementa el patrón **Puerto/Adaptador** (Arquitectura Hexagonal) para las integraciones externas:

```
┌──────────────────────────────────────────────────┐
│                 SERVICIO (dominio)                │
│              SiataSyncService.sync()              │
└────────────┬─────────────────────┬────────────────┘
             │                     │
    ┌────────▼────────┐   ┌───────▼────────┐
    │  Puerto (ABC)   │   │ Puerto (ABC)   │
    │ SiataGaugeClient│   │ WeatherClient  │
    └────────┬────────┘   └───────┬────────┘
             │                     │
    ┌────────▼────────┐   ┌───────▼────────┐
    │   Adaptador 1   │   │  Adaptador 1   │
    │ SiataHttpClient │   │ OpenMeteoClient│
    │ (API real)      │   │ (API gratuita) │
    └─────────────────┘   └────────────────┘
    ┌─────────────────┐   ┌────────────────┐
    │   Adaptador 2   │   │  Adaptador 2   │
    │ SiataSeedClient │   │ OpenMeteo      │
    │ (datos locales) │   │ ForecastClient │
    └─────────────────┘   └────────────────┘
```

**Beneficio**: El sistema intenta la fuente real primero. Si la API externa falla (por red, límite de tasa o mantenimiento), degrada suavemente a datos semilla, garantizando que el dashboard nunca se quede vacío.

---

## 6. Base de Datos — PostGIS

### Modelo de Datos

```
┌─────────────┐       ┌──────────────┐       ┌──────────────┐
│    users    │       │  telemetry   │       │  vehicles    │
├─────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)     │◄──┐   │ id (PK)      │   ┌──►│ id (PK)      │
│ email       │   │   │ vehicle_id   │───┘   │ plate        │
│ password    │   │   │ latitude     │       │ type         │
│ full_name   │   │   │ longitude    │       │ status       │
│ role        │   │   │ speed        │       │ model        │
│ is_active   │   │   │ heading      │       └──────────────┘
└─────────────┘   │   │ location(POINT)│
                   │   │ timestamp    │
                   │   └──────────────┘
                   │
┌─────────────┐   │   ┌──────────────┐       ┌──────────────┐
│   reports   │   │   │   alerts     │       │ accident_    │
├─────────────┤   │   ├──────────────┤       │    zones     │
│ id (PK)     │   │   │ id (PK)      │       ├──────────────┤
│ reporter_id │───┘   │ vehicle_id   │──┐    │ id (PK)      │
│ report_type │       │ type         │  │    │ name          │
│ description │       │ severity     │  │    │ severity      │
│ geom(POINT) │       │ message      │  │    │ incident_count│
│ created_at  │       │ is_resolved  │  │    │ geom(MULTI-   │
│ media_url   │       │ created_at   │  │    │   POLYGON)   │
└─────────────┘       └──────────────┘  │    └──────────────┘
                                        │
┌──────────────┐       ┌──────────────┐ │    ┌──────────────┐
│ flood_hazards│       │weather_      │ │    │    zones     │
├──────────────┤       │ snapshots    │ │    ├──────────────┤
│ id (PK)      │       ├──────────────┤ │    │ id (PK)      │
│ name         │       │ id (PK)      │ │    │ kind (comuna │
│ siata_       │       │ location_name│ │    │   /municipio)│
│  station_id  │       │ temperature_c│ │    │ name         │
│ status       │       │ humidity     │ │    │ geom(GEOMETRY)│
│ water_level_m│       │ rain_mm      │ │    └──────────────┘
│ geom(POLYGON)│       │ geom(POINT)  │ │
└──────────────┘       └──────────────┘ │
                                                   
```

### Tipos Geoespaciales PostGIS

| Tipo | Uso |
|---|---|
| `POINT` (SRID 4326) | Ubicaciones precisas: reportes, telemetría, estaciones clima |
| `POLYGON` (SRID 4326) | Zonas de inundación (polígonos de quebradas y ríos) |
| `MULTIPOLYGON` (SRID 4326) | Zonas de accidentalidad (clusters DBSCAN) |
| `GEOMETRY` (SRID 4326) | Comunas y municipios (polígonos administrativos) |

### Índices Espaciales

Todas las tablas con geometrías tienen **índices GiST** (Generalized Search Tree), que permiten búsquedas geográficas eficientes como:

```sql
-- Buscar todos los reportes en un radio de 500 metros
SELECT * FROM reports
WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint(-75.56, 6.25), 4326), 0.005);
```

### Clustering Nativo con PostGIS

El módulo de clustering DBSCAN no usa scikit-learn. En su lugar, ejecuta directamente en la base de datos:

```sql
SELECT ST_ClusterDBSCAN(geom, eps := 0.002, minpoints := 3) OVER () AS cluster_id
```

Esto evita transferir datos geográficos al servidor Python, aprovechando la capacidad de cómputo del motor de base de datos.

---

## 7. Frontend — React + Vite

### Rutas de la SPA

| Ruta | Página | Propósito |
|---|---|---|
| `/` | `Landing.jsx` | Página de aterrizaje con hero, estadísticas, características y CTA |
| `/map` | `CommandCenter.jsx` | Dashboard de comando geoespacial — mapa en vivo, capas, clima, alertas |
| `/report` | `Report.jsx` | Formulario de reporte ciudadano con geolocalización |
| `/navigate` | `Navigate.jsx` | Vista de ruta y navegación móvil |

### Dashboard de Comando (CommandCenter)

El componente principal `CommandCenter.jsx` (411 líneas) es el corazón del frontend. Está organizado en paneles:

```
┌──────────────────────────────────────────────────────────────┐
│  TOP BAR                                                      │
│  [TPPMAPS] [Zulu Time] [System Status] [SIATA] [Alerts] [↑] │
├──────────────┬───────────────────────────────────────────────┤
│  LEFT PANEL  │               MAP PANEL                        │
│  (Data Layers)│                                               │
│              │     ┌─────────────────────────────────┐       │
│  ☑ Accident   │     │                                 │       │
│     Zones    │     │     LEAFLET MAP                  │       │
│  ☑ Flood      │     │     (OpenStreetMap)             │       │
│     Zones    │     │                                 │       │
│  ☑ Reports   │     │   • Marcadores GPS              │       │
│  ☑ Telemetry │     │   • Polígonos de riesgo         │       │
│  ☑ Comunas   │     │   • Calor de accidentes         │       │
│  ☑ Municipios│     │   • Alertas geolocalizadas      │       │
│              │     └─────────────────────────────────┘       │
│              │                                               │
│              │  RIGHT PANEL                                   │
│              │  ┌──────────────────────┐                     │
│              │  │  SEARCH              │                     │
│              │  │  WEATHER WIDGET      │                     │
│              │  │  LIVE ALERTS FEED    │                     │
│              │  │  [ALL][SIATA][REP]   │                     │
│              │  └──────────────────────┘                     │
├──────────────┴───────────────────────────────────────────────┤
│  BOTTOM BAR                                                   │
│  [Stats Bar] [News Ticker]                                    │
└───────────────────────────────────────────────────────────────┘
```

### Componentes

| Componente | Archivo | Función |
|---|---|---|
| `TopBar` | `TopBar.jsx` | Barra superior con marca, reloj Zulu, estado del sistema, contador de alertas, botón API Docs |
| `StatusCluster` | `StatusCluster.jsx` | Indicadores visuales de estado: sistema, SIATA, conectividad |
| `WeatherWidget` | `WeatherWidget.jsx` | Widget meteorológico: temperatura actual, feels-like, humedad, viento, nubosidad, presión, lluvia; pronóstico a 6 horas y 5 días |
| Landing hero | `Landing.jsx` | Estadísticas clave (16 comunas, 847 conductores GPS, 9 capas, <30s latencia) |

### Hooks Personalizados

| Hook | Archivo | Función |
|---|---|---|
| `useWeather` | `hooks/useWeather.js` | Fetch de `/api/v1/public/weather/forecast` cada 10 minutos; parseo de códigos WMO; retorna datos horarios y diarios |

### Sistema de Capas del Mapa

El mapa Leaflet soporta las siguientes capas superpuestas:

1. **Accident Zones** — Polígonos de zonas calientes de accidentes
2. **Flood Zones** — Polígonos de riesgo de inundación (con estado: dry/watch/flooded)
3. **Reports** — Marcadores de reportes ciudadanos
4. **Telemetry** — Posiciones GPS de vehículos en tiempo real
5. **Comunas** — Polígonos administrativos de las 16 comunas de Medellín
6. **Municipios** — Polígonos de los municipios del Valle de Aburrá

### Tema Visual

El diseño sigue una estética **Osiris (oscuro)** con una paleta de colores personalizada:
- Variables CSS para toda la paleta
- Modo noche opcional
- Animaciones con GSAP
- Pausa de animaciones durante el zoom de Leaflet para evitar jank

---

## 8. Tiempo Real — WebSockets + Redis Pub/Sub

### Arquitectura de Tiempo Real

```
  CELERY WORKER                    FASTAPI                      NAVEGADOR
  ┌──────────────┐               ┌──────────────┐             ┌──────────┐
  │ detect_      │               │              │             │          │
  │ overspeed()  │               │              │             │          │
  │              │               │              │             │          │
  │ Crea alerta  │               │              │             │          │
  │ ───────────► │  Redis Pub    │              │             │          │
  │ Publica en   │────alerts:───►│  Listener    │             │          │
  │ alerts:live  │   live        │  asyncio     │───WS MSG──►│ alert.js │
  │              │               │  broadcast() │             │          │
  └──────────────┘               └──────────────┘             └──────────┘
```

### Componentes

1. **Celery Worker** (`worker.py`):
   - Detecta excesos de velocidad (>80 km/h) en los últimos 2 minutos de telemetría
   - Crea una alerta en la base de datos
   - Publica la alerta en el canal de Redis `alerts:live`

2. **Redis Pub/Sub**:
   - Actúa como middleware de mensajería entre Celery y FastAPI
   - Canal: `alerts:live`

3. **FastAPI Listener** (`alert_broadcaster.py`):
   - `listen_and_broadcast_alerts()`: se suscribe al canal `alerts:live` de Redis
   - Por cada mensaje recibido, llama a `ConnectionManager.broadcast()`

4. **ConnectionManager** (`connection_manager.py`):
   - Mantiene un pool de conexiones WebSocket organizadas por canal (`global`)
   - `broadcast()`: envía el mensaje JSON a todas las conexiones del canal
   - Remueve automáticamente conexiones muertas (desconectadas)

5. **Endpoint WebSocket** (`ws_router.py`):
   - Ruta: `ws://host/ws/telemetry?channel=global`
   - Al conectarse, envía al cliente:
     - `{type: "telemetry"}` — última posición conocida de cada vehículo
     - `{type: "alerts"}` — alertas no resueltas actuales
   - Luego mantiene la conexión abierta para recibir broadcasts

6. **Cliente WebSocket** (`frontend/static/js/ui/alerts.js`):
   - Se conecta al WebSocket al cargar el dashboard
   - Escucha mensajes entrantes y renderiza alertas en el feed
   - Filtros por tipo: ALL, SIATA, REPORTS, TRAFFIC

---

## 9. Tareas Asíncronas — Celery

### Configuración

- **Broker**: Redis (`redis://localhost:6379/0`)
- **Workers**: Procesan tareas en segundo plano
- **Beat**: Programador de tareas periódicas

### Tareas Periódicas (Celery Beat)

| Tarea | Frecuencia | Servicio | Propósito |
|---|---|---|---|
| `siata.sync_flood_hazards` | Cada 15 min | SIATA | Actualizar niveles de ríos y quebradas |
| `weather.sync` | Cada 15 min | Open-Meteo | Actualizar pronóstico meteorológico |
| `telemetry.flush` | Cada 1 min | Telemetría | Vaciar buffer de Redis a PostgreSQL |
| `overspeed.check` | Cada 1 min | Seguridad | Detectar excesos de velocidad |
| `ml.cluster_accident_hotspots` | Cada 1 hora | ML | Recalcular zonas calientes de accidentes |

### Flujo de Telemetría (Patrón CQRS)

```
Dispositivo GPS → POST /api/v1/telemetry → Redis List (telemetry:buffer)
                                                    │
                                          Cada 1 min (Celery Beat)
                                                    │
                                                    ▼
                                          Redis → PostgreSQL (bulk insert)
                                          (flush_telemetry)
```

Este patrón **CQRS** (Command Query Responsibility Segregation) separa la escritura de la lectura:
- **Comando**: La telemetría entrante se escribe rápidamente en Redis (operación O(1))
- **Lectura**: Las consultas al mapa leen desde PostgreSQL (datos consolidados)
- **Sincronización**: Cada minuto, Celery vacía el buffer de Redis y hace un bulk insert en PostgreSQL

Beneficio: La ingesta de telemetría es extremadamente rápida (no espera a PostgreSQL) y se protege contra picos de tráfico.

### Detección de Excesos de Velocidad

La tarea `detect_overspeed()` en `worker.py`:
1. Consulta la telemetría de los últimos 2 minutos
2. Filtra registros con velocidad > 80 km/h
3. Por cada infracción, crea una alerta de tipo `overspeed` con severidad `WARNING`
4. Persiste la alerta en PostgreSQL
5. Publica la alerta en Redis Pub/Sub (`alerts:live`)

---

## 10. Servicios de Integración

### 10.1 SIATA — Sistema de Alerta Temprana

**SIATA** (Sistema de Alerta Temprana del Valle de Aburrá) monitora en tiempo real los niveles de los ríos y quebradas.

**Implementación** (`siata_sync.py`):
- Artefacto: `SiataGaugeClient` (puerto abstracto)
- `SiataHttpClient`: Consulta el endpoint real de `siata.gov.co`
- `SiataSeedClient`: Genera datos simulados con variación pseudoaleatoria para demostraciones
- `SiataSyncService.sync()`:
  1. Obtiene lecturas de las estaciones
  2. Para cada estación, calcula zonas de influencia (buffer geométrico)
  3. Clasifica el estado según el nivel del agua: `dry` (seco), `watch` (monitoreo), `flooded` (inundado)
  4. Upsert en la tabla `flood_hazards` (inserta o actualiza si existe)

**Estaciones SIATA monitoreadas:**
1. Río Medellín — Industriales
2. Río Medellín — Puente 4 Sur
3. Quebrada La Iguana
4. Quebrada La Presidenta
5. Quebrada La Volcana

### 10.2 MEData — Datos Abiertos de Medellín

**MEData** es el portal de datos abiertos de la Alcaldía de Medellín, que expone incidentes viales históricos.

**Implementación** (`ingestion.py`):
- `sync_soda_incidents()`: Consulta la API SODA de `datos.gov.co`
- Si la consulta falla (sin conexión, límite de tasa), usa 10 accidentes semilla predefinidos con coordenadas reales de Medellín
- Los accidentes se almacenan como geometrías POINT en la tabla `accident_zones`

### 10.3 Open-Meteo — Clima

**Open-Meteo** es una API meteorológica gratuita y sin clave.

**Implementación** (`weather.py`):
- `OpenMeteoClient.fetch_weather(points)`: Consulta múltiples puntos geográficos en una sola llamada
- `OpenMeteoForecastClient.fetch_forecast(lat, lng)`: Obtiene pronóstico detallado para el widget
- `WeatherSyncService.sync()`:
  1. Consulta Open-Meteo para 5 puntos del Valle de Aburrá
  2. Cachea en Redis con TTL (Time To Live)
  3. Upsert en la tabla `weather_snapshots`

**Puntos monitoreados:** Medellín, Bello, Itagüí, Envigado, Sabaneta

### 10.4 Enrutamiento Seguro

**Implementación** (`routing.py`):
- Calcula una ruta en línea recta entre origen y destino usando el haversine (distancia de gran círculo)
- Verifica intersecciones espaciales con:
  - Zonas de inundación activas (estado `watch` o `flooded`)
  - Zonas de accidentalidad con alta severidad (≥3 incidentes)
- Si la ruta cruza una zona de riesgo, calcula un **desvío**: punto perpendicular a la línea original con un margen de seguridad
- Usa Shapely para las operaciones geométricas

---

## 11. Machine Learning

### Clustering DBSCAN de Zonas de Accidentalidad

**Archivo**: `ml/dbscan_clustering.py`

**Algoritmo**: `ST_ClusterDBSCAN` nativo de PostGIS (no scikit-learn)

**Parámetros**:
- `eps`: 0.002 grados (~200 metros) — radio de búsqueda de vecinos
- `minpoints`: 3 — puntos mínimos para formar un cluster

**Proceso**:
1. Consulta todos los reportes de accidentes con geometría POINT
2. Ejecuta `ST_ClusterDBSCAN` sobre las geometrías
3. Para cada cluster encontrado, genera un polígono convexo (`ST_ConvexHull`)
4. Expande el polígono con un buffer de 100 metros (`ST_Buffer`) en SRID 32618 (UTM zona 18N, métrico)
5. Asigna nombre "Hotspot {id}" y severidad según el número de incidentes
6. Elimina zonas "Hotspot" anteriores y reinserta las nuevas

**Frecuencia de ejecución**: Cada 1 hora vía Celery Beat

### Predicción de Tráfico

**Archivo**: `ml/predict_traffic.py`

Actualmente es un placeholder (archivo vacío). Está planificado implementar un modelo **XGBoost** para predicción temporal de flujo vehicular basado en datos históricos de telemetría.

---

## 12. Flujo de Datos Completo

```
                         ╔══════════════════════════════════╗
                         ║       INICIO (API Startup)       ║
                         ║   main.py → lifespan handler     ║
                         ╚══════════════════════════════════╝
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                       │
              ▼                      ▼                       ▼
   ╔══════════════════╗  ╔══════════════════╗  ╔══════════════════╗
   ║ Seed Zonas       ║  ║ Sync SIATA       ║  ║ Sync MEData      ║
   ║ (comunas JSON)   ║  ║ Flood Hazards    ║  ║ SODA Incidents   ║
   ╚══════════════════╝  ╚══════════════════╝  ╚══════════════════╝
              │                      │                       │
              └──────────────────────┼──────────────────────┘
                                     ▼
                    ╔══════════════════════════════════╗
                    ║     PostGIS + Redis CACHE        ║
                    ║  (Datos consolidados)            ║
                    ╚══════════════════════════════════╝
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                       │
              ▼                      ▼                       ▼
   ╔══════════════════╗  ╔══════════════════╗  ╔══════════════════╗
   ║ FRONTEND (REST)  ║  ║ FRONTEND (WS)    ║  ║ EXTERNAL         ║
   ║ Carga datos al   ║  ║ Recibe alertas   ║  ║ Consume API      ║
   ║ abrir el mapa    ║  ║ en vivo          ║  ║ REST             ║
   ╚══════════════════╝  ╚══════════════════╝  ╚══════════════════╝
                                     │
                                     ▼
                    ╔══════════════════════════════════╗
                    ║       CELERY BEAT (cada N min)   ║
                    ║  ┌─────────┐ ┌────────┐ ┌─────┐ ║
                    ║  │ SIATA   │ │Weather │ │ML   │ ║
                    ║  │15 min   │ │15 min  │ │1h   │ ║
                    ║  └─────────┘ └────────┘ └─────┘ ║
                    ║  ┌─────────┐ ┌────────┐         ║
                    ║  │Telemetry│ │Overspeed│        ║
                    ║  │1 min    │ │1 min   │         ║
                    ║  └─────────┘ └────────┘         ║
                    ╚══════════════════════════════════╝
```

### Ciclo de Actualización de Datos

| Dato | Frecuencia | Mecanismo |
|---|---|---|
| Zonas de inundación SIATA | Cada 15 min | Celery Beat → SIATA API |
| Clima / Pronóstico | Cada 15 min | Celery Beat → Open-Meteo → Redis Cache |
| Telemetría GPS | Streaming continuo | POST API → Redis Buffer → Cada 1 min → PostgreSQL |
| Alertas de exceso velocidad | Cada 1 min | Celery Beat → PostgreSQL + Redis Pub/Sub |
| Zonas calientes accidentes | Cada 1 hora | Celery Beat → PostGIS ST_ClusterDBSCAN |
| Reportes ciudadanos | Bajo demanda | Formulario → POST API → PostgreSQL |

---

## 13. Infraestructura y Despliegue

### Docker Compose (5 servicios)

| Servicio | Imagen | Puertos | Depende de |
|---|---|---|---|
| `db` | postgis/postgis:16-3.4 | 5432 | — |
| `redis` | redis:7-alpine | 6379 | — |
| `api` | build local | 8000 | db, redis (healthcheck) |
| `worker` | build local | — | api |
| `beat` | build local | — | worker |

### Scripts de Inicio

- **Linux** (`start.sh`): Crea entorno virtual, instala dependencias, aplica migraciones, inicia backend y frontend
- **Windows** (`start.bat`): Equivalente para PowerShell
- **Docker**: `docker-compose up` levanta todo el stack

### Health Checks

La API expone dos endpoints de monitoreo:
- `GET /health` — Verifica que la API responde (status 200)
- `GET /health/db` — Verifica conectividad con PostgreSQL (SELECT 1)

Docker Compose incluye healthchecks para `db` (`pg_isready`) y `redis` (`redis-cli ping`) cada 5 segundos.

---

## 14. API REST — Endpoints

### Sistema

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Health check básico |
| `GET` | `/health/db` | Verificación de base de datos |

### Autenticación

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Registrar nuevo usuario | No |
| `POST` | `/api/v1/auth/login` | Iniciar sesión (JWT) | No |
| `GET` | `/api/v1/auth/me` | Perfil del usuario autenticado | JWT |

### Usuarios

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| `GET` | `/api/v1/users/` | Listar usuarios | Admin |
| `GET` | `/api/v1/users/{id}` | Usuario por ID | JWT |
| `PUT` | `/api/v1/users/{id}` | Actualizar usuario | JWT |

### Reportes Ciudadanos

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| `POST` | `/api/v1/reports/` | Crear reporte | JWT |
| `GET` | `/api/v1/reports/` | Listar reportes | JWT |
| `GET` | `/api/v1/reports/{id}` | Reporte por ID | JWT |
| `PUT` | `/api/v1/reports/{id}` | Actualizar reporte | JWT |

### Endpoints Públicos (Mapa)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/v1/public/reports` | Reportes públicos |
| `GET` | `/api/v1/public/accidents` | Accidentes geolocalizados |
| `GET` | `/api/v1/public/accident-zones` | Zonas de accidentalidad (GeoJSON) |
| `GET` | `/api/v1/public/fatalities` | Incidentes fatales |
| `GET` | `/api/v1/public/flood-zones` | Zonas de inundación |
| `GET` | `/api/v1/public/nearby` | Búsqueda geográfica cercana |
| `GET` | `/api/v1/public/stats` | Estadísticas generales |
| `GET` | `/api/v1/public/telemetry/latest` | Última telemetría de vehículos |
| `GET` | `/api/v1/public/alerts` | Alertas activas |
| `GET` | `/api/v1/public/weather` | Clima actual |
| `GET` | `/api/v1/public/weather/forecast` | Pronóstico meteorológico |
| `GET` | `/api/v1/public/rain-risk` | Riesgo de lluvia |
| `GET` | `/api/v1/public/comunas` | Polígonos de comunas |
| `GET` | `/api/v1/public/comunas/stats` | Estadísticas por comuna |

### Clima

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/v1/weather/forecast` | Pronóstico Open-Meteo (proxy con caché Redis) |

### Vehículos

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| `GET` | `/api/v1/vehicles/` | Listar vehículos | JWT |
| `POST` | `/api/v1/vehicles/` | Registrar vehículo | JWT |
| `GET` | `/api/v1/vehicles/{id}` | Vehículo por ID | JWT |
| `PUT` | `/api/v1/vehicles/{id}` | Actualizar vehículo | JWT |
| `DELETE` | `/api/v1/vehicles/{id}` | Eliminar vehículo | JWT |

### Zonas de Accidentalidad

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| `GET` | `/api/v1/accident-zones/` | Listar zonas | JWT |
| `POST` | `/api/v1/accident-zones/` | Crear zona | JWT |
| `GET` | `/api/v1/accident-zones/{id}` | Zona por ID | JWT |
| `GET` | `/api/v1/accident-zones/nearby` | Zonas cercanas | JWT |

### Zonas de Inundación

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| `GET` | `/api/v1/flood-hazards/` | Listar zonas | JWT |
| `POST` | `/api/v1/flood-hazards/` | Crear zona | JWT |
| `GET` | `/api/v1/flood-hazards/{id}` | Zona por ID | JWT |
| `PUT` | `/api/v1/flood-hazards/{id}` | Actualizar zona | JWT |
| `GET` | `/api/v1/flood-hazards/nearby` | Zonas cercanas | JWT |

### Rutas

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/v1/routes/?origin=lat,lng&destination=lat,lng` | Calcular ruta segura |

### Telemetría

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| `POST` | `/api/v1/telemetry/` | Ingesta de datos GPS | API Key |

### WebSockets

| Ruta | Descripción |
|---|---|
| `WS /ws/telemetry?channel=global` | Streaming de telemetría en tiempo real + alertas |

### Documentación Interactiva

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## 15. Seguridad

### Autenticación JWT

- **Algoritmo**: HS256
- **Expiración**: 1440 minutos (24 horas), configurable
- **Implementación**: `python-jose` + `passlib` (bcrypt)
- **Flujo**:
  1. Usuario se registra con email y contraseña
  2. Inicia sesión → recibe un token JWT
  3. Cada petición autenticada incluye `Authorization: Bearer <token>`

### Roles y Permisos

| Rol | Descripción |
|---|---|
| `citizen` | Ciudadano — puede crear reportes y ver datos públicos |
| `authority` | Autoridad — puede gestionar vehículos, zonas y alertas |
| `admin` | Administrador — acceso completo incluyendo gestión de usuarios |

**Implementación**: `deps.py` — `require_role(*roles)` verifica que el token contenga el rol adecuado.

### API Key para Dispositivos GPS

- Los dispositivos GPS (máquinas, no usuarios) se autentican mediante header `X-API-Key`
- Validación con comparación de tiempo constante para prevenir timing attacks
- Configurable via `TELEMETRY_API_KEY` en variables de entorno

### Validación de Datos

- Todos los inputs se validan con **Pydantic v2** (schemas)
- Modelos SQLAlchemy con tipos estrictos
- PostGIS garantiza integridad geoespacial (SRID 4326 para WGS84)

---

## 16. Guía de Inicio Rápido

### Requisitos

- Python 3.12+
- Node.js 20+
- PostgreSQL 16+ con PostGIS 3.5+
- Redis 7+
- (Opcional) Docker + Docker Compose

### Opción 1: Docker (Recomendado)

```bash
git clone https://github.com/DylanOsdev/PPTMaps.git
cd PPTMaps/backend
cp .env.example .env
docker-compose up -d
```

Esto levanta: PostgreSQL + PostGIS, Redis, API FastAPI, Worker Celery, Beat Celery.

### Opción 2: Instalación Manual

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Linux
.\venv\Scripts\activate    # Windows
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
python seed_demo.py        # Datos demo
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend (otra terminal)
cd frontend
npm install
npm run dev
```

### Opción 3: Script Automatizado

```bash
chmod +x start.sh
./start.sh
```

---

## 17. Demo y Datos de Prueba

### seed_demo.py

Script independiente que genera un conjunto completo de datos demo:
- 5 vehículos demo con telemetría
- 2 alertas de ejemplo
- Sincronización de zonas de inundación SIATA
- 1 reporte de accidente ciudadano

### Datos Semilla Incorporados

El sistema incluye datos semilla para funcionar sin conexión a APIs externas:

| Componente | Cantidad | Descripción |
|---|---|---|
| Vehículos demo | 8 | 3 ambulancias, 3 patrullas, 2 bomberos — dispersos por Medellín |
| Alertas iniciales | 4 | Tráfico (Av. Oriental), SIATA (La Iguana), etc. |
| Accidentes semilla | 10 | Ubicaciones reales del área metropolitana |
| Zonas inundación | 5 | Río Medellín, quebradas La Iguana, Presidenta, Volcana |
| Estaciones SIATA | 5 | Datos con variación pseudoaleatoria cada 5 minutos |
| Comunas/Municipios | ~25 | Polígonos GeoJSON del Valle de Aburrá |

---

## Conclusión

**PPTMaps** es una plataforma completa de movilidad inteligente que demuestra cómo integrar múltiples fuentes de datos heterogéneas (APIs gubernamentales, datos abiertos, clima, reportes ciudadanos, telemetría IoT) en un sistema unificado con:

- **Arquitectura moderna**: FastAPI asíncrono, React 19, PostGIS, Celery, Redis
- **Tiempo real**: WebSockets + Redis Pub/Sub para alertas instantáneas
- **Resiliencia**: Patrón hexagonal con degradación suave cuando APIs externas fallan
- **Escalabilidad**: CQRS para telemetría, caché Redis, workers Celery
- **Inteligencia geoespacial**: Clustering DBSCAN nativo en PostGIS, rutas seguras con Shapely
- **UX**: Dashboard oscuro tipo centro de comando con capas superpuestas, widget climático y alimentación de alertas en vivo

---

*Documentación generada para el Hackathon HackData CTGI SENA 2026*
*Medellín, Colombia 🇨🇴*
