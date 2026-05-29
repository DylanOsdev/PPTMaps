import { AppState } from "../core/state.js";

// ─── GPS Driver marker (compact bus icon) ─────────────────────────────────────
function makeDriverIcon(id, routeLabel = "") {
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
  return L.divIcon({
    className: "leaflet-div-icon-clean",
    html,
    iconSize: [28, 36],
    iconAnchor: [14, 30],
    popupAnchor: [0, -32],
  });
}

// ─── Accident beacon marker (SVG warning pulse) ───────────────────────────────
function makeAccidentIcon(severity = "high") {
  const colors = {
    high:   { ring: "#ef4444", fill: "#7f1d1d", text: "#fca5a5" },
    medium: { ring: "#f97316", fill: "#7c2d12", text: "#fdba74" },
    low:    { ring: "#eab308", fill: "#713f12", text: "#fde047" },
  };
  const c = colors[severity] || colors.high;
  const html = `
    <div class="accident-beacon" data-severity="${severity}">
      <div class="accident-ripple" style="--ring-color:${c.ring}"></div>
      <div class="accident-ripple accident-ripple--2" style="--ring-color:${c.ring}"></div>
      <div class="accident-core" style="background:${c.fill};border-color:${c.ring}">
        <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14">
          <path d="M8 1L15 14H1L8 1Z" fill="${c.fill}" stroke="${c.ring}" stroke-width="1.5" stroke-linejoin="round"/>
          <rect x="7.2" y="5.5" width="1.6" height="4.5" rx="0.6" fill="${c.text}"/>
          <circle cx="8" cy="11.8" r="0.9" fill="${c.text}"/>
        </svg>
      </div>
      <div class="accident-label" style="color:${c.text}">ACCIDENTE</div>
    </div>`;
  return L.divIcon({
    className: "leaflet-div-icon-clean",
    html,
    iconSize: [56, 64],
    iconAnchor: [28, 58],
    popupAnchor: [0, -62],
  });
}

