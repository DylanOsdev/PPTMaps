import { CONFIG } from "../config/constants.js";
import { AppState } from "../core/state.js";
import { findComunaAt } from "../services/geocode.js";
import { createDemoLayers, updateAccidents, updateFloodZones, updateFatalitiesMarkers } from "./demo-layers.js";
import { fetchAccidentsGeoJSON, fetchFloodZones, fetchFatalities } from "../services/api.js";
export { updateAccidents };
import { createMedellinLayers, renderComunasList } from "./medellin-layers.js";

export async function loadComunasData() {
  const url = CONFIG.dataUrl + '?t=' + Date.now(); // Cache buster
  const res = await fetch(url);
  if (!res.ok) throw new Error("No se pudo cargar medellin-comunas.json");
  return res.json();
}

export async function loadAccidentsData() {
  try {
    const data = await fetchAccidentsGeoJSON();
    if (data.type === "FeatureCollection" && Array.isArray(data.features)) {
      updateAccidents(data.features);
    } else if (Array.isArray(data)) {
      updateAccidents(data);
    }
  } catch (err) {
    console.warn("[map] No se pudieron cargar datos de accidentes:", err);
  }
}

export async function loadFloodZonesData(map) {
  try {
    const data = await fetchFloodZones();
    if (Array.isArray(data)) {
      updateFloodZones(map, data);
    }
  } catch (err) {
    console.warn("[map] No se pudieron cargar zonas de inundación:", err);
  }
}

export async function loadFatalitiesData() {
  try {
    const data = await fetchFatalities();
    if (data.type === "FeatureCollection" && Array.isArray(data.features)) {
      updateFatalitiesMarkers(data);
      const meta = data._meta || {};
      const el = document.getElementById("statFatalities");
      if (el) {
        const ts = meta.fetched_at ? new Date(meta.fetched_at).toLocaleTimeString() : "";
        el.textContent = `${meta.total_fatalities ?? 0} muertes · ${ts}`;
      }
      if (meta.request_count === 1 && meta.source === "fallback") {
        console.log("[fatalities] API en tiempo real activa — datos con deriba por solicitud");
      }
    }
  } catch (err) {
    console.warn("[map] No se pudieron cargar datos de fallecidos:", err);
  }
}

let fatalitiesPollTimer = null;

export function startFatalitiesPolling() {
  stopFatalitiesPolling();
  loadFatalitiesData();
  fatalitiesPollTimer = setInterval(loadFatalitiesData, 30000);
}

export function stopFatalitiesPolling() {
  if (fatalitiesPollTimer) {
    clearInterval(fatalitiesPollTimer);
    fatalitiesPollTimer = null;
  }
}

const SATELLITE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const SATELLITE_ATTR = '&copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community';

export function initMap() {
  const map = L.map("map", {
    center: CONFIG.map.defaultCenter,
    zoom: CONFIG.map.defaultZoom,
    zoomControl: true,
    attributionControl: true,
    fadeAnimation: false,
    markerZoomAnimation: false,
    zoomAnimation: false,
  });

  const osmLayer = L.tileLayer(CONFIG.map.tileUrl, {
    attribution: CONFIG.map.tileAttribution,
    subdomains: "abc",
    maxZoom: CONFIG.map.maxZoom,
  }).addTo(map);

  const satelliteLayer = L.tileLayer(SATELLITE_URL, {
    attribution: SATELLITE_ATTR,
    maxZoom: CONFIG.map.maxZoom,
  });

  AppState._osmLayer = osmLayer;
  AppState._satelliteLayer = satelliteLayer;

  if (window.matchMedia("(max-width: 768px)").matches) {
    map.zoomControl.setPosition("bottomright");
  }

  AppState.map = map;
  return map;
}

export function toggleSatellite(enabled) {
  const map = AppState.map;
  if (!map) return;
  if (enabled) {
    map.removeLayer(AppState._osmLayer);
    map.addLayer(AppState._satelliteLayer);
  } else {
    map.removeLayer(AppState._satelliteLayer);
    map.addLayer(AppState._osmLayer);
  }
}

export async function setupMapLayers() {
  const map = AppState.map;
  const data = await loadComunasData();
  AppState.comunasData = data;

  const city = createMedellinLayers(map, data);
  createDemoLayers(map);
  bindLayerToggles(map);

  renderComunasList(document.getElementById("comunasList"), data, map);

  loadAccidentsData();
  loadFloodZonesData(map);
  startFatalitiesPolling();

  let statsTimer;
  map.on("moveend zoomend", () => {
    clearTimeout(statsTimer);
    statsTimer = setTimeout(() => updateMapStats(city.isInsideCity), 100);
  });

  return city;
}

function bindLayerToggles(map) {
  document.querySelectorAll(".toggle[data-layer]").forEach((input) => {
    const key = input.dataset.layer;

    if (key === "satellite-base") {
      input.addEventListener("change", () => {
        toggleSatellite(input.checked);
      });
      return;
    }

    const layer = AppState.layerGroups[key];
    if (input.checked && layer && !map.hasLayer(layer)) {
      map.addLayer(layer);
    }
    input.addEventListener("change", () => {
      const lg = AppState.layerGroups[key];
      if (!lg) return;
      if (input.checked) map.addLayer(lg);
      else map.removeLayer(lg);
      document.dispatchEvent(new CustomEvent("tppmaps:layers-changed"));
    });
  });
}

export function updateMapStats(isInsideCity) {
  const map = AppState.map;
  if (!map) return;

  const c = map.getCenter();
  const el = (id) => document.getElementById(id);

  if (el("statCoords")) el("statCoords").textContent = `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`;
  if (el("statZoom")) el("statZoom").textContent = map.getZoom().toFixed(1);

  const comuna = findComunaAt(c.lat, c.lng);
  if (el("statComuna")) {
    el("statComuna").textContent = comuna
      ? `Comuna ${comuna.number} — ${comuna.name}`
      : "Fuera de comuna (área metro)";
  }

  if (el("statLocation")) {
    el("statLocation").textContent =
      isInsideCity(c.lat, c.lng) || comuna
        ? "Medellín, Antioquia, Colombia"
        : "Área metropolitana, Antioquia";
  }

  const active = document.querySelectorAll(".toggle[data-layer]:checked").length;
  if (el("statLayers")) el("statLayers").textContent = String(active);
  const frac = el("layerFraction");
  const total = document.querySelectorAll(".toggle[data-layer]").length;
  if (frac) frac.textContent = `${active}/${total}`;
}
