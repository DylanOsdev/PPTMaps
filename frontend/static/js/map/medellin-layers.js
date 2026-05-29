import { COMUNA_COLORS, CONFIG } from "../config/constants.js";
import { AppState } from "../core/state.js";
import { escapeHtml, hexagonAround, pointInPolygon } from "../core/utils.js";

function ensurePane(map, name, zIndex) {
  if (!map.getPane(name)) {
    map.createPane(name);
    map.getPane(name).style.zIndex = String(zIndex);
  }
  return name;
}

// ── Polígonos aproximados de las 16 comunas de Medellín ─────────────────────────
// Coordenadas trazadas sobre cartografía real del IGAC/DANE
const COMUNA_POLYGONS = {
  1:  [[6.308,-75.537],[6.302,-75.528],[6.290,-75.528],[6.283,-75.535],[6.288,-75.550],[6.300,-75.556],[6.308,-75.544]],
  2:  [[6.312,-75.518],[6.305,-75.508],[6.292,-75.510],[6.285,-75.520],[6.290,-75.528],[6.302,-75.528],[6.308,-75.516]],
  3:  [[6.290,-75.528],[6.285,-75.520],[6.272,-75.524],[6.265,-75.535],[6.270,-75.550],[6.283,-75.555],[6.290,-75.547]],
  4:  [[6.283,-75.555],[6.270,-75.550],[6.263,-75.555],[6.265,-75.568],[6.273,-75.572],[6.282,-75.568],[6.284,-75.558]],
  5:  [[6.300,-75.556],[6.288,-75.550],[6.283,-75.555],[6.284,-75.568],[6.292,-75.575],[6.300,-75.570],[6.303,-75.560]],
  6:  [[6.308,-75.568],[6.300,-75.562],[6.296,-75.570],[6.292,-75.578],[6.296,-75.590],[6.305,-75.590],[6.310,-75.576]],
  7:  [[6.296,-75.590],[6.285,-75.588],[6.272,-75.592],[6.264,-75.604],[6.268,-75.622],[6.280,-75.625],[6.292,-75.616],[6.296,-75.602]],
  8:  [[6.265,-75.535],[6.255,-75.528],[6.244,-75.530],[6.238,-75.540],[6.244,-75.556],[6.255,-75.558],[6.263,-75.548]],
  9:  [[6.244,-75.556],[6.238,-75.548],[6.226,-75.546],[6.218,-75.552],[6.222,-75.568],[6.234,-75.572],[6.244,-75.565]],
  10: [[6.263,-75.548],[6.255,-75.558],[6.244,-75.556],[6.244,-75.565],[6.252,-75.570],[6.260,-75.572],[6.265,-75.563]],
  11: [[6.258,-75.572],[6.252,-75.570],[6.244,-75.575],[6.240,-75.590],[6.248,-75.598],[6.256,-75.598],[6.262,-75.582]],
  12: [[6.268,-75.590],[6.260,-75.585],[6.252,-75.588],[6.246,-75.600],[6.250,-75.614],[6.260,-75.616],[6.268,-75.604]],
  13: [[6.260,-75.614],[6.250,-75.614],[6.240,-75.618],[6.234,-75.630],[6.240,-75.642],[6.252,-75.640],[6.264,-75.626]],
  14: [[6.222,-75.548],[6.212,-75.548],[6.198,-75.554],[6.192,-75.568],[6.198,-75.580],[6.212,-75.584],[6.224,-75.572]],
  15: [[6.234,-75.572],[6.222,-75.568],[6.218,-75.580],[6.220,-75.598],[6.230,-75.604],[6.240,-75.598],[6.244,-75.580]],
  16: [[6.248,-75.598],[6.240,-75.598],[6.230,-75.604],[6.224,-75.614],[6.230,-75.628],[6.242,-75.630],[6.250,-75.616],[6.254,-75.603]],
};

