/** Estado compartido de la aplicación (patrón store ligero) */
export const AppState = {
  map: null,
  layerGroups: {},
  comunasData: null,
  startTime: Date.now(),
  alertFilter: "all",
  activeComuna: null,
};
