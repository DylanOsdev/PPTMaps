# tppmaps / MoviMed

## Encarpetado (español)

```
ttpmap/
├── cliente/                 # Interfaz web
│   ├── index.html
│   ├── paginas/movil/
│   ├── recursos/datos/
│   └── estatico/js/
│       ├── configuracion/
│       ├── nucleo/
│       ├── mapa/
│       ├── servicios/
│       └── paneles/         # panel-capas, panel-herramientas, alertas…
├── servidor/                # API FastAPI
│   └── aplicacion/
│       ├── principal.py
│       ├── api/v1/endpoints/
│       ├── nucleo/
│       └── esquemas/
├── docker/
├── documentacion/
│   └── LIBRERIAS.md
└── scripts/
    ├── iniciar-servidor.ps1
    └── iniciar-docker.ps1
```

## Conectar backend + base de datos (no solo localhost)

```powershell
# Opción A — Docker (PostgreSQL + Redis + API)
.\scripts\iniciar-docker.ps1
# Abre: http://TU-IP:8000/  (0.0.0.0 escucha en toda la red)

# Opción B — Solo API en tu máquina
.\scripts\iniciar-servidor.ps1
```

Copia `.env.example` → `servidor/.env` y ajusta `URL_BASE_DATOS`.

## Botones funcionales

| Panel | Botón | Acción |
|-------|--------|--------|
| **Kit** | RUTA | `GET /api/v1/rutas` + dibuja ruta |
| | SIATA | `GET /api/v1/siata/alertas` + filtro alertas |
| | GPS | `GET /api/v1/telemetria/mapa-predictivo` |
| | DBSCAN | `GET /api/v1/telemetria/clusters` |
| | INUNDA | `GET /api/v1/siata/inundaciones` |
| | IA 2H | `GET /api/v1/prediccion/lluvia` + modal |
| | TODO | Activa capas + carga SIATA/GPS/clusters |
| | ESCANEAR | Geocodifica comuna o calcula ruta |
| **Capas** | SET | Rota presets MoviMed / Mínimo / Clima |
| | Toggles | Muestra/oculta capas en mapa |
| | C1–C16 | Vuela a cada comuna |

Ver [documentacion/LIBRERIAS.md](documentacion/LIBRERIAS.md).
