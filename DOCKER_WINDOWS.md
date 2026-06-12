# 🐳 Ejecutar PPTMaps en Docker (Windows)

## Requisitos Previos

- Docker Desktop para Windows instalado y corriendo
- Git Bash o PowerShell

---

## 🚀 Inicio Rápido

### Opción 1: PowerShell

```powershell
# 1. Ir al directorio backend
cd backend

# 2. Detener contenedores anteriores (si existen)
docker-compose -f docker-compose.pptmaps.yml down -v

# 3. Levantar todo el stack (primera vez: ~3-5 minutos)
docker-compose -f docker-compose.pptmaps.yml up -d --build

# 4. Ver logs en tiempo real
docker-compose -f docker-compose.pptmaps.yml logs -f api
```

**Presiona `Ctrl+C` para salir de los logs** (los contenedores siguen corriendo)

---

### Opción 2: Git Bash

```bash
cd backend
docker-compose -f docker-compose.pptmaps.yml down -v
docker-compose -f docker-compose.pptmaps.yml up -d --build
docker-compose -f docker-compose.pptmaps.yml logs -f api
```

---

## ✅ Verificar que Funciona

Abre tu navegador y visita:

- **Frontend**: http://localhost:8000
- **Dashboard**: http://localhost:8000/dashboard
- **API Docs**: http://localhost:8000/docs
- **Estadísticas Accidentes**: http://localhost:8000/api/v1/public/accidents/stats
- **Estadísticas Clima**: http://localhost:8000/api/v1/public/weather/stats

---

## 📊 Primera Ejecución - Qué Esperar

La primera vez que ejecutes `docker-compose up`, verás:

```
✅ PostgreSQL listo
🔧 Aplicando migraciones de base de datos...
📊 Verificando datos de accidentalidad...
📥 Ingesta iniciada (702,540 registros)...
✅ Datos de accidentes cargados exitosamente
🌦️  Verificando datos históricos de clima...
📥 Cargando 157,800 registros de clima (2008-2025)...
✅ Clima histórico cargado exitosamente
🚀 Iniciando API...
```

**Tiempo estimado**: 3-5 minutos

---

## 🔄 Ejecuciones Siguientes

Las siguientes veces que ejecutes `docker-compose up`:

- ✅ Los datos YA están cargados
- ⏱️ Solo arranca servicios (~30 segundos)
- 🚀 Listo para usar inmediatamente

---

## 🛑 Detener Todo

```powershell
cd backend
docker-compose -f docker-compose.pptmaps.yml down
```

**Esto detiene los contenedores pero mantiene los datos.**

---

## 🗑️ Limpiar Todo (Incluyendo Datos)

```powershell
cd backend
docker-compose -f docker-compose.pptmaps.yml down -v
```

**Advertencia**: `-v` elimina los volúmenes. La próxima vez tendrás que cargar todo de nuevo.

---

## 🐛 Solución de Problemas

### Error: "puerto 8000 ya en uso"

```powershell
# Ver qué está usando el puerto
netstat -ano | findstr :8000

# Detener el proceso (reemplaza <PID> con el número que aparece)
taskkill /PID <PID> /F
```

### Error: "no se puede conectar a Docker"

1. Abre Docker Desktop
2. Espera que diga "Docker Desktop is running"
3. Intenta de nuevo

### Logs completos de todos los servicios

```powershell
docker-compose -f docker-compose.pptmaps.yml logs
```

### Ver solo logs de un servicio específico

```powershell
# API
docker-compose -f docker-compose.pptmaps.yml logs api

# Worker (Celery)
docker-compose -f docker-compose.pptmaps.yml logs worker

# Base de datos
docker-compose -f docker-compose.pptmaps.yml logs db
```

---

## 📦 Servicios Incluidos

El stack completo incluye:

- **api**: Backend FastAPI + Frontend React
- **db**: PostgreSQL 16 + PostGIS
- **redis**: Cache Redis 7
- **worker**: Celery worker (tareas asíncronas)
- **beat**: Celery beat (tareas programadas)

---

## 🎯 Comandos Útiles

```powershell
# Ver contenedores corriendo
docker ps

# Entrar a un contenedor
docker exec -it backend-api-1 bash

# Ver uso de recursos
docker stats

# Reconstruir solo un servicio
docker-compose -f docker-compose.pptmaps.yml up -d --build api
```

---

## ✅ Todo Funcionando

Si ves esto en los logs, **TODO ESTÁ BIEN**:

```
✅ accident_incidents ya contiene 702540 registros
✅ historical_weather_medellin ya contiene 157800 registros
INFO:     Application startup complete.
```

Ahora podés abrir http://localhost:8000 y usar la aplicación. 🚀
