# ── Etapa 1: compilar el frontend (Vite → dist) ───────────────────────────────
FROM node:22-slim AS frontend
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Etapa 2: backend (Python) sirviendo el dist compilado ──────────────────────
FROM python:3.11-slim

# Dependencias de sistema mínimas para asyncpg/shapely/GeoAlchemy2.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /repo/backend

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

# Copiar dataset de accidentes (702,540 registros 2008-2025)
COPY backend/data/raw/Fatal_Road_Traffic.xlsx /repo/backend/data/raw/Fatal_Road_Traffic.xlsx

# Copiar datos históricos de clima (157,800 registros 2008-2025)
COPY backend/data/processed/clima_historico_medellin.csv /repo/backend/data/processed/clima_historico_medellin.csv

# Copiar entrypoint y dataset
RUN chmod +x /repo/backend/scripts/docker/docker-entrypoint.sh

# Frontend compilado: main.py lo sirve desde <repo>/frontend/dist vía StaticFiles.
COPY --from=frontend /frontend/dist /repo/frontend/dist

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
