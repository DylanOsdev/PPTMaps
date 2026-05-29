#  MoviMed — Backend API

> **Plataforma unificada de movilidad inteligente para Medellín**  
> Backend construido con FastAPI · PostgreSQL + PostGIS · WebSockets · Celery · Redis · Docker  
> Proyecto para el **Hackatón HackData CTGI SENA 2026**

---

##  Tabla de Contenidos

- [Descripción](#descripción)
- [Arquitectura](#arquitectura)
- [Stack Tecnológico](#stack-tecnológico)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Instalación y Ejecución](#instalación-y-ejecución)
- [Variables de Entorno](#variables-de-entorno)
- [Endpoints de la API](#endpoints-de-la-api)
- [WebSockets](#websockets)
- [Tareas en Segundo Plano](#tareas-en-segundo-plano)
- [Migraciones con Alembic](#migraciones-con-alembic)
- [Testing](#testing)
- [Despliegue con Docker](#despliegue-con-docker)

---

## Descripción

MoviMed es una plataforma backend para la gestión inteligente de flotas vehiculares en Medellín. Permite:

- 📡 **Ingesta en tiempo real** de telemetría GPS con coordenadas geoespaciales (PostGIS).
- 🔐 **Autenticación segura** mediante JWT con roles de acceso (`admin`, `analyst`, `operator`, `user`).
- 🚗 **CRUD completo** de vehículos y usuarios.
- 📊 **Analítica** de velocidades, heatmaps y resúmenes de flota.
- 🔔 **Sistema de alertas** automáticas (exceso de velocidad, inactividad).
- 🔴 **Tiempo real** con WebSockets para transmisión de posiciones a dashboards.
- ⚙️ **Tareas asíncronas** con Celery + Redis para procesamiento pesado.

---

## Arquitectura

```
Cliente (Frontend / Dashboard)
        │
        ├── HTTP REST (FastAPI)  ──►  PostgreSQL + PostGIS
        │         │
        │         └── Celery Worker ──► Redis (Broker/Backend)
        │
        └── WebSocket (/ws/telemetry)
```

La arquitectura sigue principios de **Clean Architecture**:

| Capa | Directorio | Responsabilidad |
|---|---|---|
| Presentación | `app/api/` | Rutas HTTP y WebSocket |
| Aplicación | `app/services/` | Lógica de negocio |
| Dominio | `app/models/`, `app/schemas/` | Entidades y validación |
| Datos | `app/crud/`, `app/db/` | Acceso a base de datos |
| Infraestructura | `app/tasks/` | Celery, tareas asíncronas |

---

## Stack Tecnológico

| Tecnología | Versión | Uso |
|---|---|---|
| Python | 3.11+ | Lenguaje base |
| FastAPI | 0.111 | Framework HTTP/WebSocket |
| SQLAlchemy | 2.0 | ORM asíncrono |
| PostgreSQL | 15 | Base de datos principal |
| PostGIS | 3.3 | Extensión espacial |
| GeoAlchemy2 | 0.14 | Tipos geométricos en ORM |
| Alembic | 1.13 | Migraciones de BD |
| Celery | 5.4 | Tareas en segundo plano |
| Redis | 7 | Broker de mensajes |
| JWT / python-jose | 3.3 | Autenticación |
| passlib[bcrypt] | 1.7 | Hash de contraseñas |
| Docker + Compose | - | Contenedores |
| pytest + httpx | - | Testing asíncrono |

---

## Estructura del Proyecto

```
PPTMaps/
├── app/
│   ├── api/
│   │   ├── deps.py                  # Dependencias JWT y roles
│   │   └── v1/
│   │       ├── router.py            # Agregador de routers v1
│   │       └── endpoints/
│   │           ├── auth.py          # POST /auth/login, /register, /me
│   │           ├── users.py         # GET/PUT /users/
│   │           ├── vehicles.py      # CRUD /vehicles/
│   │           ├── telemetry.py     # POST/GET /telemetry/
│   │           ├── alerts.py        # GET/POST /alerts/
│   │           └── analytics.py     # GET /analytics/summary, /heatmap
│   ├── core/
│   │   ├── config.py               # Pydantic BaseSettings (.env)
│   │   ├── security.py             # JWT + bcrypt
│   │   └── exceptions.py           # Excepciones HTTP personalizadas
│   ├── db/
│   │   ├── base.py                  # Base declarativa SQLAlchemy
│   │   └── database.py             # Engine asíncrono + get_db()
│   ├── models/                     # Modelos SQLAlchemy
│   │   ├── user.py                  # User + UserRole enum
│   │   ├── vehicle.py               # Vehicle + VehicleStatus enum
│   │   ├── telemetry.py             # Telemetry con Geometry(POINT)
│   │   └── alert.py                 # Alert + AlertSeverity enum
│   ├── schemas/                    # Validadores Pydantic (I/O)
│   ├── crud/                       # Data Access Objects
│   ├── websocket/
│   │   ├── connection_manager.py   # Manager multi-canal
│   │   └── ws_router.py            # Endpoint WS /ws/telemetry
│   ├── tasks/
│   │   ├── celery_app.py           # Config Celery + beat schedule
│   │   └── worker.py               # Tareas: overspeed, stats
│   ├── tests/                      # Pytest + httpx
│   └── main.py                     # Entrypoint FastAPI
├── alembic/                        # Migraciones
├── docker/
│   └── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── pytest.ini
└── .env.example
```

---

## Instalación y Ejecución

### Opción 1 — Docker Compose (recomendado)

```bash
# 1. Clonar el repositorio
git clone <url-del-repo> && cd PPTMaps

# 2. Copiar y configurar variables de entorno
cp .env.example .env

# 3. Levantar todos los servicios (DB, Redis, API, Worker)
docker-compose up --build
```

La API estará disponible en: **http://localhost:8000/docs**

### Opción 2 — Entorno local

```bash
# 1. Crear entorno virtual e instalar dependencias
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales locales de PostgreSQL y Redis

# 3. Correr migraciones
alembic upgrade head

# 4. Levantar el servidor
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## Variables de Entorno

Crea un archivo `.env` basado en `.env.example`:

```env
PROJECT_NAME="MoviMed API"
API_V1_STR="/api/v1"

# PostgreSQL + PostGIS
POSTGRES_SERVER=localhost
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=movimed
POSTGRES_PORT=5432

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT
SECRET_KEY=cambia-esta-clave-en-produccion
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# CORS (URLs del frontend)
BACKEND_CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]
```

---

## Endpoints de la API

Documentación interactiva disponible en: `/docs` (Swagger UI) y `/redoc`

### 🔐 Autenticación

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/v1/auth/register` | Registrar nuevo usuario | ❌ |
| `POST` | `/api/v1/auth/login` | Iniciar sesión → JWT | ❌ |
| `GET` | `/api/v1/auth/me` | Perfil del usuario actual | ✅ |

**Ejemplo de login:**
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -d "username=admin@movimed.co&password=Pass123!" \
  -H "Content-Type: application/x-www-form-urlencoded"

# Respuesta:
# { "access_token": "eyJ...", "token_type": "bearer" }
```

### 🚗 Vehículos

| Método | Endpoint | Descripción | Roles |
|--------|----------|-------------|-------|
| `GET` | `/api/v1/vehicles/` | Listar todos | Todos |
| `POST` | `/api/v1/vehicles/` | Crear vehículo | admin, operator |
| `GET` | `/api/v1/vehicles/{id}` | Obtener por ID | Todos |
| `PUT` | `/api/v1/vehicles/{id}` | Actualizar | admin, operator |
| `DELETE` | `/api/v1/vehicles/{id}` | Eliminar | admin |

**Ejemplo crear vehículo:**
```bash
curl -X POST http://localhost:8000/api/v1/vehicles/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"plate": "ABC123", "type": "Ambulance", "status": "ACTIVE"}'
```

### 📡 Telemetría

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/v1/telemetry/` | Ingestar 1 punto GPS |
| `POST` | `/api/v1/telemetry/bulk` | Ingesta masiva (array) |
| `GET` | `/api/v1/telemetry/` | Listar con filtros |
| `GET` | `/api/v1/telemetry/latest` | Última posición por vehículo |
| `GET` | `/api/v1/telemetry/nearby?lat=6.25&lng=-75.56&radius_meters=500` | Búsqueda espacial |

**Ejemplo ingesta GPS:**
```bash
curl -X POST http://localhost:8000/api/v1/telemetry/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_id": "uuid-del-vehiculo",
    "timestamp": "2026-05-29T20:00:00Z",
    "latitude": 6.2518,
    "longitude": -75.5636,
    "speed": 42.5,
    "heading": 90.0
  }'
```

### 📊 Analítica

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/v1/analytics/summary` | KPIs generales |
| `GET` | `/api/v1/analytics/heatmap` | Datos para mapa de calor |
| `GET` | `/api/v1/analytics/speed-stats` | Stats de velocidad por vehículo |

---

## WebSockets

Conectar al canal de telemetría en tiempo real:

```javascript
// Suscripción global (todos los vehículos)
const ws = new WebSocket("ws://localhost:8000/ws/telemetry?channel=global");

// Suscripción a un vehículo específico
const ws = new WebSocket("ws://localhost:8000/ws/telemetry?channel=<vehicle-uuid>");

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Posición actualizada:", data);
};
```

Para emitir datos desde el backend hacia los clientes WebSocket, el servicio de telemetría llama a `manager.broadcast()` después de persistir cada punto GPS.

---

## Tareas en Segundo Plano

Celery ejecuta dos tareas periódicas (configuradas en `beat_schedule`):

| Tarea | Frecuencia | Descripción |
|-------|-----------|-------------|
| `check_overspeed_alerts` | Cada 60s | Detecta exceso de velocidad y crea alertas |
| `calculate_hourly_stats` | Cada 1h | Calcula estadísticas de flota por hora |

**Levantar worker manualmente:**
```bash
celery -A app.tasks.celery_app.celery_app worker --loglevel=info
celery -A app.tasks.celery_app.celery_app beat --loglevel=info
```

**Monitoreo con Flower:**
```bash
celery -A app.tasks.celery_app.celery_app flower --port=5555
# UI disponible en http://localhost:5555
```

---

## Migraciones con Alembic

```bash
# Crear una nueva migración automática (detecta cambios en modelos)
alembic revision --autogenerate -m "descripcion_del_cambio"

# Aplicar todas las migraciones pendientes
alembic upgrade head

# Revertir la última migración
alembic downgrade -1

# Ver historial de migraciones
alembic history
```

> **Nota:** Al levantar con Docker Compose, las migraciones se ejecutan automáticamente antes de iniciar el servidor.

---

## Testing

```bash
# Instalar dependencias de testing adicionales
pip install aiosqlite

# Ejecutar todos los tests
pytest

# Con cobertura
pytest --cov=app --cov-report=term-missing

# Un módulo específico
pytest app/tests/test_auth.py -v
```

Los tests usan una base de datos **SQLite en memoria** para no depender de PostgreSQL durante el CI/CD.

---

## Despliegue con Docker

```bash
# Construir e iniciar todos los servicios
docker-compose up --build -d

# Ver logs de la API
docker-compose logs -f web

# Ver logs del worker Celery
docker-compose logs -f worker

# Detener todos los servicios
docker-compose down

# Detener y eliminar volúmenes (borra la BD)
docker-compose down -v
```

**Servicios expuestos:**

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| API FastAPI | `8000` | REST + WebSocket |
| PostgreSQL | `5432` | Base de datos |
| Redis | `6379` | Broker Celery |
| Flower (Celery UI) | `5555` | Monitoreo de tareas |

---

## 👥 Autores

Proyecto desarrollado para el **Hackatón HackData CTGI SENA 2026**.

---

## 📄 Licencia

MIT License — libre uso para fines académicos y de competencia.
