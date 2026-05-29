import { CONFIG } from "../config/constants.js";
import { AppState } from "../core/state.js";
import { findComunaAt } from "../services/geocode.js";
import { createDemoLayers } from "./demo-layers.js";
import { createMedellinLayers, renderComunasList } from "./medellin-layers.js";

export async function loadComunasData() {
  const res = await fetch(CONFIG.dataUrl);
  if (!res.ok) throw new Error("No se pudo cargar medellin-comunas.json");
  return res.json();
}

export function initMap() {
  const map = L.map("map", {
    center: CONFIG.map.defaultCenter,
    zoom: CONFIG.map.defaultZoom,
    zoomControl: true,
    attributionControl: true,
  });

  L.tileLayer(CONFIG.map.tileUrl, {
    attribution: CONFIG.map.tileAttribution,
    subdomains: "abcd",
    maxZoom: CONFIG.map.maxZoom,
  }).addTo(map);

  if (window.matchMedia("(max-width: 768px)").matches) {
    map.zoomControl.setPosition("bottomright");
  }

  AppState.map = map;
  return map;
}

export async function setupMapLayers() {
  const map = AppState.map;
  const data = await loadComunasData();
  AppState.comunasData = data;

  const city = createMedellinLayers(map, data);
  createDemoLayers(map);
  bindLayerToggles(map);

  renderComunasList(document.getElementById("comunasList"), data, map);

  map.on("moveend zoomend", () => updateMapStats(city.isInsideCity));

  return city;
}

function bindLayerToggles(map) {
  document.querySelectorAll(".toggle[data-layer]").forEach((input) => {
    const key = input.dataset.layer;
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
