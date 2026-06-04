import { AppState } from "../core/state.js";
import { escapeHtml } from "../core/utils.js";
import { buildGeocodeIndex, geocodeQuery } from "../services/geocode.js";
import { fetchRoute } from "../services/api.js";

let geocodeIndex = null;
let lastRoutePolyline = null;

export function initSearch() {
  if (!AppState.comunasData) return;
  geocodeIndex = buildGeocodeIndex(AppState.comunasData);

  const runScan = async () => {
    const q =
      document.getElementById("wazeSearch")?.value ||
      document.getElementById("geoQuery")?.value ||
      document.getElementById("cmdSearch")?.value ||
      "";
    if (!q.trim()) return;

    const map = AppState.map;
    let targetCoords = await geocodeQuery(q, geocodeIndex);

    if (!targetCoords) {
      const parts = q.split(",");
      if (parts.length === 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) {
        targetCoords = [parseFloat(parts[0]), parseFloat(parts[1])];
      }
    }

    if (lastRoutePolyline) {
      const safeGroup = AppState.layerGroups["safe-route"];
      if (safeGroup) safeGroup.removeLayer(lastRoutePolyline);
      else map.removeLayer(lastRoutePolyline);
      lastRoutePolyline = null;
    }

    if (!targetCoords) {
      const fb = document.getElementById("scanFeedback");
      if (fb) {
        fb.textContent = "No encontrado. Prueba: Belén, Poblado, Laureles, Comuna 13 o lat,lng";
        fb.style.display = "block";
        setTimeout(() => { fb.style.display = "none"; }, 4000);
      }
      return;
    }

    map.flyTo(targetCoords, 14, { duration: 1.2 });
    L.popup()
      .setLatLng(targetCoords)
      .setContent(`<strong>Localizado</strong><br>${escapeHtml(q)}`)
      .openOn(map);

    let originStr = null;
    if (AppState.userLocation) {
      originStr = `${AppState.userLocation.lat},${AppState.userLocation.lng}`;
    }

    const destStr = `${targetCoords[0]},${targetCoords[1]}`;
    fetchRoute(destStr, originStr)
      .then((data) => {
        if (data.coordinates?.length) {
          lastRoutePolyline = L.polyline(data.coordinates, { color: "#4ade80", weight: 5 });
          const safeGroup = AppState.layerGroups["safe-route"];
          if (safeGroup) {
            safeGroup.addLayer(lastRoutePolyline);
            if (!map.hasLayer(safeGroup)) map.addLayer(safeGroup);
          } else {
            lastRoutePolyline.addTo(map);
          }
          map.fitBounds(lastRoutePolyline.getBounds(), { padding: [40, 40] });
        }
      })
      .catch((err) => {
        console.warn("[search] No se pudo obtener ruta", err);
      });
  };

  document.getElementById("btnScan")?.addEventListener("click", runScan);
  document.getElementById("geoQuery")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runScan();
  });
  document.getElementById("cmdSearch")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runScan();
  });
}
