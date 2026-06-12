# PPTMaps — Frontend (PWA)

> Dashboard de comando geoespacial + reportes ciudadanos para el Valle de Aburrá.
> **React 19 · Vite 8 · Tailwind 4 · Leaflet · Chart.js** · Hackatón HackData CTGI SENA 2026

SPA instalable (PWA) que consume la API REST + WebSocket del backend. En producción se
compila a `dist/` y la sirve el propio backend FastAPI con fallback SPA.

> README verificado contra el código. Lo que está maquetado pero no cableado se indica.

---

## 🧰 Stack (versiones reales de `package.json`)

| Uso | Paquete |
|-----|---------|
| UI | `react` 19.2 · `react-dom` 19.2 |
| Routing | `react-router-dom` 7.16 |
| Gráficos | `chart.js` 4.5 + `react-chartjs-2` 5.3 |
| Animación | `gsap` 3.15 |
| Iconos | `react-icons` 5.6 |
| Build | `vite` 8 · `@vitejs/plugin-react` 6 |
| Estilos | `tailwindcss` 4 · `@tailwindcss/postcss` · `autoprefixer` · `postcss` |

**Leaflet 1.9.4 NO es dependencia npm**: se carga por **CDN (unpkg)** en `index.html`,
quedando el objeto global `L` disponible para `static/js/map/map-service.js`.

---

## 📁 Estructura

```
frontend/
├── index.html              # Punto de entrada; carga Leaflet (CDN), fuentes, manifest
├── vite.config.js          # Dev server :5173 + proxy /api /health /ws /docs → :8000
├── public/
│   ├── manifest.webmanifest   # PWA: nombre, íconos, theme-color
│   ├── sw.js                  # Service Worker manual (cache 'pptmaps-v2')
│   ├── icons/                 # Íconos PWA (192, 512, maskable)
│   ├── logo.jpg, medellin.jpg, favicon.png
│   └── assets/data/           # GeoJSON estático (fallback de comunas)
└── src/
    ├── main.jsx            # Monta React + registra el SW (solo en PROD)
    ├── App.jsx             # Router (createBrowserRouter)
    ├── index.css           # Estilos globales / Tailwind
    ├── pages/              # Vistas (una por ruta)
    ├── components/         # TopBar, StatusCluster, ...
    ├── hooks/              # useWeather, useAccidentStats
    └── static/
        ├── css/            # Estilos del mapa (tppmaps.css)
        └── js/             # Lógica del mapa Leaflet (ES modules por capa)
            ├── config/constants.js   # CONFIG: apiBase, tiles, centro del mapa
            ├── services/api.js       # REST + WebSocket (reconexión exponencial)
            └── map/                  # map-service, demo-layers, medellin-layers
```

---

## 🗺️ Rutas (`src/App.jsx`)

| Ruta | Página | Descripción | Estado |
|------|--------|-------------|--------|
| `/` | `Landing.jsx` | Página de aterrizaje (tema oscuro + logo) | ✅ |
| `/map` | `CommandCenter.jsx` | Centro de comando con mapa Leaflet en vivo | ✅ |
| `/dashboard` | `Dashboard.jsx` | Analítica de accidentalidad (Chart.js) | ✅ |
| `/report` | `Report.jsx` | Formulario de reporte de incidente | ⚠️ solo visual |
| `*` | — | Redirige a `/` | ✅ |

---

## 📊 Dashboard (`/dashboard`)

Consume `GET /api/v1/public/accidents/stats` vía el hook `useAccidentStats`. Renderiza
sobre los **702.540 accidentes reales** (Sec. Movilidad de Medellín):

- **KPIs**: total de incidentes, víctimas fatales, comuna más crítica, clase más frecuente.
- **Gráficos** (Chart.js): por gravedad (doughnut), por clase (barras), top 10 comunas
  (barras horizontales), evolución anual (línea).

Es la vista con datos 100% reales y es el punto fuerte de la demo.

---

## 🛰️ Mapa (`/map` — CommandCenter)

Mapa **Leaflet** con base OSM y capa satelital (ArcGIS/Google con fallback). La lógica
vive en `static/js/map/map-service.js`. Capas y su fuente:

