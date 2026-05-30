import { AppState } from "../core/state.js";
import { escapeHtml } from "../core/utils.js";
import { onWsEvent } from "../services/api.js";
import { getAccidentSvg } from "../icons/react-icons.js";

const driverIconCache = new Map();

function makeDriverIcon(id, routeLabel = "") {
  const cacheKey = routeLabel || id;
  if (driverIconCache.has(cacheKey)) return driverIconCache.get(cacheKey);

  const html = `
    <div class="gps-driver-marker" title="Conductor #${id}">
      <div class="gps-pulse-ring"></div>
      <div class="gps-pulse-ring gps-pulse-ring--2"></div>
      <div class="gps-bus-body">
        <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="1" y="3" width="18" height="12" rx="2.5" fill="#0f172a" stroke="#38bdf8" stroke-width="1.4"/>
          <rect x="3" y="5" width="5" height="4" rx="1" fill="#38bdf8" opacity="0.85"/>
          <rect x="12" y="5" width="5" height="4" rx="1" fill="#38bdf8" opacity="0.85"/>
          <rect x="1" y="11" width="18" height="2" fill="#1e293b"/>
          <circle cx="5" cy="16" r="2" fill="#334155" stroke="#38bdf8" stroke-width="1"/>
          <circle cx="15" cy="16" r="2" fill="#334155" stroke="#38bdf8" stroke-width="1"/>
          <rect x="8" y="7" width="4" height="2" rx="0.5" fill="#fbbf24" opacity="0.9"/>
        </svg>
      </div>
      ${routeLabel ? `<div class="gps-route-label">${routeLabel}</div>` : ""}
    </div>`;
  const icon = L.divIcon({
    className: "leaflet-div-icon-clean",
    html,
    iconSize: [28, 36],
    iconAnchor: [14, 30],
    popupAnchor: [0, -32],
  });
  driverIconCache.set(cacheKey, icon);
  return icon;
}

const accidentIconCache = {};

function makeAccidentIcon(severity = "high") {
  if (accidentIconCache[severity]) return accidentIconCache[severity];

  const colors = {
    high:   { ring: "#ef4444", fill: "#7f1d1d", text: "#fca5a5", label: "MUERTE" },
    medium: { ring: "#f97316", fill: "#7c2d12", text: "#fdba74", label: "HERIDO" },
    low:    { ring: "#eab308", fill: "#713f12", text: "#fde047", label: "DAÑOS" },
  };
  const c = colors[severity] || colors.high;
  const iconSvg = getAccidentSvg(severity);
  const html = `
    <div class="accident-beacon" data-severity="${severity}">
      <div class="accident-ripple" style="--ring-color:${c.ring}"></div>
      <div class="accident-ripple accident-ripple--2" style="--ring-color:${c.ring}"></div>
      <div class="accident-core" style="background:${c.fill};border-color:${c.ring}">
        ${iconSvg}
      </div>
      <div class="accident-label" style="color:${c.text}">${c.label}</div>
    </div>`;
  const icon = L.divIcon({
    className: "leaflet-div-icon-clean",
    html,
    iconSize: [56, 64],
    iconAnchor: [28, 58],
    popupAnchor: [0, -62],
  });
  accidentIconCache[severity] = icon;
  return icon;
}

function makePredictionZone(center, radiusM, riskLevel = 0.7) {
  const alpha       = (riskLevel * 0.55).toFixed(2);
  const strokeAlpha = (riskLevel * 0.9).toFixed(2);
  const hue         = Math.round(40 - riskLevel * 40);
  const strokeColor = `hsl(${hue},95%,58%)`;
  const fillColor   = `hsl(${hue},95%,48%)`;

  const circle = L.circle(center, {
    radius: radiusM,
    color: strokeColor,
    weight: 1.5,
    opacity: Number(strokeAlpha),
    fillColor,
    fillOpacity: Number(alpha),
    dashArray: "6 4",
    className: "predict-zone",
  });

  const label = L.marker(center, {
    interactive: false,
    icon: L.divIcon({
      className: "leaflet-div-icon-clean",
      html: `<div class="predict-label" style="color:${strokeColor};border-color:${strokeColor}44">
               <span class="predict-pct">${Math.round(riskLevel * 100)}%</span>
               <span class="predict-tag">RIESGO</span>
             </div>`,
      iconSize: [62, 28],
      iconAnchor: [31, 14],
    }),
  });

  return L.layerGroup([circle, label]);
}

