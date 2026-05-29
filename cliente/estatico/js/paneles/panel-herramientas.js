/**
 * Apartado: KIT Y ALERTAS (panel derecho)
 */
import { AppState } from "../nucleo/estado.js";
import {
  obtenerAlertasSiata,
  obtenerClusters,
  obtenerInundaciones,
  obtenerPrediccionLluvia,
  obtenerRuta,
  obtenerTelemetria,
} from "../servicios/api.js";
import { renderAlerts, setAlertFilter, addAlertsFromApi } from "./alertas.js";
import { escapeHtml } from "../nucleo/utilidades.js";

let capaClustersApi = null;

function toast(msg, tipo = "info") {
  const el = document.getElementById("toastMensaje");
  if (!el) return;
  el.textContent = msg;
  el.className = `toast toast-${tipo} toast-visible`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("toast-visible"), 4000);
}

function activarCapa(id, activo = true) {
  const input = document.querySelector(`.toggle[data-layer="${id}"]`);
  if (!input) return;
  input.checked = activo;
  input.dispatchEvent(new Event("change"));
}

function marcarBoton(cmd) {
  document.querySelectorAll(".tool-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.cmd === cmd);
  });
}

function dibujarRuta(coords) {
  const map = AppState.mapa;
  if (!map || !coords?.length) return;
  if (AppState.capaRutaApi) map.removeLayer(AppState.capaRutaApi);
  AppState.capaRutaApi = L.polyline(coords, { color: "#4ade80", weight: 6 }).addTo(map);
  map.fitBounds(AppState.capaRutaApi.getBounds(), { padding: [48, 48] });
}

function dibujarClusters(features) {
  const map = AppState.mapa;
  if (!map) return;
  if (capaClustersApi) map.removeLayer(capaClustersApi);
  capaClustersApi = L.layerGroup();
  (features || []).forEach((f) => {
    capaClustersApi.addLayer(
      L.circleMarker([f.lat, f.lng], {
        radius: 6 + (f.peso || 0.5) * 8,
        color: "#f87171",
        fillColor: "#ef4444",
        fillOpacity: 0.55,
      })
    );
  });
  capaClustersApi.addTo(map);
}

const COMANDOS = {
  async ruta() {
    marcarBoton("ruta");
    const dest =
      document.getElementById("geoQuery")?.value ||
      document.getElementById("cmdSearch")?.value ||
      "Belén";
    try {
      const data = await obtenerRuta(dest);
      dibujarRuta(data.coordenadas || data.coordinates);
      toast(`Ruta segura hacia ${data.destino || dest} — ${data.puntos_evitados ?? 3} puntos evitados`, "ok");
      activarCapa("safe-route", true);
    } catch {
      toast("API de rutas no disponible. Activa el servidor.", "error");
    }
  },

  reporte() {
    marcarBoton("reporte");
    window.location.href = "paginas/movil/reportar.html";
  },

  async siata() {
    marcarBoton("siata");
    setAlertFilter("siata");
    activarCapa("flood-zones", true);
    try {
      const data = await obtenerAlertasSiata();
      addAlertsFromApi(data.alertas || []);
      document.getElementById("siataStatus").textContent = "OK";
      toast(`SIATA: ${(data.alertas || []).length} alertas cargadas`, "ok");
    } catch {
      document.getElementById("siataStatus").textContent = "OFF";
      toast("No se pudo conectar con SIATA (servidor/BD)", "error");
    }
  },

  async telemetria() {
    marcarBoton("telemetria");
    activarCapa("telemetry-gps", true);
    try {
      const data = await obtenerTelemetria();
      toast(`GPS: ${(data.puntos || data.features || []).length} puntos en mapa`, "ok");
    } catch {
      toast("Telemetría no disponible", "error");
    }
  },

  async clusters() {
    marcarBoton("clusters");
    activarCapa("accident-clusters", true);
    try {
      const data = await obtenerClusters();
      dibujarClusters(data.clusters || data.features);
      toast(`DBSCAN: ${(data.clusters || []).length} clusters activos`, "ok");
    } catch {
      toast("Clusters no disponibles", "error");
    }
  },

  async inundacion() {
    marcarBoton("inundacion");
    activarCapa("flood-zones", true);
    activarCapa("reports-flood", true);
    try {
      const data = await obtenerInundaciones();
      toast(`Inundación: ${(data.zonas || []).length} zonas de riesgo`, "ok");
    } catch {
      toast("Datos de inundación no disponibles", "error");
    }
  },

  async prediccion() {
    marcarBoton("prediccion");
    try {
      const data = await obtenerPrediccionLluvia();
      const modal = document.getElementById("modalPrediccion");
      const body = document.getElementById("modalPrediccionTexto");
      if (modal && body) {
        body.textContent = data.mensaje || data.message || "Sin mensaje";
        modal.classList.add("open");
      } else {
        toast(data.mensaje || "Predicción IA cargada", "ok");
      }
      activarCapa("rain-risk", true);
    } catch {
      toast("Predicción IA no disponible", "error");
    }
  },

  capas() {
    marcarBoton("capas");
    document.body.classList.add("panel-left-open");
    document.body.classList.remove("panel-right-open");
  },

  layers() {
    COMANDOS.capas();
  },

  movil() {
    marcarBoton("mobile");
    window.location.href = "paginas/movil/inicio.html";
  },

  mobile() {
    COMANDOS.movil();
  },

  async todo() {
    marcarBoton("all");
    setAlertFilter("all");
    activarCapa("medellin-city", true);
    activarCapa("medellin-comunas", true);
    activarCapa("telemetry-gps", true);
    activarCapa("accident-clusters", true);
    activarCapa("flood-zones", true);
    activarCapa("safe-route", true);
    try {
      await Promise.allSettled([
        COMANDOS.siata(),
        COMANDOS.telemetria(),
        COMANDOS.clusters(),
      ]);
      toast("Modo TODO: capas y feeds activados", "ok");
    } catch {
      toast("Modo TODO parcial (revisa servidor)", "warn");
    }
  },

  all() {
    return COMANDOS.todo();
  },
};

export function initPanelHerramientas() {
  document.querySelectorAll(".tool-btn[data-cmd]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cmd = btn.dataset.cmd;
      const fn = COMANDOS[cmd];
      if (fn) fn();
    });
  });

  document.getElementById("btnScan")?.addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("tppmaps:escanear"));
  });

  document.getElementById("btnSupport")?.addEventListener("click", () => {
    document.getElementById("modalApoyo")?.classList.add("open");
  });

  document.querySelectorAll("[data-cerrar-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".modal.open").forEach((m) => m.classList.remove("open"));
    });
  });
}

export { toast };
