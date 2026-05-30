import { COMUNA_COLORS, CONFIG } from "../config/constants.js";
import { AppState } from "../core/state.js";
import { escapeHtml, hexagonAround, pointInPolygon } from "../core/utils.js";

// El mapa ahora dibuja estrictamente los polígonos reales obtenidos del GeoJSON.

function ensurePane(map, name, zIndex) {
  if (!map.getPane(name)) {
    map.createPane(name);
    map.getPane(name).style.zIndex = String(zIndex);
  }
  return name;
}

// ── Polígonos aproximados de las 16 comunas de Medellín ─────────────────────────
// Coordenadas trazadas sobre cartografía real del IGAC/DANE
// Los polígonos ahora se cargan exactamente desde el geojson
// por lo tanto COMUNA_POLYGONS ya no es necesario

// ── 9 Municipios del Área Metropolitana del Valle del Aburrá ───────────────────
// Los polígonos ahora se cargan exactamente desde el geojson (data.municipios)

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

  const metroLayerData = data.municipios || [];
  metroLayerData.forEach((mun) => {
    let poly;
    const styleObj = {
      className: `metro-polygon metro-${mun.slug}`,
      color: mun.color,
      weight: 1.2,
      opacity: 0.7,
      fillColor: mun.color,
      fillOpacity: 0.04,
    };

    const hasPolygon = mun.geojson && mun.geojson.geometry && mun.geojson.geometry.type !== 'Point';

    if (hasPolygon) {
      poly = L.geoJSON(mun.geojson, { pane: paneMetro, style: styleObj });
    } else {
      // Fallback a un círculo si por alguna razón falla la carga del GeoJSON
      poly = L.circle(mun.center, { radius: 2000, pane: paneMetro, ...styleObj });
    }

    const bindMetroEvents = (layer) => {
      layer.on("mouseover", function () {
        this.setStyle({ fillOpacity: 0.15, weight: 2.0 });
      });
      layer.on("mouseout", function () {
        this.setStyle({ fillOpacity: 0.04, weight: 1.2 });
      });
      layer.on("click", () => {
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
    };

    if (hasPolygon) {
      poly.eachLayer(bindMetroEvents);
    } else {
      bindMetroEvents(poly);
    }

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
  // Contorno amarillo, brillo y pulso removidos a petición del usuario.

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
    const color = COMUNA_COLORS[index % COMUNA_COLORS.length];

    let poly;
    const styleObj = {
      className: `comuna-polygon comuna-${comuna.slug}`,
      color: color,
      weight: 1.2,
      opacity: 0.7,
      fillColor: color,
      fillOpacity: 0.04,
    };

    if (comuna.geojson && comuna.geojson.geometry && comuna.geojson.geometry.type !== 'Point') {
      poly = L.geoJSON(comuna.geojson, { pane: paneComunas, style: styleObj });
    } else {
      // Fallback a un círculo si falla la carga
      poly = L.circle(comuna.center, { radius: 1500, pane: paneComunas, ...styleObj });
    }

    const bindPolyEvents = (layer) => {
      layer.on("mouseover", function () {
        this.setStyle({ fillOpacity: 0.20, weight: 2.2 });
        highlightComunaUI(comuna);
      });
      layer.on("mouseout", function () {
        this.setStyle({ fillOpacity: 0.04, weight: 1.2 });
      });
      layer.on("click", () => {
        map.flyTo(comuna.center, 13, { duration: 0.8 });
        const prefix = comuna.type === 'corregimiento' ? 'Corregimiento' : 'C' + comuna.number;
        L.popup({ className: "popup-dark" })
          .setLatLng(comuna.center)
          .setContent(`
            <div class="popup-driver">
              <div class="popup-driver-id" style="color:${color}">${prefix} — ${escapeHtml(comuna.name)}</div>
              <div class="popup-driver-route">Medellín · Valle del Aburrá</div>
              <div class="popup-driver-coords">${comuna.center[0].toFixed(4)}, ${comuna.center[1].toFixed(4)}</div>
            </div>`)
          .openOn(map);
        highlightComunaUI(comuna);
      });
    };

    if (comuna.geojson && comuna.geojson.geometry && comuna.geojson.geometry.type !== 'Point') {
      poly.eachLayer(bindPolyEvents);
    } else {
      bindPolyEvents(poly);
    }

    const label = L.marker(comuna.center, {
      pane: paneComunas,
      interactive: false,
      icon: L.divIcon({
        className: "comuna-label-wrap",
        html: `<div class="comuna-label-pill" style="--clr:${color}">
                 <span class="comuna-label-num">${comuna.type === 'corregimiento' ? 'CG' : 'C'}${comuna.type === 'corregimiento' ? '' : comuna.number}</span>
                 <span class="comuna-label-name">${escapeHtml(comuna.name)}</span>
               </div>`,
        iconSize: [130, 22],
        iconAnchor: [65, 11],
      }),
    });

    comunaLayers.push(poly);
    comunaLabels.push(label);
  });

  const cityGroup    = L.layerGroup([cityLabel]);
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
  const prefix = comuna.type === 'corregimiento' ? 'Corregimiento' : 'Comuna ' + comuna.number;
  if (el) el.textContent = `${prefix} — ${comuna.name}`;

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
        <span class="comuna-num">${c.type === 'corregimiento' ? 'CG' : 'C'}${c.type === 'corregimiento' ? '' : c.number}</span>
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