export function createDemoLayers(map) {
  const groups = AppState.layerGroups;

  groups["safe-route"]        = L.layerGroup();
  groups["blocked-roads"]     = L.layerGroup();
  groups["accident-clusters"] = L.layerGroup();
  groups["fatalities-layer"]  = L.layerGroup();
  groups["flood-zones"]       = L.layerGroup();
  groups["telemetry-gps"]     = L.layerGroup();
  groups["reports-collision"] = L.layerGroup();
  groups["telemetry-predict"] = L.layerGroup();
  groups["rain-risk"]         = L.layerGroup();
  groups["weather-alerts"]    = L.layerGroup();
  groups["reports-flood"]     = L.layerGroup();
  groups["reports-obstacle"]  = L.layerGroup();

  connectRealTimeLayer(map, groups);
}

let telemetryMarkers = new Map();

function connectRealTimeLayer(map, groups) {
  onWsEvent("telemetry", (data) => {
    const items = Array.isArray(data) ? data : (data.positions || data.vehicles || [data]);
    const telemetryGroup = groups["telemetry-gps"];
    if (!telemetryGroup) return;

    const incomingIds = new Set();

    items.forEach((item) => {
      const id = item.id || item.vehicle_id || item.device_id || `v-${item.lat}-${item.lng}`;
      const lat = item.lat ?? (item.location?.coordinates?.[1] ?? item.latitude);
      const lng = item.lng ?? (item.location?.coordinates?.[0] ?? item.longitude);
      if (lat == null || lng == null) return;
      incomingIds.add(id);

      if (telemetryMarkers.has(id)) {
        const existing = telemetryMarkers.get(id);
        existing.setLatLng([lat, lng]);
      } else {
        const route = item.route || item.route_id || "";
        const marker = L.marker([lat, lng], { icon: makeDriverIcon(id, route) });
        marker.bindPopup(`
          <div class="popup-driver">
            <div class="popup-driver-id">🚌 Conductor <strong>${escapeHtml(String(id))}</strong></div>
            <div class="popup-driver-route">Ruta: <span>${escapeHtml(String(route || ""))}</span></div>
            <div class="popup-driver-status"><span class="dot-green"></span> En servicio</div>
            <div class="popup-driver-coords">${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
          </div>
        `, { className: "popup-dark" });
        telemetryGroup.addLayer(marker);
        telemetryMarkers.set(id, marker);
      }
    });

    telemetryMarkers.forEach((marker, id) => {
      if (!incomingIds.has(id)) {
        telemetryGroup.removeLayer(marker);
        telemetryMarkers.delete(id);
      }
    });
  });

  onWsEvent("accidents", (data) => {
    updateAccidents(data);
  });
}

