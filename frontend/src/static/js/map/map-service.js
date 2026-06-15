import { CONFIG } from "../config/constants.js";
import { AppState } from "../core/state.js";
import { findComunaAt } from "../services/geocode.js";
import { createDemoLayers, updateAccidents, updateFloodZones, updateFatalitiesMarkers, updateWeather, updateReportsLayers, updateAccidentZones, updateAirQualityStations, updateAccidentRiskHeatmap, updateHistoricalPrecipitation, updateHistoricalPrecipComunas } from "./demo-layers.js";
import { fetchAccidentsGeoJSON, fetchFloodZones, fetchFatalities, fetchWeather, fetchRainRisk, fetchPublicReports, fetchAccidentZones, fetchAirQualityStations, fetchHistoricalAccidents, fetchHistoricalPrecipitationGrid, fetchHistoricalPrecipComunas, fetchHistoricalAccidentHeatmap } from "../services/api.js";
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

export async function loadAirQualityData() {
  try {
    const data = await fetchAirQualityStations();
    if (Array.isArray(data)) {
      updateAirQualityStations(data);
    }
    trackLayer(true);
  } catch (err) {
    console.warn("[map] No se pudieron cargar estaciones de calidad del aire:", err);
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
    preferCanvas: true,
    updateWhenZooming: false,
    updateWhenIdle: true,
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
  if (AppState.map !== map) return { isInsideCity: () => false };
  AppState.comunasData = data;

  const city = createMedellinLayers(map, data);
  createDemoLayers(map);
  bindLayerToggles(map);

  renderComunasList(document.getElementById("comunasList"), data, map);

  loadAccidentsData();
  loadAccidentZonesData();
  loadFloodZonesData(map);
  loadWeatherData();
  loadAirQualityData();
  startReportsPolling();
  startFatalitiesPolling();
  loadHistoricalAccidentsData();

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

    if (key === "accident-risk") {
      input.addEventListener("change", () => {
        const lg = AppState.layerGroups[key];
        if (!lg) return;
        if (input.checked) {
          map.addLayer(lg);
          updateAccidentRiskHeatmap(map);
        } else {
          map.removeLayer(lg);
        }
        document.dispatchEvent(new CustomEvent("tppmaps:layers-changed"));
      });
      return;
    }

    if (key === "historical-accidents") {
      input.addEventListener("change", () => {
        const lg = AppState.layerGroups[key];
        if (!lg) return;
        const filtersEl = document.getElementById("historicalFilters");
        if (input.checked) {
          map.addLayer(lg);
          initHistoricalFilters();
          if (filtersEl) filtersEl.style.display = "block";
          loadHistoricalAccidentsData();
        } else {
          map.removeLayer(lg);
          if (filtersEl) filtersEl.style.display = "none";
        }
        document.dispatchEvent(new CustomEvent("tppmaps:layers-changed"));
      });
      return;
    }

    if (key === "historical-precipitation") {
      input.addEventListener("change", () => {
        const lg = AppState.layerGroups[key];
        if (!lg) return;
        const filtersEl = document.getElementById("historicalPrecipFilters");
        if (input.checked) {
          map.addLayer(lg);
          if (filtersEl) filtersEl.style.display = "block";
          loadHistoricalPrecipitationData();
        } else {
          map.removeLayer(lg);
          if (filtersEl) filtersEl.style.display = "none";
        }
        document.dispatchEvent(new CustomEvent("tppmaps:layers-changed"));
      });
      return;
    }

    if (key === "precip-comunas") {
      input.addEventListener("change", () => {
        const lg = AppState.layerGroups[key];
        if (!lg) return;
        const filtersEl = document.getElementById("precipComunaFilters");
        if (input.checked) {
          map.addLayer(lg);
          if (filtersEl) filtersEl.style.display = "block";
          loadHistoricalPrecipComunasData();
        } else {
          map.removeLayer(lg);
          if (filtersEl) filtersEl.style.display = "none";
        }
        document.dispatchEvent(new CustomEvent("tppmaps:layers-changed"));
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

function readHistoricalFilters() {
  const sevEls = document.querySelectorAll(".historical-severity:checked");
  const severities = Array.from(sevEls).map(el => el.value);
  const yearEl = document.getElementById("historicalYear");
  const comunaEl = document.getElementById("historicalComuna");
  return {
    severities: severities.length === 0 ? [] : severities.length === 3 ? null : severities,
    year: yearEl?.value || null,
    comuna: comunaEl?.value || null,
  };
}

function refetchHistoricalData() {
  const input = document.querySelector('.toggle[data-layer="historical-accidents"]');
  if (!input?.checked) return;
  loadHistoricalAccidentsData();
}

export async function loadHistoricalPrecipComunasData() {
  const group = AppState.layerGroups["precip-comunas"];
  if (!group) return;
  group.clearLayers();

  const input = document.querySelector('.toggle[data-layer="precip-comunas"]');
  if (!input?.checked) return;

  const yearEl = document.getElementById("precipComunaYear");
  const year = yearEl?.value ? parseInt(yearEl.value, 10) : null;
  const filtersEl = document.getElementById("precipComunaFilters");
  if (filtersEl) filtersEl.style.display = "block";

  try {
    const data = await fetchHistoricalPrecipComunas(year);
    updateHistoricalPrecipComunas(data);
  } catch (e) {
    console.warn("[precip-comunas] Error cargando:", e);
  }
}

export async function loadHistoricalPrecipitationData() {
  const group = AppState.layerGroups["historical-precipitation"];
  if (!group) return;
  group.clearLayers();

  const input = document.querySelector('.toggle[data-layer="historical-precipitation"]');
  if (!input?.checked) return;

  const yearEl = document.getElementById("historicalPrecipYear");
  const selectedYear = yearEl?.value ? parseInt(yearEl.value, 10) : null;
  const filtersEl = document.getElementById("historicalPrecipFilters");
  if (filtersEl) filtersEl.style.display = "block";

  try {
    const data = await fetchHistoricalPrecipitationGrid(selectedYear);
    updateHistoricalPrecipitation(data);
  } catch (e) {
    console.warn("[historical-precipitation] Error cargando:", e);
  }
}

let _historicalHeatLayer = null;

export async function loadHistoricalAccidentsData() {
  const group = AppState.layerGroups["historical-accidents"];
  if (!group) return;
  group.clearLayers();

  const input = document.querySelector('.toggle[data-layer="historical-accidents"]');
  const filtersEl = document.getElementById("historicalFilters");
  if (input?.checked && filtersEl) {
    initHistoricalFilters();
    filtersEl.style.display = "block";
  }

  const filters = readHistoricalFilters();
  if (Array.isArray(filters.severities) && filters.severities.length === 0) {
    if (_historicalHeatLayer) {
      group.removeLayer(_historicalHeatLayer);
      _historicalHeatLayer = null;
    }
    return;
  }
  const params = {};
  if (filters.severities) params.severities = filters.severities;
  if (filters.year) params.year = parseInt(filters.year, 10);
  if (filters.comuna) params.comuna = filters.comuna;

  const isSingle = filters.severities?.length === 1;
  const sev = isSingle ? filters.severities[0] : null;
  const sevSet = filters.severities ? new Set(filters.severities) : null;
  let gradient;
  if (sev === 'MUERTO') {
    gradient = { 0.0: 'transparent', 0.05: '#450a0a', 0.2: '#991b1b', 0.4: '#dc2626', 0.7: '#ef4444', 1.0: '#f87171' };
  } else if (sev === 'HERIDO') {
    gradient = { 0.0: 'transparent', 0.05: '#431407', 0.2: '#78350f', 0.4: '#d97706', 0.7: '#f59e0b', 1.0: '#fbbf24' };
  } else if (sev === 'SOLO DAÑOS') {
    gradient = { 0.0: 'transparent', 0.05: '#052e16', 0.2: '#166534', 0.4: '#16a34a', 0.7: '#22c55e', 1.0: '#86efac' };
  } else if (sevSet?.has('MUERTO') && sevSet?.has('SOLO DAÑOS')) {
    gradient = { 0.0: 'transparent', 0.02: '#052e16', 0.1: '#166534', 0.25: '#22c55e', 0.45: '#f59e0b', 0.65: '#ef4444', 1.0: '#7f1d1d' };
  } else if (sevSet?.has('HERIDO') && sevSet?.has('SOLO DAÑOS')) {
    gradient = { 0.0: 'transparent', 0.02: '#052e16', 0.1: '#166534', 0.25: '#22c55e', 0.45: '#d97706', 0.65: '#f59e0b', 1.0: '#fbbf24' };
  } else {
    gradient = { 0.0: 'transparent', 0.05: '#431407', 0.2: '#78350f', 0.4: '#d97706', 0.6: '#f59e0b', 0.8: '#ef4444', 1.0: '#7f1d1d' };
  }

  try {
    const data = await fetchHistoricalAccidentHeatmap(params);
    if (!data?.points?.length) return;

    if (_historicalHeatLayer) {
      group.removeLayer(_historicalHeatLayer);
      _historicalHeatLayer = null;
    }
    const norm = data.normalizer || (data.max_weight || 500);
    _historicalHeatLayer = L.heatLayer(data.points, {
      radius: 18,
      blur: 12,
      maxZoom: 17,
      max: norm,
      gradient,
    });
    group.addLayer(_historicalHeatLayer);
  } catch (e) {
    console.warn("[historical-accidents] Error cargando heatmap:", e);
  }
}

let _historicalFiltersReady = false;

export async function initHistoricalFilters() {
  if (_historicalFiltersReady) return;
  _historicalFiltersReady = true;

  const yearEl = document.getElementById("historicalYear");
  const comunaEl = document.getElementById("historicalComuna");

  // Fetch comunas and dispatch to React via custom event
  try {
    const resp = await fetch("/api/v1/public/accidents/stats");
    if (resp.ok) {
      const stats = await resp.json();
      if (Array.isArray(stats.by_comuna)) {
        document.dispatchEvent(new CustomEvent("tppmaps:historical-comunas", {
          detail: stats.by_comuna,
        }));
      }
    }
  } catch (e) {
    console.warn("[historical] Error cargando filtros:", e);
  }

  document.querySelectorAll(".historical-severity").forEach(el => {
    el.addEventListener("change", refetchHistoricalData);
  });
  if (yearEl) yearEl.addEventListener("change", refetchHistoricalData);
  if (comunaEl) comunaEl.addEventListener("change", refetchHistoricalData);
}

document.addEventListener("change", (e) => {
  if (e.target?.id === "historicalPrecipYear") {
    loadHistoricalPrecipitationData();
  }
  if (e.target?.id === "precipComunaYear") {
    loadHistoricalPrecipComunasData();
  }
});
