/** Estado global de la aplicación */
export const AppState = {
  mapa: null,
  map: null, // alias Leaflet
  capas: {},
  layerGroups: {}, // alias
  datosComunas: null,
  inicioSesion: Date.now(),
  filtroAlertas: "all",
  alertFilter: "all",
  comunaActiva: null,
  capaRutaApi: null,
};

Object.defineProperty(AppState, "map", {
  get() {
    return this.mapa;
  },
  set(v) {
    this.mapa = v;
  },
});

Object.defineProperty(AppState, "layerGroups", {
  get() {
    return this.capas;
  },
  set(v) {
    this.capas = v;
  },
});

Object.defineProperty(AppState, "alertFilter", {
  get() {
    return this.filtroAlertas;
  },
  set(v) {
    this.filtroAlertas = v;
  },
});

Object.defineProperty(AppState, "comunasData", {
  get() {
    return this.datosComunas;
  },
  set(v) {
    this.datosComunas = v;
  },
});