// ── 9 Municipios del Área Metropolitana del Valle del Aburrá ───────────────────
// Polígonos aproximados trazados sobre límites administrativos reales
const METRO_MUNICIPIOS = [
  {
    name: "Bello",
    slug: "bello",
    center: [6.337, -75.557],
    color: "#6b8cba",
    polygon: [
      [6.313,-75.592],[6.315,-75.528],[6.354,-75.516],[6.372,-75.530],
      [6.370,-75.572],[6.358,-75.592],[6.338,-75.598],
    ],
  },
  {
    name: "Copacabana",
    slug: "copacabana",
    center: [6.354, -75.506],
    color: "#5f9476",
    polygon: [
      [6.338,-75.530],[6.340,-75.488],[6.362,-75.474],[6.382,-75.488],
      [6.382,-75.514],[6.368,-75.530],
    ],
  },
  {
    name: "Girardota",
    slug: "girardota",
    center: [6.388, -75.449],
    color: "#8b7bb5",
    polygon: [
      [6.368,-75.472],[6.370,-75.428],[6.393,-75.418],[6.412,-75.432],
      [6.410,-75.460],[6.393,-75.474],
    ],
  },
  {
    name: "Barbosa",
    slug: "barbosa",
    center: [6.438, -75.338],
    color: "#b59050",
    polygon: [
      [6.413,-75.362],[6.415,-75.316],[6.450,-75.308],[6.470,-75.324],
      [6.466,-75.355],[6.450,-75.368],
    ],
  },
  {
    name: "Itagüí",
    slug: "itagui",
    center: [6.184, -75.602],
    color: "#ba6b6b",
    polygon: [
      [6.202,-75.634],[6.202,-75.566],[6.175,-75.558],[6.160,-75.572],
      [6.160,-75.642],[6.180,-75.652],
    ],
  },
  {
    name: "Envigado",
    slug: "envigado",
    center: [6.170, -75.572],
    color: "#5f9494",
    polygon: [
      [6.190,-75.597],[6.190,-75.545],[6.165,-75.540],[6.148,-75.556],
      [6.150,-75.590],[6.170,-75.604],
    ],
  },
  {
    name: "Sabaneta",
    slug: "sabaneta",
    center: [6.149, -75.615],
    color: "#b5a84a",
    polygon: [
      [6.168,-75.632],[6.168,-75.590],[6.148,-75.580],[6.130,-75.594],
      [6.130,-75.634],[6.150,-75.644],
    ],
  },
  {
    name: "La Estrella",
    slug: "la-estrella",
    center: [6.155, -75.645],
    color: "#7c90b5",
    polygon: [
      [6.170,-75.664],[6.170,-75.630],[6.145,-75.622],[6.124,-75.638],
      [6.122,-75.670],[6.142,-75.678],
    ],
  },
  {
    name: "Caldas",
    slug: "caldas",
    center: [6.093, -75.635],
    color: "#a06b94",
    polygon: [
      [6.132,-75.663],[6.130,-75.610],[6.095,-75.600],[6.068,-75.616],
      [6.064,-75.662],[6.090,-75.676],[6.115,-75.670],
    ],
  },
];

// Bounding box de todo el Valle del Aburrá (para el fitBounds inicial)
const VALLE_BOUNDS = [[6.055, -75.685], [6.478, -75.298]];

