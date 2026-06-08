import { AppState } from "../core/state.js";
import { escapeHtml } from "../core/utils.js";
import { onWsEvent, fetchRoute, fetchAccidentsGeoJSON, fetchAlerts, fetchTrafficPredictions } from "../services/api.js";
import { getAccidentSvg } from "../icons/react-icons.js";

const driverIconCache = new Map();
const accidentIconCache = {};
let telemetryMarkers = new Map();
let fatalitiesMarkers = new Map();
let accidentsMarkers = new Map();
let pendingTelemetry = null;
let rafScheduled = false;

function makeDriverIcon(id, routeLabel = "") {
  const cacheKey = routeLabel || id;
  if (driverIconCache.has(cacheKey)) return driverIconCache.get(cacheKey);

  const html = `
    <div class="gps-driver-marker" title="Conductor #${id}">
      <div class="gps-bus-icon">
        <svg viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="1" y="2" width="16" height="11" rx="2" fill="#0f172a" stroke="#38bdf8" stroke-width="1.2"/>
          <rect x="2.5" y="4" width="4" height="3" rx="0.8" fill="#38bdf8" opacity="0.8"/>
          <rect x="11.5" y="4" width="4" height="3" rx="0.8" fill="#38bdf8" opacity="0.8"/>
          <circle cx="4.5" cy="14.5" r="1.5" fill="#334155" stroke="#38bdf8" stroke-width="0.8"/>
          <circle cx="13.5" cy="14.5" r="1.5" fill="#334155" stroke="#38bdf8" stroke-width="0.8"/>
        </svg>
      </div>
      ${routeLabel ? `<div class="gps-route-label">${routeLabel}</div>` : ""}
    </div>`;
  const icon = L.divIcon({
    className: "",
    html,
    iconSize: [24, routeLabel ? 32 : 22],
    iconAnchor: [12, routeLabel ? 28 : 18],
    popupAnchor: [0, -20],
  });
  driverIconCache.set(cacheKey, icon);
  return icon;
}

function makeAccidentIcon(severity = "high") {
  if (accidentIconCache[severity]) return accidentIconCache[severity];

  const c = severity === "high" ? { border: "#ef4444", bg: "#7f1d1d", text: "#fca5a5", label: "MUERTE" }
    : severity === "medium" ? { border: "#f97316", bg: "#7c2d12", text: "#fdba74", label: "HERIDO" }
    : { border: "#eab308", bg: "#713f12", text: "#fde047", label: "DAÑOS" };
  const html = `
    <div class="acc-marker" data-severity="${severity}">
      <div class="acc-core" style="background:${c.bg};border-color:${c.border}">
        ${getAccidentSvg(severity)}
      </div>
      <div class="acc-label" style="color:${c.text}">${c.label}</div>
    </div>`;
  const icon = L.divIcon({
    className: "",
    html,
    iconSize: [44, 52],
    iconAnchor: [22, 48],
    popupAnchor: [0, -50],
  });
  accidentIconCache[severity] = icon;
  return icon;
}

function makePredictionZone(center, radiusM, riskLevel = 0.7) {
  const hue = Math.round(40 - riskLevel * 40);
  const circle = L.circle(center, {
    radius: radiusM,
    color: `hsl(${hue},95%,58%)`,
    weight: 1.5,
    opacity: 0.7,
    fillColor: `hsl(${hue},95%,48%)`,
    fillOpacity: 0.2,
    dashArray: "6 4",
  });
  const label = L.marker(center, {
    interactive: false,
    icon: L.divIcon({
      className: "",
      html: `<div class="predict-label" style="color:hsl(${hue},95%,58%)">
               <span class="predict-pct">${Math.round(riskLevel * 100)}%</span>
             </div>`,
      iconSize: [50, 20],
      iconAnchor: [25, 10],
    }),
  });
  return L.layerGroup([circle, label]);
}

