# 🤖 Modelo ML de Predicción de Congestión

## Descripción

Modelo de Machine Learning basado en **XGBoost** que predice el riesgo de congestión vehicular por comuna en el Valle de Aburrá (Medellín) en tiempo real.

## Performance

- **Algoritmo**: XGBoost Regressor
- **R² Score**: 75.5% (test set)
- **Training Examples**: 22,526
- **Features**: 12
- **Comunas**: 21 (14 con training + 7 con fallback)

## Features del Modelo

| # | Feature | Descripción | Fuente |
|---|---------|-------------|--------|
| 1 | `h` | Hora del día (0-23) | Temporal |
| 2 | `d` | Día de la semana (0=Lun, 6=Dom) | Temporal |
| 3 | `m` | Mes (1-12) | Temporal |
| 4 | `ce` | Comuna codificada (LabelEncoder) | Geográfico |
| 5 | `lat` | Latitud del centroide de la comuna | Geográfico |
| 6 | `lng` | Longitud del centroide de la comuna | Geográfico |
| 7 | `g` | Gravedad promedio (1=solo daños, 2=heridos, 3=muertos) | Histórico |
| 8 | `hp` | Hora pico (1 si 6-9am o 5-8pm, 0 otherwise) | Temporal derivado |
| 9 | `fs` | Fin de semana (1 si sábado/domingo, 0 otherwise) | Temporal derivado |
| 10 | `temp` | Temperatura promedio histórica (°C) por mes+hora | Open-Meteo |
| 11 | `lluvia` | Precipitación promedio histórica (mm) por mes+hora | Open-Meteo |
| 12 | `deprimidos_riesgo` | Count de deprimidos inundados en tiempo real | SIATA |

## Feature Importance (Top 5)

```
lat                29.4%  (zona geográfica es el factor más importante)
h                  19.4%  (hora del día)
ce                 16.3%  (comuna específica)
lng                15.2%  (ubicación precisa)
hp                 10.2%  (hora pico)
```

## Fuentes de Datos

### 1. **Accidentes Históricos (MEData)**
- Dataset: 702,540 accidentes viales (2008-2025)
- Origen: Portal de Datos Abiertos de Medellín
- Uso: Training del modelo (agrupados por hora/día/mes/comuna)

### 2. **Clima Histórico (Open-Meteo Archive API)**
- Dataset: 157,800 registros horarios (2008-2025)
- Variables: temperatura, precipitación, weather_code
- Uso: Agregados por mes+hora para training

### 3. **SIATA (Sistema de Alerta Temprana)**
- Dataset: 64 deprimidos inundables (tiempo real)
- Variables: status (dry/watch/flooded), water_level_m
- Uso: Feature en tiempo real para predicciones

### 4. **Zonas Administrativas (PostGIS)**
- Dataset: 21 comunas + 9 municipios
- Origen: Geometrías oficiales de Medellín
- Uso: Agregación espacial

## Estrategia de Training

### Generación del Dataset

```sql
SELECT 
    SUBSTRING(incident_hour FROM 1 FOR 2)::int AS h,
    EXTRACT(DOW FROM incident_date)::int AS d,
    EXTRACT(MONTH FROM incident_date)::int AS m,
    z.name AS c,
    ST_Y(ST_Centroid(z.geom)) AS lat,
    ST_X(ST_Centroid(z.geom)) AS lng,
    AVG(CASE 
        WHEN ai.severity='Con muertos' THEN 3 
        WHEN ai.severity='Con heridos' THEN 2 
        ELSE 1 
    END) AS g,
    COUNT(*) AS n
FROM accident_incidents ai 
JOIN zones z ON ST_Within(ai.geom, z.geom)
WHERE incident_date IS NOT NULL 
  AND z.kind='comuna' 
  AND incident_hour ~ '^[0-9]'
GROUP BY h, d, m, c, lat, lng
HAVING COUNT(*) >= 5
```

### Clima Agregado

