// Configuración global de tppmaps (translated to English)
export const CONFIG = {
  apiBase: window.TPPMAPS_API || "/api/v1",
  backendUrl: window.TPPMAPS_BACKEND || "",
  map: {
    // Central point of Valle del Aburrá region
    defaultCenter: [6.25, -75.55],
    defaultZoom: 11,
    maxZoom: 19,
    // Use standard OSM tiles for a less neon appearance
    tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    tileAttribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
  },
  dataUrl: "assets/data/medellin-comunas.json",
  accidentsUrl: "assets/data/accidents-metro.json",
  breakpoints: {
    tablet: 1100,
    mobile: 768,
  },
};

export const COMUNA_COLORS = [
  "#5e81ac",
  "#81a1c1",
  "#88c0d0",
  "#8fbcbb",
  "#a3be8c",
  "#b48ead",
  "#d08770",
  "#bf616a",
  "#ebcb8b",
  "#e5e9f0",
  "#4c566a",
  "#2e3440",
];
