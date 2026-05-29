# MoviMed — Monorepo

> **Plataforma unificada de movilidad inteligente para Medellín**  
> Proyecto para el **Hackatón HackData CTGI SENA 2026**

Este repositorio contiene tanto el Backend (FastAPI) como el Frontend de la plataforma MoviMed.

## 📂 Estructura del Repositorio

- [`/backend`](./backend/): Contiene la API REST desarrollada en FastAPI, con PostgreSQL, PostGIS, WebSockets y Celery. Puedes ver la documentación completa y las instrucciones de despliegue en su respectivo [README interno](./backend/README.md).
- `/frontend` *(Próximamente)*: Contendrá la aplicación web y los dashboards analíticos.

## 🚀 Inicio Rápido Backend

Para levantar el backend localmente usando Docker:

```bash
cd backend
cp .env.example .env
docker-compose up --build
```
La API estará disponible en `http://localhost:8000/docs`.

---
*Desarrollado para el Hackatón HackData CTGI SENA 2026.*
