import { AppState } from "../nucleo/estado.js";

export function crearCapasDemo(mapa) {
  const g = AppState.capas;

  g["safe-route"] = L.polyline(
    [[6.251, -75.59], [6.248, -75.585], [6.245, -75.578], [6.238, -75.568]],
    { color: "#4ade80", weight: 5, opacity: 0.9 }
  );

  g["blocked-roads"] = L.marker([6.246, -75.576], {
    icon: L.divIcon({
      className: "",
      html: '<div class="marker-blocked">BLOQUEADO</div>',
      iconSize: [80, 24],
      iconAnchor: [40, 12],
    }),
  });

  const accidentes = L.layerGroup([
    L.circleMarker([6.255, -75.595], { radius: 8, color: "#f87171", fillColor: "#ef4444", fillOpacity: 0.5 }),
    L.circleMarker([6.24, -75.588], { radius: 6, color: "#f87171", fillColor: "#ef4444", fillOpacity: 0.4 }),
  ]);

  const inundaciones = L.polygon(
    [[6.252, -75.582], [6.25, -75.575], [6.246, -75.577], [6.248, -75.584]],
    { color: "#38bdf8", fillColor: "#0ea5e9", fillOpacity: 0.25, weight: 1 }
  );

  const telemetria = L.layerGroup();
  for (let i = 0; i < 12; i++) {
    telemetria.addLayer(
      L.circleMarker([6.23 + Math.random() * 0.04, -75.6 + Math.random() * 0.05], {
        radius: 3,
        color: "#4ade80",
        fillColor: "#22c55e",
        fillOpacity: 0.8,
      })
    );
  }

  g["accident-clusters"] = accidentes;
  g["flood-zones"] = inundaciones;
  g["telemetry-gps"] = telemetria;
  g["reports-collision"] = accidentes;
  g["telemetry-predict"] = L.layerGroup();
  g["rain-risk"] = L.layerGroup();
  g["weather-alerts"] = L.layerGroup();
  g["reports-flood"] = L.layerGroup([inundaciones]);
  g["reports-obstacle"] = L.layerGroup([g["blocked-roads"]]);

  L.marker([6.233, -75.565], {
    icon: L.divIcon({
      className: "",
      html: '<div class="marker-dest">Belén</div>',
      iconSize: [50, 24],
      iconAnchor: [25, 12],
    }),
  }).addTo(mapa);
}