export function createDemoLayers(map) {
  const groups = AppState.layerGroups;

  groups["safe-route"]        = L.layerGroup();
  groups["blocked-roads"]     = L.layerGroup();
  groups["accident-clusters"] = L.markerClusterGroup({
    disableClusteringAtZoom: 16,
    maxClusterRadius: 60,
    spiderfyOnMaxZoom: true,
  });
  groups["accident-zones"]    = L.layerGroup();
  groups["fatalities-layer"]  = L.layerGroup();
  groups["flood-zones"]       = L.layerGroup();
  groups["telemetry-gps"]     = L.layerGroup();
  groups["reports-collision"] = L.markerClusterGroup({
    disableClusteringAtZoom: 16,
    maxClusterRadius: 50,
  });
  groups["telemetry-predict"] = L.layerGroup();
  groups["rain-risk"]         = L.layerGroup();
  groups["weather-alerts"]    = L.layerGroup();
  groups["reports-flood"]     = L.markerClusterGroup({
    disableClusteringAtZoom: 16,
    maxClusterRadius: 50,
  });
  groups["reports-obstacle"]  = L.markerClusterGroup({
    disableClusteringAtZoom: 16,
    maxClusterRadius: 50,
  });

  // Heatmap de congestión con predicciones ML reales
  const predictGroup = groups["telemetry-predict"];
  
  // Cargar predicciones ML reales del backend
  updateTrafficPredictions(map, predictGroup);

  // Vías bloqueadas demo
  const blockedGroup = groups["blocked-roads"];
  const blockedRoads = [
    {
      name: "Autopista Sur — cierre parcial por obras",
      coords: [[6.2380, -75.5750], [6.2320, -75.5735], [6.2260, -75.5720], [6.2200, -75.5705]],
    },
    {
      name: "Calle 10 — cierre total por evento",
      coords: [[6.2518, -75.5680], [6.2518, -75.5620], [6.2518, -75.5560]],
    },
    {
      name: "Av. Oriental — carril bloqueado por accidente",
      coords: [[6.2490, -75.5636], [6.2450, -75.5636], [6.2410, -75.5636]],
    },
  ];
  blockedRoads.forEach((road) => {
    const line = L.polyline(road.coords, {
      color: "#ef4444", weight: 5, opacity: 0.85, dashArray: "12 8", lineCap: "round",
    });
    line.bindPopup(`
      <div class="popup-accident">
        <div class="popup-accident-title">Vía bloqueada</div>
        <div class="popup-accident-sev">${escapeHtml(road.name)}</div>
      </div>
    `, { className: "popup-dark" });
    blockedGroup.addLayer(line);
  });

  connectRealTimeLayer(map, groups);
}

function applyTelemetryBatch() {
  rafScheduled = false;
  if (!pendingTelemetry) return;
  const { map, groups, items } = pendingTelemetry;
  pendingTelemetry = null;

  const telemetryGroup = groups["telemetry-gps"];
  if (!telemetryGroup) return;

  const incomingIds = new Set();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const id = item.id || item.vehicle_id || item.device_id || `v-${item.lat}-${item.lng}`;
    const lat = item.lat ?? (item.location?.coordinates?.[1] ?? item.latitude);
    const lng = item.lng ?? (item.location?.coordinates?.[0] ?? item.longitude);
    if (lat == null || lng == null) continue;
    incomingIds.add(id);

    if (telemetryMarkers.has(id)) {
      const m = telemetryMarkers.get(id);
      m.setLatLng([lat, lng]);
    } else {
      const route = item.route || item.route_id || "";
      const marker = L.marker([lat, lng], { icon: makeDriverIcon(id, route) });
      marker.bindPopup(`
        <div class="popup-driver">
          <div class="popup-driver-id">Conductor <strong>${escapeHtml(String(id))}</strong></div>
          <div class="popup-driver-route">Ruta: <span>${escapeHtml(String(route))}</span></div>
          <div class="popup-driver-status"><span class="dot-green"></span> En servicio</div>
          <div class="popup-driver-coords">${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
        </div>
      `, { className: "popup-dark" });
      telemetryGroup.addLayer(marker);
      telemetryMarkers.set(id, marker);
    }
  }

  for (const [id, marker] of telemetryMarkers) {
    if (!incomingIds.has(id)) {
      telemetryGroup.removeLayer(marker);
      telemetryMarkers.delete(id);
    }
  }
}

