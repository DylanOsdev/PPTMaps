#!/usr/bin/env bash
# Levanta la API sirviendo el frontend compilado + la DB de demo (movimed_test :5433).
set -e
cd "$(dirname "$0")"
export POSTGRES_PORT=5433
export POSTGRES_DB=movimed_test
export ZONES_JSON_PATH=../frontend/public/assets/data/medellin-comunas.json
exec ./venv/bin/uvicorn app.main:app --port 8000
