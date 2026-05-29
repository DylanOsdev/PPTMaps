import { AppState } from "../nucleo/estado.js";
import { escapeHtml } from "../nucleo/utilidades.js";
import { construirIndice, geocodificar } from "../servicios/geocodificador.js";
import { obtenerRuta } from "../servicios/api.js";
import { toast } from "./panel-herramientas.js";

let indice = null;

export function initBusqueda() {
  if (AppState.datosComunas) indice = construirIndice(AppState.datosComunas);

  const escanear = async () => {
    const q =
      document.getElementById("geoQuery")?.value ||
      document.getElementById("cmdSearch")?.value ||
      "";
    if (!q.trim()) return;

    const map = AppState.mapa;
    const coords = geocodificar(q, indice);

    if (coords) {
      map.flyTo(coords, 14, { duration: 1 });
      L.popup()
        .setLatLng(coords)
        .setContent(`<strong>Localizado</strong><br>${escapeHtml(q)}`)
        .openOn(map);
      toast(`Ubicación: ${q}`, "ok");
      return;
    }

    try {
      const data = await obtenerRuta(q);
      const c = data.coordenadas || data.coordinates;
      if (c?.length) {
        const linea = L.polyline(c, { color: "#4ade80", weight: 5 }).addTo(map);
        map.fitBounds(linea.getBounds(), { padding: [40, 40] });
        toast(`Ruta calculada hacia ${q}`, "ok");
      }
    } catch {
      toast("No encontrado. Prueba: Bello, Itagüí, Sabaneta, Envigado, Comuna 10…", "error");
    }
  };

  document.addEventListener("tppmaps:escanear", escanear);
  document.getElementById("btnScan")?.addEventListener("click", escanear);
  document.getElementById("geoQuery")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") escanear();
  });
  document.getElementById("cmdSearch")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") escanear();
  });
}

export function actualizarIndiceBusqueda() {
  if (AppState.datosComunas) indice = construirIndice(AppState.datosComunas);
}