function connectRealTimeLayer(map, groups) {
  onWsEvent("telemetry", (data) => {
    const items = Array.isArray(data) ? data : (data.positions || data.vehicles || [data]);
    if (items.length === 0) return;
    pendingTelemetry = { map, groups, items };
    if (!rafScheduled) {
      rafScheduled = true;
      requestAnimationFrame(applyTelemetryBatch);
    }
  });

  onWsEvent("accidents", (data) => {
    updateAccidents(data);
  });

  onWsEvent("new_report", (data) => {
    addSingleReport(data);
  });
}

export function updateAccidents(data) {
  const groups = AppState.layerGroups;
  const accidentGroup = groups["accident-clusters"];
  if (!accidentGroup) return;

  const items = Array.isArray(data) ? data : (data.features || [data]);
  const incomingKeys = new Set();

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;
    let lat, lng, severity, desc, gravedadLabel = "";

    if (item.geometry && item.properties) {
      const coords = item.geometry.coordinates;
      lat = coords[1]; lng = coords[0];
      severity = item.properties.severity || "high";
      gravedadLabel = item.properties.gravedad === "MUERTO" ? (severity = "high", "MUERTO")
        : item.properties.gravedad === "HERIDO" ? (severity = "medium", "HERIDO")
        : item.properties.gravedad || "DAÑOS";
      desc = item.properties.clase_incidente || item.properties.description || item.properties.message || "Incidente";
    } else {
      lat = parseFloat(item.latitud ?? item.lat ?? item.latitude);
      lng = parseFloat(item.longitud ?? item.lng ?? item.longitude);
      if (item.gravedad === "MUERTO") { severity = "high"; gravedadLabel = "MUERTO"; }
      else if (item.gravedad === "HERIDO") { severity = "medium"; gravedadLabel = "HERIDO"; }
      else { severity = item.severity || "low"; gravedadLabel = item.gravedad || "DAÑOS"; }
      desc = item.clase_incidente || item.description || item.message || item.title || "Incidente vial";
    }
    if (isNaN(lat) || isNaN(lng)) continue;

    const key = `${lat.toFixed(5)}_${lng.toFixed(5)}`;
    incomingKeys.add(key);
    const iconSev = severity === "critical" ? "high" : severity;

    if (accidentsMarkers.has(key)) {
      const m = accidentsMarkers.get(key);
      m.setLatLng([lat, lng]);
    } else {
      const m = L.marker([lat, lng], { icon: makeAccidentIcon(iconSev) });
      m.bindPopup(`
        <div class="popup-accident">
          <div class="popup-accident-title">${escapeHtml(String(desc))}</div>
          <div class="popup-accident-sev">Severidad: <strong>${escapeHtml(gravedadLabel)}</strong></div>
          <div class="popup-accident-coords">${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
        </div>
      `, { className: "popup-dark" });
      accidentGroup.addLayer(m);
      accidentsMarkers.set(key, m);
    }
  }

  for (const [key, marker] of accidentsMarkers) {
    if (!incomingKeys.has(key)) {
      accidentGroup.removeLayer(marker);
      accidentsMarkers.delete(key);
    }
  }
}

const fatalitiesCircleColors = {
  high: "#ef4444", medium: "#22c55e", low: "#eab308",
};

