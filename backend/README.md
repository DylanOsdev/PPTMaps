# MoviMed — Backend API

> **Plataforma unificada de movilidad inteligente para Medellín**  
> Backend construido con FastAPI · PostgreSQL + PostGIS  
> Proyecto para el **Hackatón HackData CTGI SENA 2026**

---

## 🌐 Origen de los Datos (Open Data Medellín)

El backend de **MoviMed** está diseñado para ingestar y optimizar datos geoespaciales de entidades oficiales locales:

1. **API SIATA (Sistema de Alerta Temprana de Medellín)**: Suministra los niveles en tiempo real del Río Medellín y quebradas (`flood_hazards`), permitiendo actualizar polígonos de riesgo de inundación.
2. **MEData (Portal de Datos Abiertos de la Alcaldía de Medellín)**: Ingestamos los datasets oficiales de *Incidentes Viales* y *Geometría de la Malla Vial* para nuestro modelo de zonas de accidentalidad (`accident_zones`).
3. **Reportes Ciudadanos**: Alimentados en tiempo real por los usuarios de la plataforma (`reports`).

Nuestro sistema cachea y optimiza estos datos geográficos en **PostGIS** para entregar respuestas ultrarrápidas al frontend, evitando saturar las APIs oficiales con peticiones directas de los usuarios.

---

## 🚀 Inicio Rápido Backend (Local)

El backend se ejecuta localmente (sin Docker). Requieres **PostgreSQL + PostGIS** instalado en tu sistema (Fedora/Linux).

```bash
# 1. Preparar la Base de Datos (PostGIS requerido)
sudo -u postgres psql -c "CREATE DATABASE movimed;"
sudo -u postgres psql -d movimed -f schema.sql

# 2. Iniciar entorno virtual de Python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 3. Correr el servidor FastAPI
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
La API estará disponible en `http://localhost:8000/docs`.

---

## Estructura del Proyecto

```text
backend/
├── app/
│   ├── api/          # Controladores (Rutas HTTP y REST)
│   ├── core/         # Configuración y utilidades
│   ├── db/           # Conexión a Base de Datos
│   ├── models/       # Modelos SQLAlchemy (PostGIS)
│   └── schemas/      # Validadores Pydantic
├── schema.sql        # Esquema oficial de base de datos
├── requirements.txt  # Dependencias Python
└── .env.example      # Archivo de configuración base
```

## 🚧 Trabajo Pendiente (Próximos Pasos)

Actualmente la base de datos, el esquema y los modelos base están configurados. Lo que **falta implementar en el backend** es:

- [ ] **Operaciones CRUD:** Construir la lógica de acceso a datos para insertar, leer, actualizar y borrar `users`, `reports`, `accident_zones` y `flood_hazards`.
- [ ] **Rutas (Endpoints) de FastAPI:** Crear los controladores `/api/v1/...` para exponer estas operaciones al frontend, incluyendo consultas geográficas nativas con PostGIS (ej. *Buscar zonas de inundación a 5km de mi posición*).
- [ ] **Ingesta Automática (Cron Jobs):** Programar scripts asíncronos que consuman las APIs reales del SIATA y MEData cada X minutos para mantener nuestra base de datos sincronizada.
- [ ] **Limpieza de código obsoleto:** Remover referencias a los modelos antiguos (`vehicles`, `telemetry`) de las dependencias actuales del router.

---

## 👥 Autores
Proyecto desarrollado para el **Hackatón HackData CTGI SENA 2026**.

## 📄 Licencia
MIT License — libre uso para fines académicos y de competencia.
