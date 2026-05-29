/**
 * Configuración — sin localhost fijo.
 * Prioridad: window.TPPMAPS_API > meta tag > JSON > ruta relativa /api/v1
 */
const metaApi = document.querySelector('meta[name="tppmaps-api"]')?.content?.trim();

export const CONFIG = {
  apiBase: window.TPPMAPS_API || metaApi || "/api/v1",
  mapa: {
    centro: [6.230, -75.565],
    zoom: 11,
    zoomMax: 19,
    capaOscura:
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    atribucion:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CARTO',
  },
  urlDatos: "recursos/datos/valle-aburra.json",
  puntosQuiebre: { tablet: 1100, movil: 768 },
};

export const COLORES_COMUNA = [
  "#67e8f9", "#4ade80", "#fbbf24", "#fb923c", "#a78bfa", "#f472b6",
  "#38bdf8", "#34d399", "#fcd34d", "#f87171", "#2dd4bf", "#818cf8",
  "#e879f9", "#22d3ee", "#86efac", "#fde047",
];
