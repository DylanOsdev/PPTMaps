# Calidad del Aire — PPTMaps

## Resumen

PPTMaps integra datos en tiempo real de calidad del aire para el Valle de Aburrá mediante la [World Air Quality Index API (WAQI)](https://waqi.info/). El sistema provee:

- **15 estaciones activas** monitoreando AQI, PM2.5, PM10, NO₂, O₃, SO₂
- **Widget en el mapa** con AQI promedio del Valle de Aburrá
- **Capa de mapa interactiva** con marcadores geográficos coloreados según nivel
- **Sincronización automática** cada 1 hora vía Celery

---

## Stack Tecnológico

```
WAQI API ─┬─> Backend (FastAPI + Celery)
          │   ├─ Modelo PostGIS: air_quality_readings
          │   ├─ Servicio: AirQualitySyncService (hexagonal)
          │   ├─ Endpoint: /api/v1/public/air-quality/current
          │   └─ Tarea Celery: air_quality.sync (cada 1h)
          │
          └─> Frontend (React + Leaflet)
              ├─ Widget: AirQualityWidget.jsx
              ├─ Hook: useAirQuality.js (refresh 5min)
              └─ Capa mapa: air-quality-stations
```

---

## Arquitectura Backend

### Modelo PostGIS

```python
class AirQualityReading(Base):
    __tablename__ = "air_quality_readings"
    
    id: int
    station_id: str
    station_name: str
    aqi: int                    # Air Quality Index (0-500)
    pm25: float                 # PM2.5 (µg/m³)
    pm10: float                 # PM10 (µg/m³)
    no2: float                  # Dióxido de nitrógeno (µg/m³)
    o3: float                   # Ozono (µg/m³)
    so2: float                  # Dióxido de azufre (µg/m³)
    temp: float                 # Temperatura (°C)
    humidity: float             # Humedad relativa (%)
    timestamp: datetime         # Timestamp del reporte
    geom: Geometry(Point)       # Coordenadas PostGIS
    created_at: datetime
```

**Índices**:
- `idx_air_quality_station_timestamp` (UNIQUE)
- `idx_air_quality_geom` (GIST)
- `idx_air_quality_timestamp` (DESC)

### Servicio Hexagonal

```python
# Puerto
class AirQualityClient(Protocol):
    async def fetch_readings(self) -> List[AirQualityData]: ...

# Adaptador HTTP real
class WAQIHttpClient(AirQualityClient):
    """Consume WAQI API — 21 estaciones configuradas."""
    
# Adaptador Seed (fallback)
class AQISeedClient(AirQualityClient):
    """Datos de prueba con variación temporal."""
```

### Tarea Celery

```python
@celery_app.task(name="air_quality.sync")
def sync_air_quality() -> int:
    """Sincroniza datos de WAQI cada 1 hora."""
    # Configurado en beat schedule
```

---

## Frontend

### Widget CommandCenter

Componente: `frontend/src/components/AirQualityWidget.jsx`

- Muestra AQI promedio de todas las estaciones
- Código de color según nivel (verde/amarillo/naranja/rojo)
- Recomendaciones de salud según AQI
- Actualización automática cada 5 minutos

### Capa de Mapa

Archivos clave:
- `frontend/src/static/js/map/demo-layers.js` → `updateAirQualityStations()`
- `frontend/src/static/js/services/api.js` → `fetchAirQualityStations()`
- `frontend/src/static/js/map/map-service.js` → `loadAirQualityData()`

**Marcadores**:
- Círculos coloreados con valor AQI al centro
- Popup con: estación, AQI, nivel, PM2.5, PM10, temp, humedad, timestamp

**Colores**:
- 🟢 Verde (0-50): Buena
- 🟡 Amarillo (51-100): Moderada
- 🟠 Naranja (101-150): Mala
- 🔴 Rojo (150+): Muy Mala

---

## Cobertura Geográfica

### ✅ Estaciones Activas (15)

#### Medellín (6 comunas)

| Comuna | Estación WAQI | AQI Típico |
|--------|---------------|------------|
| **C4 Aranjuez** | Aranjuez | 55 |
| **C8 Villa Hermosa** | Villahermosa | 55 |
| **C16 Belén** | Belén | 48 |
| **C14 Poblado** | Politécnico Jaime Isaza Cadavid | 30 |
| **C70 Altavista** (corregimiento) | Altavista | 70 |
| **C90 Santa Elena** (corregimiento) | Santa Elena | 17 |

#### Área Metropolitana (4 municipios)

| Municipio | Estación WAQI | AQI Típico |
|-----------|---------------|------------|
| **Bello** | Bello | 52 |
| **Copacabana** | Copacabana | 42 |
| **Caldas** | Caldas | ~60 |
| **La Estrella** | La Estrella | 69 |

**Estaciones adicionales** (nombres completos en WAQI):
- El Poblado (segunda estación)
- Otras estaciones con nombres completos en API

---

## ❌ Comunas Sin Cobertura

Las siguientes comunas de Medellín **no tienen estaciones WAQI públicas disponibles**:

### Comunas Urbanas (10)

- **C1 Popular**
- **C2 Santa Cruz**
- **C3 Manrique**
- **C5 Castilla**
- **C6 Doce de Octubre**
- **C7 Robledo**
- **C9 Buenos Aires**
- **C10 La Candelaria**
- **C11 Laureles**
- **C12 La América**
- **C13 San Javier**
- **C15 Guayabal**

### Corregimientos (3)

- **C50 San Sebastián de Palmitas**
- **C60 San Cristóbal**
- **C80 San Antonio de Prado**

---

## Limitaciones y Alternativas

### ¿Por qué faltan estaciones?

1. **WAQI API pública** — Solo expone estaciones con datos públicos disponibles
2. **Infraestructura limitada** — No todas las comunas tienen sensores de calidad del aire instalados
3. **Área Metropolitana de Medellín** — La red oficial de monitoreo de calidad del aire es operada por el Área Metropolitana del Valle de Aburrá, y WAQI consume datos de esta red cuando están disponibles públicamente

### Alternativas para cobertura completa

#### Opción 1: Área Metropolitana del Valle de Aburrá
- **Entidad**: Autoridad ambiental oficial del Valle de Aburrá
- **Web**: https://www.metropol.gov.co/
- **Red REDAIRE**: Sistema de Vigilancia de Calidad del Aire
- **Problema**: No tienen API pública documentada
- **Solución**: Contactar el Área Metropolitana para solicitar acceso a datos de REDAIRE

#### Opción 2: Interpolación Geoespacial
- Usar las 15 estaciones actuales para interpolar AQI en comunas vecinas
- Algoritmos: IDW (Inverse Distance Weighting), Kriging
- **Ventaja**: Cobertura completa estimada
- **Desventaja**: Datos no son mediciones reales

#### Opción 3: Sensores Ciudadanos
- Integrar dispositivos IoT comunitarios (Purple Air, Airgradient)
- **Ventaja**: Datos hiper-locales
- **Desventaja**: Requiere hardware y mantenimiento

#### Opción 4: Mantener cobertura actual ✅
- 15 estaciones es representativo del Valle de Aburrá
- Cubre 6 comunas + 4 municipios = ~50% área urbana
- **Recomendación actual**: Esta es la opción implementada

---

## Configuración

### Variables de Entorno

```bash
# backend/.env
WAQI_API_TOKEN=tu_token_aqui  # Obtener en https://aqicn.org/data-platform/token/
```

### Obtener Token WAQI

1. Visitar: https://aqicn.org/data-platform/token/
2. Registrarse con email
3. Copiar token y agregarlo al `.env`
4. Reiniciar contenedores Docker

---

## Endpoints API

### GET `/api/v1/public/air-quality/current`

Retorna lecturas más recientes de todas las estaciones (última hora).

**Respuesta**:
```json
[
  {
    "id": 17,
    "station_id": "H12513",
    "station_name": "Aranjuez",
    "aqi": 55,
    "pm25": 16.5,
    "pm10": 24.8,
    "no2": 9.5,
    "o3": 44.4,
    "so2": 4.0,
    "temp": 21.4,
    "humidity": 76.6,
    "timestamp": "2026-06-12T02:04:00Z",
    "lat": 6.273,
    "lng": -75.553,
    "created_at": "2026-06-12T02:04:24.592549Z"
  }
]
```

---

## Uso en CommandCenter

1. Abrir: **http://localhost:8000**
2. En el panel izquierdo **DATA LAYERS**, expandir **"🌬️ CALIDAD DEL AIRE"**
3. Activar toggle **"Estaciones de monitoreo AQI"**
4. Hacer clic en marcadores para ver detalles de cada estación

**Widget automático**:
- Visible en la barra lateral derecha
- Muestra AQI promedio del Valle de Aburrá
- Se actualiza cada 5 minutos

---

## Próximos Pasos (Opcional)

- [ ] Contactar SIATA para acceso a más estaciones
- [ ] Implementar interpolación geoespacial para comunas sin cobertura
- [ ] Agregar histórico de AQI (gráficas de tendencias)
- [ ] Alertas push cuando AQI > 100 (Mala calidad)
- [ ] Predicción ML de AQI para próximas 24h
- [ ] Integración con reportes ciudadanos (relacionar incidentes con calidad del aire)

---

## Referencias

- WAQI API: https://aqicn.org/json-api/doc/
- Índice AQI: https://www.airnow.gov/aqi/aqi-basics/
- Área Metropolitana del Valle de Aburrá: https://www.metropol.gov.co/
- Red REDAIRE: https://www.metropol.gov.co/ambiental/calidad-del-aire
- PostGIS: https://postgis.net/

---

**Última actualización**: 2026-06-11  
**Versión**: 1.0.0  
**Estado**: Producción ✅