export function updateFatalitiesMarkers(data) {
  const group = AppState.layerGroups["fatalities-layer"];
  if (!group) return;

  if (data?.type === "FeatureCollection" && Array.isArray(data.features)) data = data.features;
  if (!Array.isArray(data)) return;

  const incomingKeys = new Set();

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item?.geometry) continue;
    const coords = item.geometry.coordinates;
    const lat = coords[1], lng = coords[0];
    if (isNaN(lat) || isNaN(lng)) continue;

    const p = item.properties || {};
    const gravedad = p.gravedad || "";
    let severity = gravedad === "MUERTO" ? "high" : gravedad === "HERIDO" ? "medium" : p.severity || "low";
    const key = `${lat.toFixed(5)}_${lng.toFixed(5)}_${severity}`;
    incomingKeys.add(key);
    const color = fatalitiesCircleColors[severity] || "#eab308";

    if (fatalitiesMarkers.has(key)) {
      fatalitiesMarkers.get(key).setLatLng([lat, lng]);
    } else {
      const marker = L.circleMarker([lat, lng], {
        radius: 6, color: "#ffffff", weight: 1,
        fillColor: color, fillOpacity: 0.9,
      });
      const desc = p.clase_incidente || p.description || "Incidente fatal";
      marker.bindPopup(`
        <div class="popup-accident">
          <div class="popup-accident-title">${escapeHtml(desc)}</div>
          <div class="popup-accident-sev">Gravedad: <strong>${escapeHtml(gravedad || severity.toUpperCase())}</strong></div>
          <div class="popup-accident-coords">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
        </div>
      `, { className: "popup-dark" });
      group.addLayer(marker);
      fatalitiesMarkers.set(key, marker);
    }
  }

  for (const [key, marker] of fatalitiesMarkers) {
    if (!incomingKeys.has(key)) {
      group.removeLayer(marker);
      fatalitiesMarkers.delete(key);
    }
  }
}

export function updateFloodZones(map, data) {
  const floodGroup = AppState.layerGroups["flood-zones"];
  if (!floodGroup?.clearLayers) return;
  floodGroup.clearLayers();
  if (!Array.isArray(data)) return;

  const statusColors = {
    dry: { color: "#38bdf8", fill: "#0ea5e9", fillOpacity: 0.12 },
    watch: { color: "#f59e0b", fill: "#d97706", fillOpacity: 0.2 },
    flooded: { color: "#ef4444", fill: "#dc2626", fillOpacity: 0.3 },
  };

  for (let i = 0; i < data.length; i++) {
    const zone = data[i];
    if (!zone?.geom || !zone.name) continue;
    const sc = statusColors[zone.status] || statusColors.dry;
    try {
      let geojson = typeof zone.geom === "string" ? JSON.parse(zone.geom) : zone.geom;
      const layer = L.geoJSON(geojson, {
        style: { color: sc.color, fillColor: sc.fill, fillOpacity: sc.fillOpacity, weight: 1 },
      });
      layer.bindPopup(`
        <div class="popup-accident">
          <div class="popup-accident-title">${escapeHtml(String(zone.name))}</div>
          <div class="popup-accident-sev">Estado: <strong>${escapeHtml(String(zone.status).toUpperCase())}</strong></div>
          <div class="popup-accident-coords">${zone.water_level_m != null ? `Nivel: ${zone.water_level_m}m` : ""}</div>
        </div>
      `, { className: "popup-dark" });
      floodGroup.addLayer(layer);
    } catch (e) {}
  }
}

function makeBlockedRoadIcon(name, reason) {
  const html = `
    <div class="marker-blocked">
      <span>⛔</span>
      <div>
        <div class="blocked-road-name">${escapeHtml(name)}</div>
        <div class="blocked-road-reason">${escapeHtml(reason)}</div>
      </div>
    </div>`;
  return L.divIcon({
    className: "",
    html,
    iconSize: [200, 40],
    iconAnchor: [100, 20],
  });
}

