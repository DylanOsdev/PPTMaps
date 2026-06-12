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
      map.removeLayer(lastRoutePolyline);
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
          const sa = data.safety_assessment || {};
          const score = sa.route_danger_score || 1;
          const routeColor = score >= 4 ? "#ef4444" : score >= 3 ? "#fbbf24" : "#4ade80";

          lastRoutePolyline = L.polyline(data.coordinates, { color: routeColor, weight: 5 });
          lastRoutePolyline.addTo(map);
          map.fitBounds(lastRoutePolyline.getBounds(), { padding: [40, 40] });

          const briefing = document.getElementById("safetyBriefing");
          if (briefing && data.safety_assessment) {
            const destEl = document.getElementById("briefingDest");
            const destDescEl = document.getElementById("briefingDestDesc");
            const destContainer = document.getElementById("briefingDestContainer");
            const routeEl = document.getElementById("briefingRoute");
            const routeDescEl = document.getElementById("briefingRouteDesc");
            const routeContainer = document.getElementById("briefingRouteContainer");

            const sa = data.safety_assessment;

            // Colores según score
            const destColor = sa.dest_danger_score >= 4 ? "#ef4444" : sa.dest_danger_score >= 3 ? "#fbbf24" : "#4ade80";
            const destBg = sa.dest_danger_score >= 4 ? "rgba(239, 68, 68, 0.08)" : sa.dest_danger_score >= 3 ? "rgba(251, 191, 36, 0.08)" : "rgba(74, 222, 128, 0.08)";
            const destBorder = sa.dest_danger_score >= 4 ? "rgba(239, 68, 68, 0.3)" : sa.dest_danger_score >= 3 ? "rgba(251, 191, 36, 0.3)" : "rgba(74, 222, 128, 0.3)";

            const routeColor = sa.route_danger_score >= 4 ? "#ef4444" : sa.route_danger_score >= 3 ? "#fbbf24" : "#4ade80";
            const routeBg = sa.route_danger_score >= 4 ? "rgba(239, 68, 68, 0.08)" : sa.route_danger_score >= 3 ? "rgba(251, 191, 36, 0.08)" : "rgba(74, 222, 128, 0.08)";
            const routeBorder = sa.route_danger_score >= 4 ? "rgba(239, 68, 68, 0.3)" : sa.route_danger_score >= 3 ? "rgba(251, 191, 36, 0.3)" : "rgba(74, 222, 128, 0.3)";

            destEl.textContent = sa.dest_danger_level.toUpperCase();
            destEl.style.color = destColor;
            destDescEl.textContent = sa.dest_description;
            if (destContainer) {
              destContainer.style.backgroundColor = destBg;
              destContainer.style.border = `1px solid ${destBorder}`;
            }

            routeEl.textContent = sa.route_danger_level.toUpperCase();
            routeEl.style.color = routeColor;
            routeDescEl.textContent = sa.route_description;
            if (routeContainer) {
              routeContainer.style.backgroundColor = routeBg;
              routeContainer.style.border = `1px solid ${routeBorder}`;
            }

            briefing.style.display = "block";
          }
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
