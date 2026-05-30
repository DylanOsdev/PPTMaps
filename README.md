# MoviMed — Monorepo

> **Plataforma unificada de movilidad inteligente para Medellín**  
> Proyecto para el **Hackatón HackData CTGI SENA 2026**

Este repositorio contiene tanto el Backend (FastAPI) como el Frontend de la plataforma MoviMed.

## 📂 Estructura del Repositorio

- [`/backend`](./backend/): Contiene la API REST desarrollada en FastAPI, con PostgreSQL, PostGIS, WebSockets y Celery. Puedes ver la documentación completa y las instrucciones de despliegue en su respectivo [README interno](./backend/README.md).
- `/frontend` *(Próximamente)*: Contendrá la aplicación web y los dashboards analíticos.

## 🌐 Origen de los Datos (Open Data Medellín)

El backend de **MoviMed** está diseñado para ingestar y optimizar datos geoespaciales de entidades oficiales locales:

1. **API SIATA (Sistema de Alerta Temprana de Medellín)**: Suministra los niveles en tiempo real del Río Medellín y quebradas (`flood_hazards`), permitiendo actualizar polígonos de riesgo de inundación mediante nuestra base de datos espacial.
2. **MEData (Portal de Datos Abiertos de la Alcaldía de Medellín)**: Ingestamos los datasets oficiales de *Incidentes Viales* y *Geometría de la Malla Vial* para nuestro modelo de zonas de accidentalidad (`accident_zones`).
3. **Reportes Ciudadanos**: Alimentados en tiempo real por los usuarios de la plataforma.

Nuestro sistema cachea y optimiza estos datos geográficos en **PostGIS** para entregar respuestas ultrarrápidas al frontend, evitando saturar las APIs oficiales con peticiones directas de los usuarios.

## 🚀 Inicio Rápido Backend (Local)

El backend se ejecuta localmente (sin Docker). Requieres **PostgreSQL + PostGIS** instalado en tu sistema.

```bash
# 1. Crear la base de datos (la migración instala PostGIS y crea todas las tablas)
sudo -u postgres psql -c "CREATE DATABASE movimed;"

# 2. Iniciar entorno de Python
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 3. Aplicar las migraciones (crea la extensión PostGIS + el esquema completo)
alembic upgrade head

# 4. Correr el servidor
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
La API estará disponible en `http://localhost:8000/docs`.

## 🚧 Trabajo Pendiente (Lo que falta del Backend)

El desarrollo está en curso. Actualmente faltan por implementar:
- [ ] Endpoints y CRUD para los nuevos modelos (Reportes, Zonas de Accidente, SIATA).
- [ ] Script de ingesta automática de las APIs de la Alcaldía (MEData/SIATA).
- [ ] Ajustes finales de validación Pydantic para geometrías de PostGIS.

---
*Desarrollado para el Hackatón HackData CTGI SENA 2026.*
