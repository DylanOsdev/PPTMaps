export function initLayersPanel() {
  document.getElementById("btnLayerPreset")?.addEventListener("click", () => {
    const defaults = new Set([
      "medellin-city",
      "medellin-comunas",
      "telemetry-gps",
      "accident-clusters",
      "flood-zones",
      "safe-route",
      "blocked-roads",
    ]);
    document.querySelectorAll(".toggle[data-layer]").forEach((t) => {
      t.checked = defaults.has(t.dataset.layer);
      t.dispatchEvent(new Event("change"));
    });
  });

  document.getElementById("toggleDayNight")?.addEventListener("change", (e) => {
    document.body.style.filter = e.target.checked ? "none" : "brightness(0.85) contrast(1.05)";
  });
}
