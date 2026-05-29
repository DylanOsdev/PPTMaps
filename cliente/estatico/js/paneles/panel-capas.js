/**
 * Apartado: CAPAS DE DATOS (panel izquierdo)
 */
import { AppState } from "../nucleo/estado.js";

const PRESET_MOVIMED = new Set([
  "medellin-city",
  "medellin-comunas",
  "valle-municipios",
  "telemetry-gps",
  "accident-clusters",
  "flood-zones",
  "safe-route",
  "blocked-roads",
]);

const PRESET_MINIMO = new Set(["medellin-city", "valle-municipios"]);

const PRESET_CLIMA = new Set([
  "medellin-city",
  "flood-zones",
  "rain-risk",
  "weather-alerts",
]);

let presetIndex = 0;
const PRESETS = [PRESET_MOVIMED, PRESET_MINIMO, PRESET_CLIMA];
const PRESET_NOMBRES = ["MoviMed", "Mínimo", "Clima/SIATA"];

export function aplicarPreset(capas) {
  document.querySelectorAll(".toggle[data-layer]").forEach((input) => {
    const on = capas.has(input.dataset.layer);
    input.checked = on;
    input.dispatchEvent(new Event("change"));
  });
}

export function initPanelCapas() {
  document.getElementById("btnLayerPreset")?.addEventListener("click", () => {
    presetIndex = (presetIndex + 1) % PRESETS.length;
    aplicarPreset(PRESETS[presetIndex]);
    const btn = document.getElementById("btnLayerPreset");
    if (btn) {
      btn.textContent = PRESET_NOMBRES[presetIndex].slice(0, 3).toUpperCase();
      btn.title = `Preset: ${PRESET_NOMBRES[presetIndex]}`;
    }
  });

  document.getElementById("toggleDayNight")?.addEventListener("change", (e) => {
    document.body.style.filter = e.target.checked
      ? "none"
      : "brightness(0.88) contrast(1.05)";
  });

  document.querySelectorAll(".layer-group summary").forEach((summary) => {
    summary.addEventListener("click", () => {
      AppState.grupoCapasActivo = summary.parentElement?.querySelector("span")?.textContent;
    });
  });
}
