/**
 * tppmaps — entrada principal
 */
import { iniciarMapa, configurarCapasMapa, actualizarEstadisticas } from "./mapa/servicio-mapa.js";
import { verificarSalud, obtenerEstadoCompleto } from "./servicios/api.js";
import { initAlertas } from "./paneles/alertas.js";
import { initReloj, initTicker, initThroughput } from "./paneles/reloj.js";
import { initPanelCapas } from "./paneles/panel-capas.js";
import { initPanelHerramientas } from "./paneles/panel-herramientas.js";
import { initResponsive } from "./paneles/responsive.js";
import { initBusqueda, actualizarIndiceBusqueda } from "./paneles/busqueda.js";

async function arranque() {
  try {
    iniciarMapa();
    const ciudad = await configurarCapasMapa();
    actualizarEstadisticas(ciudad.dentroCiudad);
    actualizarIndiceBusqueda();

    initBusqueda();
    initPanelCapas();
    initPanelHerramientas();
    initResponsive();
    initAlertas();
    initReloj();
    initTicker();
    initThroughput();

    document.addEventListener("tppmaps:capas-cambiadas", () => {
      actualizarEstadisticas(ciudad.dentroCiudad);
    });

    await actualizarConexionServidor();
  } catch (err) {
    console.error("[tppmaps]", err);
    alert("Error al cargar. Sirve la carpeta cliente/ con el servidor FastAPI o python -m http.server.");
  }
}

async function actualizarConexionServidor() {
  const status = document.getElementById("systemStatus");
  const siata = document.getElementById("siataStatus");
  try {
    const salud = await verificarSalud();
    if (salud && status) {
      status.textContent = "SISTEMA: CONECTADO";
      status.classList.add("status-ok");
    }
    try {
      const estado = await obtenerEstadoCompleto();
      if (siata) siata.textContent = estado.base_datos === "conectada" ? "SYNC" : "DEMO";
      if (status && estado.base_datos === "conectada") {
        status.textContent = "SISTEMA: BD CONECTADA";
      }
    } catch {
      if (siata) siata.textContent = "API";
    }
  } catch {
    if (status) {
      status.textContent = "SISTEMA: SIN SERVIDOR";
      status.classList.remove("status-ok");
    }
    if (siata) siata.textContent = "OFF";
  }
}

document.addEventListener("DOMContentLoaded", arranque);
