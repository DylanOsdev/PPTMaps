/**
 * tppmaps — Punto de entrada (ES modules)
 */
import { initMap, setupMapLayers, updateMapStats } from "./map/map-service.js";
import { pingHealth, fetchTelemetry } from "./services/api.js";
import { initAlerts } from "./ui/alerts.js";
import { initClock, initTicker, initThroughput } from "./ui/clock.js";
import { initLayersPanel } from "./ui/layers-panel.js";
import { initResponsive } from "./ui/responsive.js";
import { initSearch } from "./ui/search.js";

async function boot() {
  try {
    initMap();
    const city = await setupMapLayers();
    updateMapStats(city.isInsideCity);

    initSearch();
    initLayersPanel();
    initResponsive();
    initAlerts();
    initClock();
    initTicker();
    initThroughput();

    document.addEventListener("tppmaps:layers-changed", () => {
      updateMapStats(city.isInsideCity);
    });

    document.getElementById("btnSupport")?.addEventListener("click", () => {
      window.open("https://github.com", "_blank", "noopener");
    });

    try {
      const ok = await pingHealth();
      const status = document.getElementById("systemStatus");
      if (status) {
        status.textContent = ok ? "SISTEMA: CONECTADO" : "SISTEMA: DEMO";
        status.classList.toggle("status-ok", ok);
      }
    } catch {
      const status = document.getElementById("systemStatus");
      if (status) {
        status.textContent = "SISTEMA: DEMO (API offline)";
        status.classList.remove("status-ok");
      }
    }

    try {
      await fetchTelemetry();
    } catch {
      /* demo sin backend */
    }
  } catch (err) {
    console.error("[tppmaps]", err);
    alert("Error al cargar el mapa. Verifica que assets/data/medellin-comunas.json exista.");
  }
}

document.addEventListener("DOMContentLoaded", boot);