export async function updateSafeRoutes(map) {
  const group = AppState.layerGroups["safe-route"];
  if (!group) return;
  group.clearLayers();

  const destinations = [
    { label: "Centro → Aeropuerto", dest: "6.3900,-75.5870" },
    { label: "Estadio → Centro", dest: "6.2518,-75.5636" },
    { label: "Poblado → Laureles", dest: "6.2520,-75.5900" },
  ];

  const startIcon = L.divIcon({
    className: "",
    html: '<span class="marker-dest">Ruta segura</span>',
    iconSize: [80, 20],
    iconAnchor: [40, 10],
  });

  for (const route of destinations) {
    try {
      const data = await fetchRoute(route.dest);
      if (data.coordinates?.length >= 2) {
        const coords = data.coordinates.map(c => [c[0], c[1]]);
        const polyline = L.polyline(coords, {
          color: "#4ade80", weight: 4, opacity: 0.7, dashArray: "10 6",
        });
        const avoided = data.avoided_zones || 0;
        polyline.bindPopup(`
          <div class="popup-accident">
            <div class="popup-accident-title">${route.label}</div>
            <div class="popup-accident-sev">Distancia: ${data.distance_km?.toFixed(1) ?? "?"} km</div>
            <div class="popup-accident-coords">Zonas de riesgo evitadas: ${avoided}</div>
          </div>
        `, { className: "popup-dark" });
        group.addLayer(polyline);

        const start = coords[0];
        const end = coords[coords.length - 1];
        L.marker(start, { icon: startIcon }).addTo(group);
        L.marker(end, { icon: startIcon }).addTo(group);
      }
    } catch (e) {
      console.warn("[safe-route] No se pudo obtener ruta:", route.label, e);
    }
  }
}

/* FUNCIÓN DESHABILITADA - Vías bloqueadas removidas (accidentes históricos no reflejan bloqueos actuales)
export async function updateBlockedRoads(map) {
  const group = AppState.layerGroups["blocked-roads"];
  if (!group) return;
  group.clearLayers();

  const seen = new Set();

  function addBlocked(lat, lng, name, reason) {
    const key = `${lat.toFixed(4)}_${lng.toFixed(4)}`;
    if (seen.has(key)) return;
    seen.add(key);
    const marker = L.marker([lat, lng], { icon: makeBlockedRoadIcon(name, reason) });
    marker.bindPopup(`
      <div class="popup-accident">
        <div class="popup-accident-title">${escapeHtml(name)}</div>
        <div class="popup-accident-sev">Razón: <strong>${escapeHtml(reason)}</strong></div>
      </div>
    `, { className: "popup-dark" });
    group.addLayer(marker);
  }

  try {
    const alerts = await fetchAlerts();
    const items = Array.isArray(alerts) ? alerts : (alerts.alerts || []);
    for (const a of items) {
      if (a.type === "traffic" && a.latitude && a.longitude) {
        addBlocked(a.latitude, a.longitude, a.message, "Alerta de tráfico");
      }
    }
  } catch (e) {
    console.warn("[blocked-roads] No se pudieron obtener alertas:", e);
  }

  try {
    const alertsAll = await fetch(`/api/v1/public/incidents?limit=10`);
    if (alertsAll.ok) {
      const ics = await alertsAll.json();
      for (const ic of Array.isArray(ics) ? ics : []) {
        if (ic.latitude && ic.longitude) {
          addBlocked(ic.latitude, ic.longitude, ic.title || ic.description || "Incidente de tránsito", "Reporte ciudadano");
        }
      }
    }
  } catch (e) {}

  try {
    const data = await fetchAccidentsGeoJSON();
    const features = data.type === "FeatureCollection" ? (data.features || []) : (Array.isArray(data) ? data : []);
    for (const feat of features) {
      if (!feat?.geometry?.coordinates) continue;
      const coords = feat.geometry.coordinates;
      const props = feat.properties || {};
      const lat = coords[1], lng = coords[0];
      const desc = props.clase_incidente || props.description || props.message || "Accidente";
      const gravedad = props.gravedad || props.severity || "desconocido";
      addBlocked(lat, lng, desc, `Accidente: ${gravedad}`);
    }
  } catch (e) {
    console.warn("[blocked-roads] No se pudieron obtener accidentes:", e);
  }
}
*/