// ─── Prediction zone (heat-gradient circle overlay) ───────────────────────────
function makePredictionZone(center, radiusM, riskLevel = 0.7) {
  const alpha       = (riskLevel * 0.55).toFixed(2);
  const strokeAlpha = (riskLevel * 0.9).toFixed(2);
  const hue         = Math.round(40 - riskLevel * 40); // amber→red
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

// ─── Blocked road segments — SINGLE BLOCK precision (~80-130 m each) ──────────
// Each entry has exactly 2 coords representing ONE street block.
// Latitude 0.001° ≈ 111m | Longitude 0.001° ≈ 88m at 6° lat
const BLOCKED_ROADS_DATA = [
  {
    id: "blk-001",
    name: "Clle 30 (San Juan) · Cra 72–73",
    coords: [
      [6.2435, -75.5938],  // start of the blocked block
      [6.2435, -75.5926],  // end (~106m east along Calle 30)
    ],
    reason: "Accidente de tránsito",
    since: "15:42",
  },
  {
    id: "blk-002",
    name: "Cra 43A (Av. Poblado) · Clle 4 Sur",
    coords: [
      [6.2099, -75.5690],  // start of the blocked block
      [6.2110, -75.5686],  // end (~130m north along Cra 43A)
    ],
    reason: "Obra en vía",
    since: "08:00",
  },
];

function buildBlockedRoadsLayer(map) {
  const group = L.layerGroup();

  BLOCKED_ROADS_DATA.forEach((road) => {
    // Red blocked segment line
    const line = L.polyline(road.coords, {
      color: "#ef4444",
      weight: 7,
      opacity: 0.88,
      lineCap: "round",
      className: "blocked-road-line",
    });

    // Dashed overlay for visual texture
    const dash = L.polyline(road.coords, {
      color: "#ffffff",
      weight: 2,
      opacity: 0.6,
      dashArray: "8 6",
      className: "blocked-road-dash",
    });

    // ⛔ barrier at first endpoint
    const startPt = road.coords[0];
    const endPt   = road.coords[road.coords.length - 1];

    const barrierIcon = L.divIcon({
      className: "leaflet-div-icon-clean",
      html: `<div class="barrier-icon">⛔</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const markerStart = L.marker(startPt, { icon: barrierIcon, zIndexOffset: 500 });
    const markerEnd   = L.marker(endPt,   { icon: barrierIcon, zIndexOffset: 500 });

    // Label at midpoint
    const mid = road.coords[Math.floor(road.coords.length / 2)];
    const labelMarker = L.marker(mid, {
      interactive: false,
      icon: L.divIcon({
        className: "leaflet-div-icon-clean",
        html: `<div class="blocked-road-label">
                 <span class="blocked-road-name">${road.name}</span>
                 <span class="blocked-road-reason">${road.reason} · desde ${road.since}</span>
               </div>`,
        iconSize: [160, 36],
        iconAnchor: [80, -6],
      }),
    });

    const popupContent = `
      <div class="popup-accident">
        <div class="popup-accident-title">⛔ ${road.name}</div>
        <div class="popup-accident-sev">Motivo: <strong>${road.reason}</strong></div>
        <div class="popup-driver-route">Bloqueado desde: <span>${road.since}</span></div>
        <div class="popup-accident-coords">ID: ${road.id}</div>
      </div>`;

    line.bindPopup(popupContent, { className: "popup-dark" });
    markerStart.bindPopup(popupContent, { className: "popup-dark" });
    markerEnd.bindPopup(popupContent, { className: "popup-dark" });

    group.addLayer(line);
    group.addLayer(dash);
    group.addLayer(markerStart);
    group.addLayer(markerEnd);
    group.addLayer(labelMarker);
  });

  return group;
}

// ─── Main layer factory ───────────────────────────────────────────────────────
export function createDemoLayers(map) {
  const groups = AppState.layerGroups;

  // ── Safe route (no destination label — Belén is already a comuna) ──────────
  const routePath = [
    [6.251, -75.59],
    [6.248, -75.585],
    [6.245, -75.578],
    [6.242, -75.572],
    [6.238, -75.568],
  ];
  const safeRoute = L.polyline(routePath, {
    color: "#4ade80",
    weight: 5,
    opacity: 0.88,
    className: "marker-safe-route",
  });
  const safeRouteDash = L.polyline(routePath, {
    color: "#86efac",
    weight: 2,
    opacity: 0.7,
    dashArray: "10 8",
    className: "marker-safe-route-dash",
  });

  // ── GPS Drivers ──────────────────────────────────────────────────────────────
  const driverPositions = [
    { lat: 6.251, lng: -75.582, id: "M-14", route: "R14" },
    { lat: 6.245, lng: -75.571, id: "M-07", route: "R07" },
    { lat: 6.238, lng: -75.592, id: "M-22", route: "R22" },
    { lat: 6.260, lng: -75.563, id: "M-03", route: "R03" },
    { lat: 6.233, lng: -75.579, id: "M-11", route: "R11" },
    { lat: 6.258, lng: -75.578, id: "M-19", route: "R19" },
    { lat: 6.242, lng: -75.556, id: "M-31", route: "R31" },
    { lat: 6.256, lng: -75.598, id: "M-08", route: "R08" },
    { lat: 6.236, lng: -75.565, id: "M-25", route: "R25" },
    { lat: 6.264, lng: -75.571, id: "M-16", route: "R16" },
    { lat: 6.248, lng: -75.544, id: "M-05", route: "R05" },
    { lat: 6.229, lng: -75.588, id: "M-33", route: "R33" },
  ];

  const telemetry = L.layerGroup();
  driverPositions.forEach(({ lat, lng, id, route }) => {
    const m = L.marker([lat, lng], { icon: makeDriverIcon(id, route) });
    m.bindPopup(`
      <div class="popup-driver">
        <div class="popup-driver-id">🚌 Conductor <strong>${id}</strong></div>
        <div class="popup-driver-route">Ruta: <span>${route}</span></div>
        <div class="popup-driver-status"><span class="dot-green"></span> En servicio</div>
        <div class="popup-driver-coords">${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
      </div>
    `, { className: "popup-dark" });
    telemetry.addLayer(m);
  });

  // ── Accident beacons ─────────────────────────────────────────────────────────
  const accidentData = [
    { lat: 6.255, lng: -75.595, severity: "high",   desc: "Colisión múltiple · Autopista Norte" },
    { lat: 6.240, lng: -75.588, severity: "medium",  desc: "Choque leve · Av. El Poblado" },
    { lat: 6.262, lng: -75.570, severity: "low",    desc: "Alcance trasero · Calle 30" },
    { lat: 6.234, lng: -75.578, severity: "high",   desc: "Volcamiento · Cra. 80" },
  ];
  const accidents = L.layerGroup();
  accidentData.forEach(({ lat, lng, severity, desc }) => {
    const m = L.marker([lat, lng], { icon: makeAccidentIcon(severity) });
    m.bindPopup(`
      <div class="popup-accident">
        <div class="popup-accident-title">⚠ ${desc}</div>
        <div class="popup-accident-sev">Severidad: <strong>${severity.toUpperCase()}</strong></div>
        <div class="popup-accident-coords">${lat.toFixed(4)}, ${lng.toFixed(4)}</div>
      </div>
    `, { className: "popup-dark" });
    accidents.addLayer(m);
  });

  // ── Prediction zones ─────────────────────────────────────────────────────────
  const predictionData = [
    { center: [6.252, -75.578], radius: 420, risk: 0.88 },
    { center: [6.241, -75.591], radius: 310, risk: 0.62 },
    { center: [6.263, -75.568], radius: 260, risk: 0.41 },
  ];
  const telemetryPredict = L.layerGroup();
  predictionData.forEach(({ center, radius, risk }) => {
    makePredictionZone(center, radius, risk).addTo(telemetryPredict);
  });

  // ── Flood zone ───────────────────────────────────────────────────────────────
  const floods = L.polygon(
    [
      [6.252, -75.582],
      [6.25,  -75.575],
      [6.246, -75.577],
      [6.248, -75.584],
    ],
    {
      color: "#38bdf8",
      fillColor: "#0ea5e9",
      fillOpacity: 0.25,
      weight: 1.5,
      dashArray: "6 3",
      className: "flood-zone-poly",
    }
  );

  // ── Blocked roads layer (vías bloqueadas con segmentos en el mapa) ───────────
  const blockedLayer = buildBlockedRoadsLayer(map);

  // ── Assign layer groups ───────────────────────────────────────────────────────
  groups["safe-route"]        = L.layerGroup([safeRoute, safeRouteDash]);
  groups["blocked-roads"]     = blockedLayer;
  groups["accident-clusters"] = accidents;
  groups["flood-zones"]       = floods;
  groups["telemetry-gps"]     = telemetry;
  groups["reports-collision"] = accidents;
  groups["telemetry-predict"] = telemetryPredict;
  groups["rain-risk"]         = L.layerGroup();
  groups["weather-alerts"]    = L.layerGroup();
  groups["reports-flood"]     = L.layerGroup([floods]);
  groups["reports-obstacle"]  = L.layerGroup([blockedLayer]);
}
