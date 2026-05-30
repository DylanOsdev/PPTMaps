import { CONFIG } from "../config/constants.js";

const PANEL = {
  left: "panelLayers",
  right: "panelTools",
};

function isMobile() {
  return window.innerWidth <= CONFIG.breakpoints.mobile;
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

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!isMobile()) closeAllPanels();
    }, 100);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllPanels();
  });

  document.getElementById("fabLayers")?.addEventListener("click", () => togglePanel("left"));
  document.getElementById("fabAlerts")?.addEventListener("click", () => togglePanel("right"));

  document.querySelectorAll(".tool-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tool-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const cmd = btn.dataset.cmd;
      if (cmd === "ruta") window.location.href = "pages/mobile/navegar.html";
      else if (cmd === "reporte") window.location.href = "pages/mobile/reportar.html";
      else if (cmd === "mobile") window.location.href = "pages/mobile/inicio.html";
      else if (cmd === "layers") {
        if (isMobile()) togglePanel("left");
        else document.getElementById(PANEL.left)?.scrollIntoView({ behavior: "smooth" });
      }
    });
  });
}