function weatherCodeLabel(code) {
  if (code == null) return "\u2014";
  if (code === 0) return "Despejado";
  if (code <= 3) return "Nublado";
  if (code <= 48) return "Niebla";
  if (code <= 67) return "Lluvia";
  if (code <= 77) return "Nieve";
  if (code <= 82) return "Chubascos";
  return "Tormenta";
}

export function updateWeather(rainRisk, weather) {
  const rainGroup = AppState.layerGroups["rain-risk"];
  const weatherGroup = AppState.layerGroups["weather-alerts"];
  if (rainGroup?.clearLayers) rainGroup.clearLayers();
  if (weatherGroup?.clearLayers) weatherGroup.clearLayers();

  if (Array.isArray(rainRisk) && rainGroup) {
    for (let i = 0; i < rainRisk.length; i++) {
      const p = rainRisk[i];
      if (p.lat == null || p.lng == null) continue;
      const prob = p.precipitation_prob_2h ?? 0;
      const color = prob >= 80 ? "#ef4444" : prob >= 65 ? "#f59e0b" : "#38bdf8";
      const circle = L.circle([p.lat, p.lng], {
        radius: 1500, color, fillColor: color, fillOpacity: 0.2, weight: 1,
      });
      circle.bindPopup(`
        <div class="popup-accident">
          <div class="popup-accident-title">${escapeHtml(String(p.location_name))}</div>
          <div class="popup-accident-sev">Riesgo de lluvia (2h): <strong>${prob}%</strong></div>
          <div class="popup-accident-coords">Lluvia actual: ${p.rain_mm ?? 0} mm</div>
        </div>
      `, { className: "popup-dark" });
      rainGroup.addLayer(circle);
    }
  }

  if (Array.isArray(weather) && weatherGroup) {
    for (let i = 0; i < weather.length; i++) {
      const w = weather[i];
      if (w.lat == null || w.lng == null) continue;
      const marker = L.marker([w.lat, w.lng]);
      marker.bindPopup(`
        <div class="popup-accident">
          <div class="popup-accident-title">${escapeHtml(String(w.location_name))}</div>
          <div class="popup-accident-sev">${w.temperature_c ?? "\u2014"}°C · ${escapeHtml(weatherCodeLabel(w.weather_code))}</div>
          <div class="popup-accident-coords">Humedad: ${w.humidity ?? "\u2014"}% · Lluvia: ${w.rain_mm ?? 0} mm</div>
        </div>
      `, { className: "popup-dark" });
      weatherGroup.addLayer(marker);
    }
  }
}

// ── Reportes ciudadanos ──

const REPORT_TYPE_CONFIG = {
  accident: {
    label: "Accidente",
    group: "reports-collision",
    svg: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="15" fill="#ef4444" stroke="#fff" stroke-width="2"/>
      <path d="M16 8v8m0 4h.01" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
    </svg>`,
    color: "#ef4444"
  },
  flood: {
    label: "Inundación",
    group: "reports-flood",
    svg: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="15" fill="#3b82f6" stroke="#fff" stroke-width="2"/>
      <path d="M8 16c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2M8 20c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    color: "#3b82f6"
  },
  obstruction: {
    label: "Obstáculo",
    group: "reports-obstacle",
    svg: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="15" fill="#f59e0b" stroke="#fff" stroke-width="2"/>
      <path d="M16 8L8 24h16L16 8z" fill="#fff"/>
      <path d="M16 14v4m0 2h.01" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    color: "#f59e0b"
  },
  other: {
    label: "Otro",
    group: "reports-obstacle",
    svg: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="15" fill="#6366f1" stroke="#fff" stroke-width="2"/>
      <circle cx="16" cy="16" r="3" fill="#fff"/>
    </svg>`,
    color: "#6366f1"
  },
};

// Tracking de reportes para evitar duplicados
const reportsMarkers = new Map(); // key: report_id, value: marker

