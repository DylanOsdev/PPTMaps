import { CONFIG } from "../configuracion/constantes.js";
import { AppState } from "../nucleo/estado.js";
import { comunaEnPunto } from "../servicios/geocodificador.js";
import { crearCapasDemo } from "./capas-demo.js";
import { crearCapasMedellin, renderListaComunas } from "./capas-medellin.js";

export async function cargarDatosComunas() {
  const res = await fetch(CONFIG.urlDatos);
  if (!res.ok) throw new Error("No se pudo cargar medellin-comunas.json");
  return res.json();
}

export function iniciarMapa() {
  const mapa = L.map("map", {
    center: CONFIG.mapa.centro,
    zoom: CONFIG.mapa.zoom,
    zoomControl: true,
    attributionControl: true,
  });

  L.tileLayer(CONFIG.mapa.capaOscura, {
    attribution: CONFIG.mapa.atribucion,
    subdomains: "abcd",
    maxZoom: CONFIG.mapa.zoomMax,
  }).addTo(mapa);

  if (window.matchMedia("(max-width: 768px)").matches) {
    mapa.zoomControl.setPosition("bottomright");
  }

  AppState.mapa = mapa;
  return mapa;
}

export async function configurarCapasMapa() {
  const mapa = AppState.mapa;
  const datos = await cargarDatosComunas();
  AppState.datosComunas = datos;

  const ciudad = crearCapasMedellin(mapa, datos);
  crearCapasDemo(mapa);
  enlazarTogglesCapas(mapa);
  renderListaComunas(
    document.getElementById("comunasList"),
    document.getElementById("municipiosList"),
    datos,
    mapa
  );

  mapa.on("moveend zoomend", () => actualizarEstadisticas(ciudad.dentroCiudad));

  return ciudad;
}

function enlazarTogglesCapas(mapa) {
  document.querySelectorAll(".toggle[data-layer]").forEach((input) => {
    const id = input.dataset.layer;
    const capa = AppState.capas[id];
    if (input.checked && capa && !mapa.hasLayer(capa)) mapa.addLayer(capa);
    input.addEventListener("change", () => {
      const c = AppState.capas[id];
      if (!c) return;
      if (input.checked) mapa.addLayer(c);
      else mapa.removeLayer(c);
      document.dispatchEvent(new CustomEvent("tppmaps:capas-cambiadas"));
    });
  });
}

export function actualizarEstadisticas(dentroCiudad) {
  const mapa = AppState.mapa;
  if (!mapa) return;

  const c = mapa.getCenter();
  const el = (id) => document.getElementById(id);

  if (el("statCoords")) el("statCoords").textContent = `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}`;
  if (el("statZoom")) el("statZoom").textContent = mapa.getZoom().toFixed(1);

  const zona = comunaEnPunto(c.lat, c.lng);
  if (el("statComuna")) {
    if (!zona) el("statComuna").textContent = "Fuera del Valle de Aburrá";
    else if (zona.tipo === "municipio") el("statComuna").textContent = `Municipio ${zona.name}`;
    else el("statComuna").textContent = `Comuna ${zona.number} — ${zona.name}`;
  }

  if (el("statLocation")) {
    el("statLocation").textContent = dentroCiudad(c.lat, c.lng)
      ? "Valle de Aburrá, Antioquia, Colombia"
      : "Fuera del área metropolitana";
  }

  const activas = document.querySelectorAll(".toggle[data-layer]:checked").length;
  if (el("statLayers")) el("statLayers").textContent = String(activas);
  const frac = el("layerFraction");
  const total = document.querySelectorAll(".toggle[data-layer]").length;
  if (frac) frac.textContent = `${activas}/${total}`;
}
