import { AppState } from "../core/state.js";

export function createDemoLayers(map) {
  const groups = AppState.layerGroups;

  const safeRoute = L.polyline(
    [
      [6.251, -75.59],
      [6.248, -75.585],
      [6.245, -75.578],
      [6.242, -75.572],
      [6.238, -75.568],
    ],
    { color: "#4ade80", weight: 5, opacity: 0.9, className: "marker-safe-route" }
  );

  const blocked = L.marker([6.246, -75.576], {
    icon: L.divIcon({
      className: "",
      html: '<div class="marker-blocked">BLOQUEADO</div>',
      iconSize: [80, 24],
      iconAnchor: [40, 12],
    }),
  });

  const destination = L.marker([6.233, -75.565], {
    icon: L.divIcon({
      className: "",
      html: '<div class="marker-dest">Belén</div>',
      iconSize: [50, 24],
      iconAnchor: [25, 12],
    }),
  });

  const accidents = L.layerGroup([
    L.circleMarker([6.255, -75.595], {
      radius: 8,
      color: "#f87171",
      fillColor: "#ef4444",
      fillOpacity: 0.5,
    }),
    L.circleMarker([6.24, -75.588], {
      radius: 6,
      color: "#f87171",
      fillColor: "#ef4444",
      fillOpacity: 0.4,
    }),
  ]);

  const floods = L.polygon(
    [
      [6.252, -75.582],
      [6.25, -75.575],
      [6.246, -75.577],
      [6.248, -75.584],
    ],
    {
      color: "#38bdf8",
      fillColor: "#0ea5e9",
      fillOpacity: 0.25,
      weight: 1,
    }
  );

  const telemetry = L.layerGroup();
  for (let i = 0; i < 12; i++) {
    telemetry.addLayer(
      L.circleMarker([6.23 + Math.random() * 0.04, -75.6 + Math.random() * 0.05], {
        radius: 3,
        color: "#4ade80",
        fillColor: "#22c55e",
        fillOpacity: 0.8,
      })
    );
  }

  groups["safe-route"] = safeRoute;
  groups["blocked-roads"] = blocked;
  groups["accident-clusters"] = accidents;
  groups["flood-zones"] = floods;
  groups["telemetry-gps"] = telemetry;
  groups["reports-collision"] = accidents;
  groups["telemetry-predict"] = L.layerGroup();
  groups["rain-risk"] = L.layerGroup();
  groups["weather-alerts"] = L.layerGroup();
  groups["reports-flood"] = L.layerGroup([floods]);
  groups["reports-obstacle"] = L.layerGroup([blocked]);

  destination.addTo(map);
}
