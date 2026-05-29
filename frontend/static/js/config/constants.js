/** Configuración global de tppmaps */
export const CONFIG = {
  apiBase: window.TPPMAPS_API || "/api/v1",
  map: {
    defaultCenter: [6.2442, -75.5812],
    defaultZoom: 12,
    maxZoom: 19,
    tileUrl: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    tileAttribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CARTO',
  },
  dataUrl: "assets/data/medellin-comunas.json",
  breakpoints: {
    tablet: 1100,
    mobile: 768,
  },
};

export const COMUNA_COLORS = [
  "#67e8f9",
  "#4ade80",
  "#fbbf24",
  "#fb923c",
  "#a78bfa",
  "#f472b6",
  "#38bdf8",
  "#34d399",
  "#fcd34d",
  "#f87171",
  "#2dd4bf",
  "#818cf8",
  "#e879f9",
  "#22d3ee",
  "#86efac",
  "#fde047",
];