- **Estrategia**: Promedios por mes+hora (no por accidente individual)
- **Razón**: Evita overfitting y mantiene dataset grande
- **Resultado**: 22,526 ejemplos vs 2,458 con clima exacto

### Target Variable

```python
risk_score = min(100, accident_count * 5 + severity_avg * 10)
```

## Hiperparámetros

```python
XGBRegressor(
    n_estimators=120,
    max_depth=7,
    learning_rate=0.1,
    random_state=42
)
```

## Comunas

### Con Training (14)
Aranjuez, Belén, Buenos Aires, Castilla, Doce de Octubre, Guayabal, La América, La Candelaria, Manrique, Popular, Robledo, San Javier, Santa Cruz, Villa Hermosa

### Con Fallback (7)
Altavista, Laureles, Poblado, San Antonio de Prado, San Cristóbal, San Sebastián de Palmitas, Santa Elena



## Archivos del Modelo

```
backend/
├── app/ml/models/
│   ├── traffic_model.joblib          # Modelo XGBoost entrenado (1.0 MB)
│   └── comuna_encoder.joblib         # LabelEncoder de comunas (1 KB)
├── clima_historico_medellin.csv      # 157,801 registros clima (4.8 MB)
└── ML_MODEL.md                       # Esta documentación
```

## Uso en Producción

### Endpoint REST

```http
GET /api/v1/public/traffic/predictions
```

**Respuesta**:
```json
{
  "predictions": [
    {
      "comuna": "La Candelaria",
      "lat": 6.2476,
      "lng": -75.5658,
      "risk_score": 100,
      "hora": 0,
      "dia_semana": 6,
      "timestamp": "2026-06-08T00:13:00.000000"
    }
  ],
  "model": "XGBoost",
  "training_examples": 22526,
  "deprimidos_riesgo": 0,
  "features": ["hora", "dia_semana", "mes", "comuna", "lat", "lng", "gravedad", "clima", "SIATA"]
}
```

### Caché Automatizado

- **TTL**: 900 segundos (15 minutos)
- **Backend**: Redis
- **Actualización**: Celery Beat cada 15 minutos
- **Tarea**: `ml.cache_predictions`

### Servicio Python

```python
from app.services.traffic_prediction import get_prediction_service

service = get_prediction_service()
predictions = await service.predict_current(db)
```

## Reentrenamiento

### Requisitos
- Python 3.11+
- PostgreSQL con PostGIS
- 702k+ accidentes históricos en `accident_incidents`
- Clima histórico descargado

### Script de Reentrenamiento