export function updateAccidents(data) {
  const groups = AppState.layerGroups;
  const accidentsGroup = groups["accident-clusters"];
  if (!accidentsGroup) return;

  accidentsGroup.clearLayers();

  const items = Array.isArray(data) ? data : (data.features || [data]);

  items.forEach((item) => {
    if (!item) return;
    let lat, lng, severity, desc;

    let gravedadLabel = "";
    if (item.geometry && item.properties) {
      const coords = item.geometry.coordinates;
      lat = coords[1];
      lng = coords[0];
      severity = item.properties.severity || "high";
      if (item.properties.gravedad === "MUERTO") { severity = "high"; gravedadLabel = "MUERTO"; }
      else if (item.properties.gravedad === "HERIDO") { severity = "medium"; gravedadLabel = "HERIDO"; }
      else { gravedadLabel = item.properties.gravedad || "DAÑOS"; }
      desc = item.properties.clase_incidente || item.properties.description || item.properties.message || "Incidente";
    } else {
      lat = parseFloat(item.latitud ?? item.lat ?? item.latitude);
      lng = parseFloat(item.longitud ?? item.lng ?? item.longitude);
      if (item.gravedad === "MUERTO") { severity = "high"; gravedadLabel = "MUERTO"; }
      else if (item.gravedad === "HERIDO") { severity = "medium"; gravedadLabel = "HERIDO"; }
      else { severity = item.severity || "low"; gravedadLabel = item.gravedad || "DAÑOS"; }
      desc = item.clase_incidente || item.description || item.message || item.title || "Incidente vial";
    }

    if (isNaN(lat) || isNaN(lng)) return;

    const iconSev = severity === "critical" ? "high" : severity;
    const m = L.marker([lat, lng], { icon: makeAccidentIcon(iconSev) });
    m.bindPopup(`
      <div class="popup-accident">
        <div class="popup-accident-title">⚠ ${escapeHtml(String(desc || ""))}</div>
        <div class="popup-accident-sev">Severidad: <strong>${escapeHtml(String(gravedadLabel))}</strong></div>
        <div class="popup-accident-coords">${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
      </div>
    `, { className: "popup-dark" });
    accidentsGroup.addLayer(m);
  });
}

const fatalitiesCircleColors = {
  high:   "#ef4444",
  medium: "#22c55e",
  low:    "#eab308",
};

let fatalitiesMarkers = new Map();

export function updateFatalitiesMarkers(data) {
  const groups = AppState.layerGroups;
  const group = groups["fatalities-layer"];
  if (!group) return;

  if (data && data.type === "FeatureCollection" && Array.isArray(data.features)) {
    data = data.features;
  }
  if (!Array.isArray(data)) return;

  const incomingKeys = new Set();

  data.forEach((item) => {
    if (!item || !item.geometry) return;
    const coords = item.geometry.coordinates;
    const lat = coords[1];
    const lng = coords[0];
    if (isNaN(lat) || isNaN(lng)) return;

    const p = item.properties || {};
    const gravedad = p.gravedad || "";
    let severity = "low";
    if (gravedad === "MUERTO") severity = "high";
    else if (gravedad === "HERIDO") severity = "medium";
    else severity = p.severity || "low";

    const key = `${lat.toFixed(5)}_${lng.toFixed(5)}_${severity}`;
    incomingKeys.add(key);

    const color = fatalitiesCircleColors[severity] || "#eab308";
    const desc = p.clase_incidente || p.description || "Incidente fatal";

    if (fatalitiesMarkers.has(key)) {
      const marker = fatalitiesMarkers.get(key);
      marker.setLatLng([lat, lng]);
    } else {
      const marker = L.circleMarker([lat, lng], {
        radius: 7,
        color: "#ffffff",
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.9,
        className: "fatality-dot",
      });
      marker.bindPopup(`
        <div class="popup-accident">
          <div class="popup-accident-title">⚠ ${escapeHtml(desc)}</div>
          <div class="popup-accident-sev">Gravedad: <strong>${escapeHtml(gravedad || severity.toUpperCase())}</strong></div>
          <div class="popup-accident-coords">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
        </div>
      `, { className: "popup-dark" });
      group.addLayer(marker);
      fatalitiesMarkers.set(key, marker);
    }
  });

  fatalitiesMarkers.forEach((marker, key) => {
    if (!incomingKeys.has(key)) {
      group.removeLayer(marker);
      fatalitiesMarkers.delete(key);
    }
  });
}


