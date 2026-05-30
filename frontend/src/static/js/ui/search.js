import { AppState } from "../core/state.js";
import { escapeHtml } from "../core/utils.js";
import { buildGeocodeIndex, geocodeQuery } from "../services/geocode.js";
import { fetchRoute } from "../services/api.js";

let geocodeIndex = null;
let lastRoutePolyline = null;

export function initSearch() {
  if (!AppState.comunasData) return;
  geocodeIndex = buildGeocodeIndex(AppState.comunasData);

  const runScan = () => {
    const q =
      document.getElementById("geoQuery")?.value ||
      document.getElementById("cmdSearch")?.value ||
      "";
    if (!q.trim()) return;

    const map = AppState.map;
    const coords = geocodeQuery(q, geocodeIndex);

    if (lastRoutePolyline) {
      map.removeLayer(lastRoutePolyline);
      lastRoutePolyline = null;
    }

    if (coords) {
      map.flyTo(coords, 14, { duration: 1.2 });
      L.popup()
        .setLatLng(coords)
        .setContent(`<strong>Localizado</strong><br>${escapeHtml(q)}`)
        .openOn(map);
      return;
    }

    fetchRoute(q)
      .then((data) => {
        if (data.coordinates?.length) {
          lastRoutePolyline = L.polyline(data.coordinates, { color: "#4ade80", weight: 5 }).addTo(map);
          map.fitBounds(lastRoutePolyline.getBounds(), { padding: [40, 40] });
        }
      })
      .catch(() => {
        const fb = document.getElementById("scanFeedback");
        if (fb) {
          fb.textContent = "No encontrado. Prueba: Belén, Poblado, Laureles, Comuna 13 o lat,lng";
          fb.style.display = "block";
          setTimeout(() => { fb.style.display = "none"; }, 4000);
        }
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
