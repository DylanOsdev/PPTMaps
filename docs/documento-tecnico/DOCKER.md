# PPTMaps - Docker Stack

Stack completo de PPTMaps en Docker (PostgreSQL + PostGIS, Redis, API, Worker, Beat, Frontend).

## 🚀 Inicio Rápido

### 1. Levantar el stack

```bash
cd backend
docker-compose -f docker-compose.pptmaps.yml up -d
```

Esto levanta:
- **PostgreSQL 16 + PostGIS 3.4** (puerto 5433)
- **Redis 7** (puerto 6380)
- **FastAPI** (puerto 8000) — API + Frontend compilado
- **Celery Worker** — procesa tareas async
- **Celery Beat** — scheduler de tareas periódicas

### 2. Verificar que todo funciona

```bash
./test_docker_stack.sh
```

El script verifica:
- ✅ 5 contenedores corriendo
- ✅ PostgreSQL + PostGIS activos
- ✅ Redis respondiendo
- ✅ API health checks (200 OK)
- ✅ 702,540 incidentes en `accident_incidents`
- ✅ Endpoint `/api/v1/public/accidents/stats` funcionando
- ✅ Frontend servido en `/`
- ✅ Dashboard accesible en `/dashboard`
- ✅ Celery worker ejecutando

### 3. Acceder a la aplicación

| Servicio | URL |
|----------|-----|
| **Landing** | http://localhost:8000 |
| **Dashboard** | http://localhost:8000/dashboard |
| **Mapa** | http://localhost:8000/map |
| **API Docs** | http://localhost:8000/docs |
| **PostgreSQL** | localhost:5433 |
| **Redis** | localhost:6380 |

## 📊 Cargar Datos de Accidentalidad

Si la tabla `accident_incidents` está vacía (0 registros):

### Opción 1: Dataset oficial (702k registros, 2008-2025)

1. Descargar desde Mendeley: https://data.mendeley.com/datasets/r6g5dfnpgh/1
2. Extraer `Fatal_Road_Traffic.xlsx` en `backend/`
3. Ejecutar:

```bash
docker-compose -f docker-compose.pptmaps.yml exec api python -m scripts.ingest_accidents /repo/backend/Fatal_Road_Traffic.xlsx
```

**Tiempo estimado**: ~30 segundos

### Opción 2: Datos de demo

```bash
docker-compose -f docker-compose.pptmaps.yml exec api python seed_demo.py
```

Crea datos mínimos (vehículos, telemetría, 1 accidente, alertas, flood_hazards).

## 🔧 Comandos Útiles

### Ver logs
```bash
# Todos los servicios
docker-compose -f docker-compose.pptmaps.yml logs -f

# Solo API
docker-compose -f docker-compose.pptmaps.yml logs -f api

# Solo Worker
docker-compose -f docker-compose.pptmaps.yml logs -f worker
```

### Reiniciar servicios
```bash
# Reiniciar API
docker-compose -f docker-compose.pptmaps.yml restart api

# Reiniciar todo
docker-compose -f docker-compose.pptmaps.yml restart
```

### Detener el stack
```bash
docker-compose -f docker-compose.pptmaps.yml down
```

### Detener y limpiar volúmenes (BORRA LA BD)
```bash
docker-compose -f docker-compose.pptmaps.yml down -v
```

### Rebuild después de cambios en el código
```bash
# Rebuild API + Frontend
docker-compose -f docker-compose.pptmaps.yml build api

# Rebuild Worker y Beat
docker-compose -f docker-compose.pptmaps.yml build worker beat

# Reiniciar después del rebuild
docker-compose -f docker-compose.pptmaps.yml up -d
```

## 🐛 Troubleshooting

### Error: "port is already allocated"
Otro servicio está usando el puerto. Opciones:
1. Detener el servicio conflictivo
2. Cambiar el puerto en `docker-compose.pptmaps.yml`

### La API no arranca
```bash
# Ver logs detallados
docker-compose -f docker-compose.pptmaps.yml logs api

# Verificar que las migraciones corrieron
docker-compose -f docker-compose.pptmaps.yml exec api alembic current
```

### Base de datos vacía después de reiniciar
El volumen `pgdata` persiste los datos. Si lo borraste con `down -v`, necesitás:
1. Volver a levantar el stack
2. Re-ingestar el dataset de accidentalidad

### Worker no ejecuta tareas
```bash
# Verificar que Redis esté accesible
docker-compose -f docker-compose.pptmaps.yml exec redis redis-cli PING

# Ver logs del worker
docker-compose -f docker-compose.pptmaps.yml logs worker
```

## 📦 Estructura de Contenedores

```
┌─────────────────────────────────────────────────────────┐
│                      backend-api-1                      │
│  FastAPI + Uvicorn + Frontend (dist)                    │
│  - Migraciones Alembic al arranque                      │
│  - Sirve API en :8000/api/v1                            │
│  - Sirve frontend compilado en :8000/                   │
└─────────────────────────────────────────────────────────┘
                           ↓ depends_on
┌──────────────────────┐  ┌─────────────────────────────┐
│   backend-db-1       │  │     backend-redis-1         │
│ PostgreSQL 16        │  │     Redis 7                 │
│ PostGIS 3.4          │  │     Puerto: 6380            │
│ Puerto: 5433         │  │                             │
│ Volume: pgdata       │  └─────────────────────────────┘
└──────────────────────┘
                           ↓ depends_on api
┌─────────────────────────────────────────────────────────┐
│              backend-worker-1                           │
│  Celery Worker                                          │
│  - Procesa tareas: telemetry.flush, overspeed.check    │
│  - SIATA sync, weather sync, ML clustering             │
└─────────────────────────────────────────────────────────┘
                           ↓ depends_on worker
┌─────────────────────────────────────────────────────────┐
│               backend-beat-1                            │
│  Celery Beat (scheduler)                                │
│  - Encola tareas periódicas cada 1-15 min              │
└─────────────────────────────────────────────────────────┘
```

## ✅ Verificación Post-Despliegue

Ejecutá el test completo:
```bash
./test_docker_stack.sh
```

Deberías ver:
```
✓ 5/5 contenedores corriendo
✓ PostgreSQL + PostGIS funcionando
✓ Redis respondiendo
✓ API health check OK (200)
✓ 702,540 incidentes cargados en accident_incidents
✓ Endpoint /accidents/stats respondiendo
✓ Frontend servido en / (200)
✓ Dashboard accesible en /dashboard
✓ Celery worker activo y listo
```