export function updateFloodZones(map, data) {
  const groups = AppState.layerGroups;
  const floodGroup = groups["flood-zones"];
  if (!floodGroup) return;
  if (typeof floodGroup.clearLayers === "function") floodGroup.clearLayers();

  if (!Array.isArray(data)) return;

  const statusColors = {
    dry: { color: "#38bdf8", fill: "#0ea5e9", fillOpacity: 0.15 },
    watch: { color: "#f59e0b", fill: "#d97706", fillOpacity: 0.25 },
    flooded: { color: "#ef4444", fill: "#dc2626", fillOpacity: 0.35 },
  };

  data.forEach((zone) => {
    if (!zone.geom || !zone.name) return;
    const sc = statusColors[zone.status] || statusColors.dry;
    try {
      let geojson = zone.geom;
      if (typeof geojson === "string") geojson = JSON.parse(geojson);

      const layer = L.geoJSON(geojson, {
        style: {
          color: sc.color,
          fillColor: sc.fill,
          fillOpacity: sc.fillOpacity,
          weight: 1.5,
        },
      });
      layer.bindPopup(`
        <div class="popup-accident">
          <div class="popup-accident-title">🌊 ${escapeHtml(String(zone.name))}</div>
          <div class="popup-accident-sev">Estado: <strong>${escapeHtml(String(zone.status).toUpperCase())}</strong></div>
          <div class="popup-accident-coords">${zone.water_level_m != null ? `Nivel: ${zone.water_level_m}m` : ""}</div>
        </div>
      `, { className: "popup-dark" });
      if (typeof floodGroup.addLayer === "function") {
        floodGroup.addLayer(layer);
      }
    } catch (e) {
      // geojson parse error
    }
  });
}

// Etiqueta legible del código WMO de Open-Meteo (resumen).
function weatherCodeLabel(code) {
  if (code == null) return "—";
  if (code === 0) return "Despejado";
  if (code <= 3) return "Nublado";
  if (code <= 48) return "Niebla";
  if (code <= 67) return "Lluvia";
  if (code <= 77) return "Nieve";
  if (code <= 82) return "Chubascos";
  return "Tormenta";
}

export function updateWeather(rainRisk, weather) {
  const groups = AppState.layerGroups;
  const rainGroup = groups["rain-risk"];
  const weatherGroup = groups["weather-alerts"];
  if (rainGroup?.clearLayers) rainGroup.clearLayers();
  if (weatherGroup?.clearLayers) weatherGroup.clearLayers();

  // Capa rain-risk: círculo por punto, color/tamaño según probabilidad de lluvia 2h.
  if (Array.isArray(rainRisk) && rainGroup) {
    rainRisk.forEach((p) => {
      if (p.lat == null || p.lng == null) return;
      const prob = p.precipitation_prob_2h ?? 0;
      const color = prob >= 80 ? "#ef4444" : prob >= 65 ? "#f59e0b" : "#38bdf8";
      const circle = L.circle([p.lat, p.lng], {
        radius: 1500,
        color,
        fillColor: color,
        fillOpacity: 0.25,
        weight: 1.5,
      });
      circle.bindPopup(`
        <div class="popup-accident">
          <div class="popup-accident-title">🌧️ ${escapeHtml(String(p.location_name))}</div>
          <div class="popup-accident-sev">Riesgo de lluvia (2h): <strong>${prob}%</strong></div>
          <div class="popup-accident-coords">Lluvia actual: ${p.rain_mm ?? 0} mm</div>
        </div>
      `, { className: "popup-dark" });
      rainGroup.addLayer(circle);
    });
  }

  // Capa weather-alerts: marcador con el clima actual de cada punto.
  if (Array.isArray(weather) && weatherGroup) {
    weather.forEach((w) => {
      if (w.lat == null || w.lng == null) return;
      const marker = L.marker([w.lat, w.lng]);
      marker.bindPopup(`
        <div class="popup-accident">
          <div class="popup-accident-title">🌡️ ${escapeHtml(String(w.location_name))}</div>
          <div class="popup-accident-sev">${w.temperature_c ?? "—"}°C · ${escapeHtml(weatherCodeLabel(w.weather_code))}</div>
          <div class="popup-accident-coords">Humedad: ${w.humidity ?? "—"}% · Lluvia: ${w.rain_mm ?? 0} mm</div>
        </div>
      `, { className: "popup-dark" });
      weatherGroup.addLayer(marker);
    });
  }
}