export function updateReportsLayers(reports) {
  const groups = AppState.layerGroups;

  if (!Array.isArray(reports)) return;

  const incomingIds = new Set();

  reports.forEach((r) => {
    const lat = r.latitude;
    const lng = r.longitude;
    if (lat == null || lng == null) return;

    const reportId = r.id || `${lat.toFixed(6)}_${lng.toFixed(6)}_${r.report_type}`;
    incomingIds.add(reportId);

    // Si ya existe este reporte, no agregarlo de nuevo
    if (reportsMarkers.has(reportId)) {
      return;
    }

    const cfg = REPORT_TYPE_CONFIG[r.report_type] || REPORT_TYPE_CONFIG.other;
    const group = groups[cfg.group];
    if (!group) return;

    let isTraffic = false;
    if (cfg.group === "reports-obstacle" && r.description && r.description.toLowerCase().includes("cerrada")) {
      isTraffic = true;
    }

    const htmlContent = isTraffic
      ? `<div style="width: 40px; height: 10px; background: rgba(239,68,68,0.7); border: 2px dashed #f87171; border-radius: 4px; box-shadow: 0 0 10px rgba(239,68,68,0.8); transform: rotate(-15deg);"></div>`
      : `<div style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.4));">${cfg.svg}</div>`;

    const icon = L.divIcon({
      className: "report-icon",
      html: htmlContent,
      iconSize: isTraffic ? [40, 10] : [32, 32],
      iconAnchor: isTraffic ? [20, 5] : [16, 32],
      popupAnchor: [0, -32],
    });

    const marker = L.marker([lat, lng], { icon });
    const dateStr = r.created_at
      ? new Date(r.created_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })
      : "";
    marker.bindPopup(`
      <div class="popup-accident">
        <div class="popup-accident-title">${cfg.svg} ${escapeHtml(cfg.label)}</div>
        <div class="popup-accident-sev">${escapeHtml(r.description || "Sin descripción")}</div>
        <div class="popup-accident-coords">${lat.toFixed(4)}, ${lng.toFixed(4)}${dateStr ? " · " + dateStr : ""}</div>
      </div>
    `, { className: "popup-dark" });
    
    group.addLayer(marker);
    reportsMarkers.set(reportId, marker);
  });
}

export function addSingleReport(r) {
  const groups = AppState.layerGroups;
  const lat = r.latitude;
  const lng = r.longitude;
  if (lat == null || lng == null) return;

  const reportId = r.id || `${lat.toFixed(6)}_${lng.toFixed(6)}_${r.report_type}`;
  
  // Si ya existe, no agregarlo de nuevo
  if (reportsMarkers.has(reportId)) {
    console.log('[Reports] Reporte duplicado ignorado:', reportId);
    return;
  }

  const cfg = REPORT_TYPE_CONFIG[r.report_type] || REPORT_TYPE_CONFIG.other;
  const group = groups[cfg.group];
  if (!group) return;

  let isTraffic = false;
  if (cfg.group === "reports-obstacle" && r.description && r.description.toLowerCase().includes("cerrada")) {
    isTraffic = true;
  }

  const htmlContent = isTraffic
    ? `<div style="width: 40px; height: 10px; background: rgba(239,68,68,0.7); border: 2px dashed #f87171; border-radius: 4px; box-shadow: 0 0 10px rgba(239,68,68,0.8); transform: rotate(-15deg);"></div>`
    : `<div style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.4));">${cfg.svg}</div>`;

  const icon = L.divIcon({
    className: "report-icon",
    html: htmlContent,
    iconSize: isTraffic ? [40, 10] : [32, 32],
    iconAnchor: isTraffic ? [20, 5] : [16, 32],
    popupAnchor: [0, -32],
  });

  const marker = L.marker([lat, lng], { icon });
  const dateStr = r.created_at
    ? new Date(r.created_at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })
    : "";
  marker.bindPopup(`
    <div class="popup-accident">
      <div class="popup-accident-title">${cfg.svg} ${escapeHtml(cfg.label)}</div>
      <div class="popup-accident-sev">${escapeHtml(r.description || "Sin descripción")}</div>
      <div class="popup-accident-coords">${lat.toFixed(4)}, ${lng.toFixed(4)}${dateStr ? " · " + dateStr : ""}</div>
    </div>
  `);
  
  group.addLayer(marker);
  reportsMarkers.set(reportId, marker);
  console.log('[Reports] Nuevo reporte agregado:', reportId);
}