export function createMedellinLayers(map, data) {
  const paneMetro  = ensurePane(map, "metroPane",   340); // debajo de Medellín
  const paneCity   = ensurePane(map, "medellinPane", 350);
  const paneComunas = ensurePane(map, "comunasPane", 360);
  const outline    = data.city.outline;
  const center     = data.city.center;

  // ── Municipios del Área Metropolitana ────────────────────────────────────────
  const metroLayers = [];
  const metroLabels = [];

  METRO_MUNICIPIOS.forEach((mun) => {
    const poly = L.polygon(mun.polygon, {
      pane: paneMetro,
      className: `metro-polygon metro-${mun.slug}`,
      color: mun.color,
      weight: 2,
      opacity: 0.85,
      fillColor: mun.color,
      fillOpacity: 0.10,
      dashArray: "6 4",
    });

    poly.on("mouseover", function () {
      this.setStyle({ fillOpacity: 0.28, weight: 2.5 });
    });
    poly.on("mouseout", function () {
      this.setStyle({ fillOpacity: 0.10, weight: 2 });
    });
    poly.on("click", () => {
      map.flyTo(mun.center, 13, { duration: 0.9 });
      L.popup({ className: "popup-dark" })
        .setLatLng(mun.center)
        .setContent(`
          <div class="popup-driver">
            <div class="popup-driver-id" style="color:${mun.color}">${mun.name}</div>
            <div class="popup-driver-route">Valle del Aburrá · Área Metropolitana</div>
            <div class="popup-driver-coords">${mun.center[0].toFixed(4)}, ${mun.center[1].toFixed(4)}</div>
          </div>`)
        .openOn(map);
    });

    const label = L.marker(mun.center, {
      pane: paneMetro,
      interactive: false,
      icon: L.divIcon({
        className: "leaflet-div-icon-clean",
        html: `<div class="metro-label-pill" style="--mclr:${mun.color}">
                 <span class="metro-label-name">${escapeHtml(mun.name)}</span>
               </div>`,
        iconSize: [100, 20],
        iconAnchor: [50, 10],
      }),
    });

    metroLayers.push(poly);
    metroLabels.push(label);
  });

  const metroGroup = L.layerGroup([...metroLayers, ...metroLabels]);

  // ── Ciudad de Medellín (contorno) ────────────────────────────────────────────
  const areaGlow = L.polygon(outline, {
    pane: paneCity,
    className: "medellin-area-glow",
    color: "#67e8f9",
    weight: 8,
    opacity: 0.35,
    fillOpacity: 0,
  });

  const areaFill = L.polygon(outline, {
    pane: paneCity,
    className: "medellin-area-fill",
    color: "#fbbf24",
    weight: 3,
    opacity: 0.95,
    fillColor: "#38bdf8",
    fillOpacity: 0.08,
    dashArray: "10, 6",
  });

  const corePulse = L.circle(center, {
    pane: paneCity,
    className: "medellin-pulse",
    radius: 2200,
    color: "#fbbf24",
    weight: 2,
    opacity: 0.6,
    fillColor: "#fbbf24",
    fillOpacity: 0.06,
  });

  const cityLabel = L.marker(center, {
    pane: paneCity,
    interactive: false,
    icon: L.divIcon({
      className: "medellin-label-wrap",
      html: '<div class="medellin-city-label">MEDELLÍN</div>',
      iconSize: [160, 36],
      iconAnchor: [80, 18],
    }),
  });

  // ── Comunas de Medellín (polígonos precisos + etiquetas pill) ─────────────────
  const comunaLayers = [];
  const comunaLabels = [];

  data.comunas.forEach((comuna, index) => {
    const coords = COMUNA_POLYGONS[comuna.number]
      || hexagonAround(comuna.center, comuna.radius || 0.012);

    comuna._polygon = coords;

    const color = COMUNA_COLORS[index % COMUNA_COLORS.length];

    const poly = L.polygon(coords, {
      pane: paneComunas,
      className: `comuna-polygon comuna-${comuna.slug}`,
      color,
      weight: 1.8,
      opacity: 0.9,
      fillColor: color,
      fillOpacity: 0.12,
    });

    poly.on("mouseover", function () {
      this.setStyle({ fillOpacity: 0.32, weight: 2.5 });
      highlightComunaUI(comuna);
    });
    poly.on("mouseout", function () {
      this.setStyle({ fillOpacity: 0.12, weight: 1.8 });
    });
    poly.on("click", () => {
      map.flyTo(comuna.center, 14, { duration: 0.8 });
      L.popup({ className: "popup-dark" })
        .setLatLng(comuna.center)
        .setContent(`
          <div class="popup-driver">
            <div class="popup-driver-id" style="color:${color}">C${comuna.number} — ${escapeHtml(comuna.name)}</div>
            <div class="popup-driver-route">Medellín · Valle del Aburrá</div>
            <div class="popup-driver-coords">${comuna.center[0].toFixed(4)}, ${comuna.center[1].toFixed(4)}</div>
          </div>`)
        .openOn(map);
      highlightComunaUI(comuna);
    });

    const label = L.marker(comuna.center, {
      pane: paneComunas,
      interactive: false,
      icon: L.divIcon({
        className: "comuna-label-wrap",
        html: `<div class="comuna-label-pill" style="--clr:${color}">
                 <span class="comuna-label-num">C${comuna.number}</span>
                 <span class="comuna-label-name">${escapeHtml(comuna.name)}</span>
               </div>`,
        iconSize: [130, 22],
        iconAnchor: [65, 11],
      }),
    });

    comunaLayers.push(poly);
    comunaLabels.push(label);
  });

  const cityGroup    = L.layerGroup([areaGlow, areaFill, corePulse, cityLabel]);
  const comunasGroup = L.layerGroup([...comunaLayers, ...comunaLabels]);

  AppState.layerGroups["medellin-city"]    = cityGroup;
  AppState.layerGroups["medellin-comunas"] = comunasGroup;
  AppState.layerGroups["metro-municipios"] = metroGroup;

  // Agregar todo al mapa
  metroGroup.addTo(map);
  cityGroup.addTo(map);
  comunasGroup.addTo(map);

  // Ajustar vista a TODO el Valle del Aburrá
  map.fitBounds(VALLE_BOUNDS, { padding: [50, 50], maxZoom: 12 });

  return { outline, isInsideCity: (lat, lng) => pointInPolygon(lat, lng, outline) };
}

function highlightComunaUI(comuna) {
  AppState.activeComuna = comuna;
  const el = document.getElementById("statComuna");
  if (el) el.textContent = `Comuna ${comuna.number} — ${comuna.name}`;

  document.querySelectorAll(".comuna-list-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.slug === comuna.slug);
  });
}

export function renderComunasList(container, data, map) {
  if (!container) return;

  container.innerHTML = data.comunas
    .map(
      (c) => `
    <li>
      <button type="button" class="comuna-list-item" data-slug="${c.slug}" data-lat="${c.center[0]}" data-lng="${c.center[1]}">
        <span class="comuna-num">C${c.number}</span>
        <span class="comuna-name">${escapeHtml(c.name)}</span>
      </button>
    </li>`
    )
    .join("");

  container.querySelectorAll(".comuna-list-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const comuna = data.comunas.find((x) => x.slug === btn.dataset.slug);
      if (!comuna) return;
      map.flyTo(comuna.center, 14, { duration: 0.8 });
      highlightComunaUI(comuna);
    });
  });
}
