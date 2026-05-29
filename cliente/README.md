# Frontend tppmaps

Cliente web del comando geoespacial (dashboard + vistas móviles).

## Estructura

```
frontend/
├── index.html              # Dashboard Osiris / tppmaps
├── pages/mobile/           # Vistas MoviMed móvil
├── assets/data/            # GeoJSON / datos estáticos
└── static/
    ├── css/
    └── js/                 # ES modules por capa
```

## Solo frontend

```powershell
.\scripts\dev-frontend.ps1
```

## Con API

Usar `scripts\dev-api.ps1` desde la raíz del repo (sirve frontend + `/api/v1`).