| Capa | Fuente | Estado |
|------|--------|--------|
| Comunas/Municipios | `GET /public/comunas` (PostGIS) + fallback JSON estático | ✅ real |
| Zonas de inundación | `GET /public/flood-zones` (SIATA) | ✅ real |
| Clima / lluvia | `GET /public/weather` + `/public/rain-risk` | ⚠️ vacío sin Celery |
| Accidentes | `GET /public/accidents/geojson` | ⚠️ demo (10 reports) |
| Fatalidades | `GET /public/fatalities` (polling 30 s) | ⚠️ demo |
| Telemetría / alertas | `WS /ws/telemetry?channel=global` | ⚠️ 8 vehículos demo |

El indicador de estado de capas (`layerStatusDot`) se pone verde cuando las 4 capas base
cargan, rojo si alguna falla.

---

## 🌦️ Clima (widget) — `useWeather`

El hook `useWeather` (`src/hooks/useWeather.js`) consume
`GET /api/v1/public/weather/forecast` (proxy del backend a Open-Meteo, **en vivo**),
refrescando cada 10 min. Devuelve clima actual, próximas 6 horas y 5 días, con íconos por
código WMO. Centro de referencia: Parque Berrío (`6.2518, -75.5636`).

---

## 🔌 Capa de datos (`src/static/js/services/api.js`)

Centraliza todo el acceso al backend:

- **REST**: `fetchTelemetry`, `fetchAlerts`, `fetchAccidentsGeoJSON`, `fetchFatalities`,
  `fetchFloodZones`, `fetchRoute`, `fetchWeather`, `fetchRainRisk`, `pingHealth` — todas
  con timeout vía `AbortSignal.timeout`.
- **WebSocket**: `connectWebSocket` (`/ws/telemetry?channel=global`) con **reconexión
  exponencial** (hasta 10 intentos) y despacho de eventos `telemetry` / `alerts` / `accidents`.
- **Config**: `CONFIG.apiBase` = `/api/v1` (`config/constants.js`).

---

## 📱 PWA

- `manifest.webmanifest`: nombre, `short_name` "PPTMaps", íconos (incl. *maskable*),
  `display: standalone`, `theme_color: #1a5c3a`.
- **Service Worker** (`public/sw.js`, cache `pptmaps-v2`): *network-first* para navegación
  (cae al app-shell offline), *cache-first* para estáticos del mismo origen. **Excluye**
  `api/`, `ws/`, `health`, `docs`, `redoc` y archivos de media.
- Se registra **solo en producción** (`import.meta.env.PROD`) — en dev interferiría con el
  HMR de Vite.
- **Por qué SW manual**: `vite-plugin-pwa` aún no soporta Vite 8
  (issue `vite-pwa/vite-plugin-pwa#923`).

---

## 🚀 Cómo correr

### Desarrollo (hot reload, Vite :5173)

```bash
cd frontend
npm install
npm run dev      # proxy de /api /health /ws /docs hacia http://localhost:8000
```

Requiere el backend corriendo en `:8000` para que carguen los datos.

### Producción (servido por el backend)

```bash
cd frontend
npm run build    # genera dist/
```

El backend detecta `frontend/dist/index.html` y lo sirve con fallback SPA, así que
abriendo `http://localhost:8000` ves la app compilada (rutas como `/dashboard` y `/map`
funcionan por deep-link).

---

## ⚠️ Estado del reporte ciudadano (`/report`)

El formulario está **maquetado pero no cableado**: `handleSubmit` solo muestra la
pantalla de éxito (`setSubmitted(true)`). **No hace `fetch`, no captura ubicación y no
guarda nada** en la BD. Pendientes para que funcione de verdad:

1. Capturar lat/lng (`navigator.geolocation` o clic en el mapa).
2. Hacer `POST /api/v1/reports/` en el submit.
3. Mapear los tipos del form (`accidente`, `via_cerrada`, `hueco`, `semaforo`) al enum del
   backend (`accident`, `flood`, `obstruction`, `other`).
4. Resolver auth: el endpoint exige JWT — o se hace un endpoint público de reporte
   ciudadano, o se conecta el login.

---

*Desarrollado para el Hackatón HackData CTGI SENA 2026.*