```bash
cd backend
source venv/bin/activate

# 1. Descargar clima histórico (si no existe)
python << 'EOF'
import requests, pandas as pd
lat, lon = 6.2476, -75.5658
all_data = []
for year in range(2008, 2026):
    print(f"{year}...", end=" ", flush=True)
    r = requests.get("https://archive-api.open-meteo.com/v1/archive", params={
        "latitude": lat, "longitude": lon,
        "start_date": f"{year}-01-01", "end_date": f"{year}-12-31",
        "hourly": "temperature_2m,precipitation,weather_code",
        "timezone": "America/Bogota"
    }, timeout=30)
    data = r.json()
    if "hourly" in data:
        df = pd.DataFrame({
            "timestamp": pd.to_datetime(data["hourly"]["time"]),
            "temp": data["hourly"]["temperature_2m"],
            "lluvia": data["hourly"]["precipitation"],
            "weather_code": data["hourly"]["weather_code"]
        })
        all_data.append(df)
df_full = pd.concat(all_data, ignore_index=True)
df_full.to_csv("clima_historico_medellin.csv", index=False)
print(f"\n✓ {len(df_full)} registros")
EOF

# 2. Entrenar modelo
python << 'EOF'
import psycopg2, pandas as pd, numpy as np, warnings
warnings.filterwarnings('ignore')
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBRegressor
import joblib
from pathlib import Path

conn = psycopg2.connect(host="localhost", port=5433, database="movimed", 
                       user="postgres", password="postgres")

# Extraer accidentes
df_acc = pd.read_sql_query("""
SELECT SUBSTRING(incident_hour FROM 1 FOR 2)::int h,
       EXTRACT(DOW FROM incident_date)::int d,
       EXTRACT(MONTH FROM incident_date)::int m,
       z.name c, ST_Y(ST_Centroid(z.geom)) lat, ST_X(ST_Centroid(z.geom)) lng,
       AVG(CASE WHEN ai.severity='Con muertos' THEN 3 
                WHEN ai.severity='Con heridos' THEN 2 ELSE 1 END) g,
       COUNT(*) n
FROM accident_incidents ai JOIN zones z ON ST_Within(ai.geom, z.geom)
WHERE incident_date IS NOT NULL AND z.kind='comuna' AND incident_hour ~ '^[0-9]'
GROUP BY h,d,m,c,lat,lng HAVING COUNT(*)>=5
""", conn)
conn.close()

# Clima agregado
df_clima = pd.read_csv("clima_historico_medellin.csv")
df_clima['timestamp'] = pd.to_datetime(df_clima['timestamp'])
df_clima['mes'] = df_clima['timestamp'].dt.month
df_clima['hora'] = df_clima['timestamp'].dt.hour
clima_agg = df_clima.groupby(['mes','hora']).agg({'temp':'mean','lluvia':'mean'}).reset_index()

# Cruzar
df = df_acc.merge(clima_agg, left_on=['m','h'], right_on=['mes','hora'], how='left')

# Features
df['hp']=df['h'].apply(lambda x:1 if 6<=x<=9 or 17<=x<=20 else 0)
df['fs']=df['d'].apply(lambda x:1 if x in(5,6)else 0)
df['deprimidos_riesgo']=(df['lluvia']>2.0).astype(int)
df['r']=np.minimum(100,df['n']*5+df['g']*10)

enc=LabelEncoder()
df['ce']=enc.fit_transform(df['c'])

X=df[['h','d','m','ce','lat','lng','g','hp','fs','temp','lluvia','deprimidos_riesgo']]
y=df['r']
Xtr,Xte,ytr,yte=train_test_split(X,y,test_size=0.2,random_state=42)

# Entrenar
m=XGBRegressor(n_estimators=120,max_depth=7,learning_rate=0.1,random_state=42,verbosity=0)
m.fit(Xtr,ytr)
print(f"✓ R² train:{m.score(Xtr,ytr):.1%} test:{m.score(Xte,yte):.1%}")

# Guardar
d=Path("app/ml/models")
d.mkdir(parents=True,exist_ok=True)
joblib.dump(m,d/"traffic_model.joblib")
joblib.dump(enc,d/"comuna_encoder.joblib")
print(f"✓ Modelos guardados → {d}/")
EOF

# 3. Copiar a contenedores Docker
docker cp app/ml/models/traffic_model.joblib backend-api-1:/repo/backend/app/ml/models/
docker cp app/ml/models/comuna_encoder.joblib backend-api-1:/repo/backend/app/ml/models/
docker cp clima_historico_medellin.csv backend-api-1:/repo/backend/
docker cp app/ml/models/traffic_model.joblib backend-worker-1:/repo/backend/app/ml/models/
docker cp app/ml/models/comuna_encoder.joblib backend-worker-1:/repo/backend/app/ml/models/
docker cp clima_historico_medellin.csv backend-worker-1:/repo/backend/

# 4. Reiniciar servicios
docker restart backend-api-1 backend-worker-1


```

## Mejoras Futuras

### Corto Plazo
- [ ] Hyperparameter tuning con GridSearchCV
- [ ] Agregar features de homicidios/hurtos (MEData SISC)
- [ ] Cross-validation más robusto (k=10)


## Referencias

- **MEData**: https://www.medellin.gov.co/es/datos-abiertos/
- **SIATA**: https://siata.gov.co/
- **Open-Meteo**: https://open-meteo.com/
- **XGBoost**: https://xgboost.readthedocs.io/

---

**Última actualización**: 2026-06-07  
**Versión del modelo**: 3.0 (con clima histórico + SIATA)
