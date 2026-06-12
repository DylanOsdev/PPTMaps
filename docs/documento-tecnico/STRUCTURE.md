# Estructura del Proyecto PPTMaps

## 📁 Organización Limpia (2026-06-08)

```
PPTMaps/
├── backend/                          # API FastAPI + ML
│   ├── app/                          # Código fuente principal
│   │   ├── api/                      # Endpoints REST
│   │   ├── core/                     # Config y seguridad
│   │   ├── db/                       # Database setup
│   │   ├── models/                   # SQLAlchemy models
│   │   ├── schemas/                  # Pydantic schemas
│   │   ├── services/                 # Lógica de negocio
│   │   ├── tasks/                    # Celery tasks
│   │   ├── ml/                       # Modelos ML
│   │   └── websocket/                # WebSocket handlers
│   │
│   ├── scripts/                      # 🆕 Scripts organizados
│   │   ├── ml/                       # Scripts de Machine Learning
│   │   │   ├── train_traffic_model.py
│   │   │   ├── prepare_ml_dataset.py
│   │   │   └── download_historical_weather.py
│   │   ├── setup/                    # Scripts de setup
│   │   │   ├── setup_db.sh
│   │   │   └── seed_demo.py
│   │   └── docker/                   # Scripts Docker
│   │       ├── docker-entrypoint.sh
│   │       └── run.sh
│   │
│   ├── data/                         # 🆕 Datos organizados
│   │   ├── raw/                      # Datos originales
│   │   │   └── Fatal_Road_Traffic.xlsx (63 MB)
│   │   └── processed/                # Datos procesados
│   │       └── clima_historico_medellin.csv (4.9 MB)
│   │
│   ├── tests/                        # 🆕 Tests organizados
│   │   ├── e2e/                      # Tests end-to-end
│   │   │   ├── test_chatbot_e2e.py
│   │   │   └── test_spa_routing_standalone.py
│   │   ├── unit/                     # Tests unitarios
│   │   │   └── test_dbscan_optimized.py
│   │   └── integration/              # Tests de integración
│   │       ├── test_docker_stack.sh
│   │       └── test_ml_predictions.sh
│   │
│   ├── alembic/                      # Migraciones DB
│   ├── docs/                         # Docs backend
│   ├── venv/                         # Entorno virtual
│   ├── .env
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── docker-compose.pptmaps.yml
│   └── README.md
│
├── frontend/                         # Dashboard React + Vite
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── static/
│   ├── public/
│   │   └── logo.png                  # 🆕 Renombrado
│   ├── dist/
│   ├── package.json
│   └── vite.config.js
│
├── docs/                             # Documentación general
│   └── documento-tecnico/
│
├── .gitignore
├── .dockerignore
├── README.md
├── STRUCTURE.md                      # 🆕 Este archivo
├── start.sh                          # Script inicio Linux
└── start.bat                         # Script inicio Windows
```

---

## 🧹 Limpieza Realizada

### ❌ Eliminado de la raíz del proyecto:
- `venv/` — duplicado (se mantiene solo en backend/)
- `package.json` + `package-lock.json` — duplicados del frontend
- `frontend.log` + `pptmaps_start.log` — logs temporales
- `.pytest_cache/` + `.ruff_cache/` — cachés de dev
- `.pi/` — directorio vacío
- `data/` — directorio vacío

### ❌ Eliminado de backend/:
- `Dataset on Road Traffic Fatalities in Medell├нn, Co/` — directorio corrupto

### 🔄 Movido y Reorganizado:

#### Scripts ML → `backend/scripts/ml/`
- `train_traffic_model.py`
- `prepare_ml_dataset.py`
- `download_historical_weather.py`

#### Datos → `backend/data/`
- `Fatal_Road_Traffic.xlsx` → `data/raw/`
- `clima_historico_medellin.csv` → `data/processed/`

#### Tests → `backend/tests/`
- `test_chatbot_e2e.py` → `tests/e2e/`
- `test_spa_routing_standalone.py` → `tests/e2e/`
- `test_dbscan_optimized.py` → `tests/unit/`
- `test_docker_stack.sh` → `tests/integration/`
- `test_ml_predictions.sh` → `tests/integration/`

#### Scripts setup → `backend/scripts/setup/`
- `setup_db.sh`
- `seed_demo.py`

#### Scripts Docker → `backend/scripts/docker/`
- `docker-entrypoint.sh`
- `run.sh`

#### Frontend
- `Logo Nuevo` → `public/logo.png`

---

## 📝 Archivos Actualizados

### `backend/Dockerfile`
```diff
- RUN chmod +x /repo/backend/docker-entrypoint.sh
+ RUN chmod +x /repo/backend/scripts/docker/docker-entrypoint.sh
```

### `backend/docker-compose.pptmaps.yml`
```diff
- command: sh /repo/backend/docker-entrypoint.sh
+ command: sh /repo/backend/scripts/docker/docker-entrypoint.sh
```

### `start.sh`
```diff
- echo "     Ejecuta: sudo bash backend/setup_db.sh"
+ echo "     Ejecuta: sudo bash backend/scripts/setup/setup_db.sh"
```

### `.gitignore`
Agregadas reglas para:
- Logs temporales (`*.log`)
- Cachés (`.pytest_cache/`, `.ruff_cache/`)
- Entornos virtuales (`venv/`, `env/`)

---

## 🚀 Comandos Actualizados

### Ejecutar Tests
```bash
# Tests E2E
cd backend
source venv/bin/activate
python tests/e2e/test_chatbot_e2e.py

# Tests de integración
bash tests/integration/test_docker_stack.sh
bash tests/integration/test_ml_predictions.sh

# Tests unitarios
pytest tests/unit/
```

### Entrenar Modelo ML
```bash
cd backend
source venv/bin/activate
python scripts/ml/download_historical_weather.py
python scripts/ml/prepare_ml_dataset.py
python scripts/ml/train_traffic_model.py
```

### Setup Base de Datos
```bash
cd backend
sudo bash scripts/setup/setup_db.sh
python scripts/setup/seed_demo.py
```

---

## 📊 Beneficios

✅ **Raíz limpia** — solo archivos esenciales  
✅ **Tests organizados** — por tipo (e2e, unit, integration)  
✅ **Scripts agrupados** — por función (ml, setup, docker)  
✅ **Datos separados** — raw vs processed  
✅ **Sin duplicados** — package.json, venv, logs eliminados  
✅ **Fácil navegación** — estructura intuitiva  
✅ **Git limpio** — .gitignore actualizado

---

**Última actualización**: 2026-06-08  
