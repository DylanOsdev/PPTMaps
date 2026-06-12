import { CONFIG } from "../config/constants.js";
import { AppState } from "../core/state.js";
import { findComunaAt } from "../services/geocode.js";
import { createDemoLayers, updateAccidents, updateFloodZones, updateFatalitiesMarkers, updateWeather, updateReportsLayers, updateSafeRoutes, updateAccidentZones, addAirQualityLayer } from "./demo-layers.js";
import { fetchAccidentsGeoJSON, fetchFloodZones, fetchFatalities, fetchWeather, fetchRainRisk, fetchPublicReports, fetchAccidentZones } from "../services/api.js";
export { updateAccidents };
import { createMedellinLayers, renderComunasList } from "./medellin-layers.js";

function setLayerStatus(ok) {
  const dot = document.getElementById("layerStatusDot");
  if (!dot) return;
  dot.style.background = ok ? "#4ade80" : "#f87171";
  dot.style.boxShadow = ok ? "0 0 6px #4ade80" : "0 0 6px #f87171";
  dot.title = ok ? "Capas cargadas" : "Error en algunas capas";
}

let _layersLoaded = 0;
const _LAYERS_TOTAL = 5;

function trackLayer(ok) {
  _layersLoaded++;
  if (!ok) setLayerStatus(false);
  else if (_layersLoaded >= _LAYERS_TOTAL) setLayerStatus(true);
}

export async function loadComunasData() {
  // Fuente primaria: backend PostGIS (/public/comunas). Fallback: JSON estático.
  try {
    const res = await fetch(`${CONFIG.apiBase}/public/comunas`, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      if (data?.comunas?.length) return data;
    }
  } catch (err) {
    console.warn("[map] /public/comunas no disponible, usando JSON estático:", err);
  }
  const res = await fetch(CONFIG.dataUrl);
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
    trackLayer(true);
  } catch (err) {
    console.warn("[map] No se pudieron cargar datos de accidentes:", err);
    trackLayer(false);
  }
}

export async function loadAccidentZonesData() {
  try {
    const geojson = await fetchAccidentZones();
    updateAccidentZones(geojson);
    trackLayer(true);
  } catch (err) {
    console.warn("[map] No se pudieron cargar zonas de accidentalidad:", err);
    trackLayer(false);
  }
}

export async function loadFloodZonesData(map) {
  try {
    const data = await fetchFloodZones();
    if (Array.isArray(data)) {
      updateFloodZones(map, data);
    }
    trackLayer(true);
  } catch (err) {
    console.warn("[map] No se pudieron cargar zonas de inundación:", err);
    trackLayer(false);
  }
}

export async function loadWeatherData() {
  try {
    const [rainRisk, weather] = await Promise.all([fetchRainRisk(), fetchWeather()]);
    updateWeather(rainRisk, weather);
    trackLayer(true);
  } catch (err) {
    console.warn("[map] No se pudieron cargar datos de clima:", err);
    trackLayer(false);
  }
}

export async function loadReportsData() {
  try {
    const reports = await fetchPublicReports();
    if (Array.isArray(reports)) {
      updateReportsLayers(reports);
    }
    trackLayer(true);
  } catch (err) {
    console.warn("[map] No se pudieron cargar reportes ciudadanos:", err);
    trackLayer(false);
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
    trackLayer(true);
  } catch (err) {
    console.warn("[map] No se pudieron cargar datos de fallecidos:", err);
    trackLayer(false);
  }
}

let fatalitiesPollTimer = null;

export function startFatalitiesPolling() {
  stopFatalitiesPolling();
  loadFatalitiesData();
}

export function stopFatalitiesPolling() {
  if (fatalitiesPollTimer) {
    clearInterval(fatalitiesPollTimer);
    fatalitiesPollTimer = null;
  }
}

let reportsPollTimer = null;

export function startReportsPolling() {
  stopReportsPolling();
  loadReportsData();
  reportsPollTimer = setInterval(() => {
    loadReportsData();
  }, 30000); // Recargar cada 30s
}

export function stopReportsPolling() {
  if (reportsPollTimer) {
    clearInterval(reportsPollTimer);
    reportsPollTimer = null;
  }
}

const SATELLITE_URLS = [
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
];
const SATELLITE_ATTR = '&copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community';

function createSatelliteLayer() {
  let currentIdx = 0;
  const layer = L.tileLayer(SATELLITE_URLS[0], {
    attribution: SATELLITE_ATTR,
    maxZoom: CONFIG.map.maxZoom,
  });
  layer.on("tileerror", () => {
    if (currentIdx >= SATELLITE_URLS.length - 1) return;
    currentIdx++;
    const newUrl = SATELLITE_URLS[currentIdx];
    layer.setUrl(newUrl);
    console.warn(`[satellite] Fallback a: ${newUrl.split("/")[2]}`);
  });
  return layer;
}

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

  const satelliteLayer = createSatelliteLayer();

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
  loadAccidentZonesData();
  loadFloodZonesData(map);
  loadWeatherData();
  addAirQualityLayer(map);
  startReportsPolling();
  startFatalitiesPolling();
  updateSafeRoutes(map);

  let statsTimer;
  map.on("moveend zoomend", () => {
    if (statsTimer) return;
    statsTimer = setTimeout(() => {
      statsTimer = null;
      updateMapStats(city.isInsideCity);
    }, 200);
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
