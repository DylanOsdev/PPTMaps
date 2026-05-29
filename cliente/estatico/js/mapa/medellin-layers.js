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

export function createMedellinLayers(map, data) {
  const paneCity = ensurePane(map, "medellinPane", 350);
  const paneComunas = ensurePane(map, "comunasPane", 360);
  const outline = data.city.outline;
  const center = data.city.center;

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
    fillOpacity: 0.1,
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

  const comunaLayers = [];
  const comunaLabels = [];

  data.comunas.forEach((comuna, index) => {
    const polygonCoords = hexagonAround(comuna.center, comuna.radius || 0.012);
    comuna._polygon = polygonCoords;

    const color = COMUNA_COLORS[index % COMUNA_COLORS.length];

    const poly = L.polygon(polygonCoords, {
      pane: paneComunas,
      className: `comuna-polygon comuna-${comuna.slug}`,
      color,
      weight: 2,
      opacity: 0.85,
      fillColor: color,
      fillOpacity: 0.15,
    });

    poly.on("mouseover", function () {
      this.setStyle({ fillOpacity: 0.35, weight: 3 });
      highlightComunaUI(comuna);
    });
    poly.on("mouseout", function () {
      this.setStyle({ fillOpacity: 0.15, weight: 2 });
    });
    poly.on("click", () => {
      map.flyTo(comuna.center, 14, { duration: 0.8 });
      L.popup()
        .setLatLng(comuna.center)
        .setContent(
          `<strong>Comuna ${comuna.number}</strong><br>${escapeHtml(comuna.name)}`
        )
        .openOn(map);
      highlightComunaUI(comuna);
    });

    const label = L.marker(comuna.center, {
      pane: paneComunas,
      interactive: false,
      icon: L.divIcon({
        className: "comuna-label-wrap",
        html: `<span class="comuna-label" style="border-color:${color}88;color:${color}">C${comuna.number} ${escapeHtml(comuna.name)}</span>`,
        iconSize: [120, 20],
        iconAnchor: [60, 10],
      }),
    });

    comunaLayers.push(poly);
    comunaLabels.push(label);
  });

  const cityGroup = L.layerGroup([areaGlow, areaFill, corePulse, cityLabel]);
  const comunasGroup = L.layerGroup([...comunaLayers, ...comunaLabels]);

  AppState.layerGroups["medellin-city"] = cityGroup;
  AppState.layerGroups["medellin-comunas"] = comunasGroup;

  cityGroup.addTo(map);
  comunasGroup.addTo(map);

  map.fitBounds(areaFill.getBounds(), { padding: [60, 60], maxZoom: 13 });

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