export function updateAccidentZones(geojson) {
  const group = AppState.layerGroups["accident-zones"];
  if (!group) return;
  
  group.clearLayers();
  
  if (!geojson || !geojson.features) return;
  
  geojson.features.forEach(feature => {
    const { properties } = feature;
    const severity = properties.severity || 3;
    const count = properties.incident_count || 0;
    
    // Color según severity (1-5)
    const color = severity >= 5 ? "#dc2626" 
                : severity >= 4 ? "#ea580c"
                : severity >= 3 ? "#f59e0b"
                : severity >= 2 ? "#eab308"
                : "#84cc16";
    
    const layer = L.geoJSON(feature, {
      style: {
        color: color,
        weight: 2,
        opacity: 0.8,
        fillColor: color,
        fillOpacity: 0.25
      }
    });
    
    layer.bindPopup(`
      <div class="popup-accident">
        <div class="popup-accident-title">🔥 ${escapeHtml(properties.name)}</div>
        <div class="popup-accident-sev">
          <strong>${count.toLocaleString()}</strong> accidentes históricos
        </div>
        <div class="popup-accident-coords">
          Nivel de peligro: ${severity}/5
        </div>
      </div>
    `, { className: "popup-dark" });
    
    group.addLayer(layer);
  });
  
  console.log(`[accident-zones] ${geojson.features.length} zonas cargadas`);
}


export async function updateTrafficPredictions(map, group) {
  if (!group) return;
  
  group.clearLayers();
  
  try {
    const data = await fetchTrafficPredictions();
    const predictions = data.predictions || [];
    
    if (!predictions.length) {
      console.warn("[traffic-predictions] No hay predicciones disponibles");
      return;
    }
    
    // Convertir a formato de heatmap: [lat, lng, intensity]
    const heatPoints = predictions.map(p => [
      p.lat,
      p.lng,
      p.risk_score / 100 // Normalizar 0-100 a 0-1
    ]);
    
    // Crear heatmap con Leaflet.heat
    if (typeof L.heatLayer === 'function') {
      const heat = L.heatLayer(heatPoints, {
        radius: 45,
        blur: 35,
        maxZoom: 14,
        gradient: { 0.4: 'blue', 0.6: 'cyan', 0.8: 'yellow', 1.0: 'red' }
      });
      group.addLayer(heat);
      
      console.log(`[traffic-predictions] ${predictions.length} predicciones ML cargadas (${data.model})`);
    } else {
      console.warn("[traffic-predictions] Leaflet.heat no está cargado");
    }
    
    // Agregar markers con tooltips para las zonas de mayor riesgo (top 5)
    const topRisk = predictions.slice(0, 5);
    topRisk.forEach(p => {
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: 8,
        fillColor: p.risk_score >= 70 ? '#dc2626' 
                  : p.risk_score >= 50 ? '#f59e0b'
                  : '#eab308',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.6
      });
      
      marker.bindPopup(`
        <div class="popup-accident">
          <div class="popup-accident-title">🚦 ${escapeHtml(p.comuna)}</div>
          <div class="popup-accident-sev">
            Riesgo de congestión: <strong>${p.risk_score}/100</strong>
          </div>
          <div class="popup-accident-coords">
            ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}
          </div>
          <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 4px;">
            Predicción ML · ${new Date(p.timestamp).toLocaleTimeString('es-CO', {hour: '2-digit', minute: '2-digit'})}
          </div>
        </div>
      `, { className: "popup-dark" });
      
      group.addLayer(marker);
    });
    
  } catch (e) {
    console.error("[traffic-predictions] Error cargando predicciones:", e);
  }
}
