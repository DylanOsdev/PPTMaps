import { AppState } from "../core/state.js";

const STORAGE_KEY = "tppmaps_layer_state";

const LAYER_GROUPS = {
  comunas:   ["medellin-city", "medellin-comunas", "metro-municipios", "satellite-base"],
  telemetry: ["telemetry-predict", "accident-clusters", "accident-zones", "fatalities-layer"],
  "air-quality": ["air-quality-stations"],
  climate:   ["flood-zones", "rain-risk", "weather-alerts"],
  reports:   ["reports-collision", "reports-flood"],
  risk:      ["accident-risk"],
  historical: ["historical-accidents"],
};

function saveLayerState() {
  const state = {};
  document.querySelectorAll(".toggle[data-layer]").forEach(t => {
    state[t.dataset.layer] = t.checked;
  });
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

export function applySavedLayerState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Capas activadas por defecto en primera carga
      const defaultLayers = ["medellin-city", "medellin-comunas", "metro-municipios"];
      document.querySelectorAll(".toggle[data-layer]").forEach(t => {
        if (defaultLayers.includes(t.dataset.layer)) {
          t.checked = true;
        }
      });
      return;
    }
    const state = JSON.parse(raw);
    document.querySelectorAll(".toggle[data-layer]").forEach(t => {
      if (typeof state[t.dataset.layer] === "boolean") {
        t.checked = state[t.dataset.layer];
      }
    });
  } catch {}
}

export function updateGroupCounts() {
  Object.entries(LAYER_GROUPS).forEach(([group, layers]) => {
    const el = document.getElementById(`count-${group}`);
    if (!el) return;
    const active = layers.filter(key => {
      const t = document.querySelector(`.toggle[data-layer="${key}"]`);
      return t && t.checked;
    }).length;
    el.textContent = `${active}/${layers.length}`;
  });
}

export function initLayersPanel() {
  document.querySelectorAll(".toggle[data-layer]").forEach(t => {
    t.addEventListener("change", () => {
      saveLayerState();
      updateGroupCounts();
    });
  });

  updateGroupCounts();

  // Presets
  const PRESETS = {
    btnPresetAll: Object.values(LAYER_GROUPS).flat(),
    btnPresetNavigation: [
      "medellin-city", "medellin-comunas",
      "accident-clusters",
      "flood-zones",
    ],
    btnPresetWeather: [
      "medellin-city", "medellin-comunas",
      "flood-zones", "rain-risk", "weather-alerts",
    ],
    btnPresetMinimal: [
      "medellin-city", "medellin-comunas",
    ],
  };

  Object.entries(PRESETS).forEach(([id, layers]) => {
    document.getElementById(id)?.addEventListener("click", () => {
      document.querySelectorAll(".toggle[data-layer]").forEach(t => {
        t.checked = layers.includes(t.dataset.layer);
        t.dispatchEvent(new Event("change"));
      });
    });
  });

  // Per-group toggle all
  document.querySelectorAll(".btn-toggle-all").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const group = btn.dataset.group;
      const keys = LAYER_GROUPS[group];
      if (!keys) return;
      const allOn = keys.every(k => {
        const t = document.querySelector(`.toggle[data-layer="${k}"]`);
        return t && t.checked;
      });
      keys.forEach(k => {
        const t = document.querySelector(`.toggle[data-layer="${k}"]`);
        if (t) {
          t.checked = !allOn;
          t.dispatchEvent(new Event("change"));
        }
      });
    });
  });

  // Keyboard shortcuts 1-9
  document.addEventListener("keydown", e => {
    if (e.target.matches("input, textarea, [contenteditable]")) return;
    const n = Number(e.key);
    if (!Number.isInteger(n) || n < 1 || n > 9) return;
    const toggles = document.querySelectorAll(".toggle[data-layer]");
    if (n - 1 >= toggles.length) return;
    e.preventDefault();
    const t = toggles[n - 1];
    t.checked = !t.checked;
    t.dispatchEvent(new Event("change"));
  });

  // Search filter
  const searchInput = document.getElementById("layerSearch");
  if (searchInput) {
    searchInput.addEventListener("input", e => {
      const q = e.target.value.toLowerCase().trim();
      document.querySelectorAll(".layer-group").forEach(g => {
        let hasVisible = false;
        g.querySelectorAll(".layer-row").forEach(row => {
          const match = !q || row.textContent.toLowerCase().includes(q);
          row.style.display = match ? "" : "none";
          if (match) hasVisible = true;
        });
        const section = g.querySelector(".comunas-section");
        if (section) section.style.display = q ? "none" : "";
        g.style.display = (!q || hasVisible) ? "" : "none";
      });
    });
  }

  // Satellite opacity slider
  const satOpacity = document.getElementById("satOpacity");
  if (satOpacity) {
    const updateSatOpacity = () => {
      const v = parseFloat(satOpacity.value);
      const sat = AppState._satelliteLayer;
      if (sat?.setOpacity) sat.setOpacity(v);
    };
    satOpacity.addEventListener("input", updateSatOpacity);
    updateSatOpacity();
  }

  // Show/hide satellite opacity row
  const toggleSatOpacityRow = () => {
    const row = document.getElementById("satOpacityRow");
    if (!row) return;
    const satToggle = document.querySelector('.toggle[data-layer="satellite-base"]');
    row.style.display = satToggle?.checked ? "" : "none";
  };
  toggleSatOpacityRow();
  document.querySelectorAll('.toggle[data-layer="satellite-base"]').forEach(t => {
    t.addEventListener("change", toggleSatOpacityRow);
  });

  // Day/night toggle
  document.getElementById("toggleDayNight")?.addEventListener("change", e => {
    document.body.style.filter = e.target.checked ? "none" : "brightness(0.85) contrast(1.05)";
  });
}
