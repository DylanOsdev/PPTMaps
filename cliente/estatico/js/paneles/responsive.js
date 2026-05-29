import { CONFIG } from "../configuracion/constantes.js";

const PANEL = {
  left: "panelLayers",
  right: "panelTools",
};

function isMobile() {
  return window.innerWidth <= CONFIG.puntosQuiebre.movil;
}

function closeAllPanels() {
  document.body.classList.remove("panel-left-open", "panel-right-open");
}

function togglePanel(side) {
  const openClass = side === "left" ? "panel-left-open" : "panel-right-open";
  const closeClass = side === "left" ? "panel-right-open" : "panel-left-open";
  const willOpen = !document.body.classList.contains(openClass);
  document.body.classList.remove(closeClass);
  document.body.classList.toggle(openClass, willOpen);
}

export function initResponsive() {
  const backdrop = document.getElementById("panelBackdrop");
  const btnLeft = document.getElementById("btnToggleLayers");
  const btnRight = document.getElementById("btnToggleTools");

  btnLeft?.addEventListener("click", () => togglePanel("left"));
  btnRight?.addEventListener("click", () => togglePanel("right"));

  backdrop?.addEventListener("click", closeAllPanels);

  document.querySelectorAll(".panel .panel-close").forEach((btn) => {
    btn.addEventListener("click", closeAllPanels);
  });

  window.addEventListener("resize", () => {
    if (!isMobile()) closeAllPanels();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllPanels();
  });

  document.getElementById("fabLayers")?.addEventListener("click", () => togglePanel("left"));
  document.getElementById("fabAlerts")?.addEventListener("click", () => togglePanel("right"));
}
