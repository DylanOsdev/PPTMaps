import { escapeHtml } from "../nucleo/utilidades.js";
import { AppState } from "../nucleo/estado.js";

export const ALERTAS_DEMO = [
  { id: 1, type: "siata", time: "13:38", source: "SIATA Medellín", text: "Deprimidos despejados en zona Centro–La 80." },
  { id: 2, type: "traffic", time: "13:35", source: "Predicción IA", text: "Lluvia fuerte en 45 min. Salir por la 80." },
  { id: 3, type: "report", time: "13:32", source: "Reporte ciudadano", text: "Colisión leve Av. Regional." },
];

export function setAlertFilter(filtro) {
  AppState.filtroAlertas = filtro;
  document.querySelectorAll(".alert-tabs .tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.filter === filtro);
  });
  renderAlerts();
}

export function addAlertsFromApi(lista) {
  lista.forEach((a, i) => {
    ALERTAS_DEMO.unshift({
      id: `api-${Date.now()}-${i}`,
      type: a.tipo || a.type || "siata",
      time: a.hora || a.time || "--:--",
      source: a.fuente || a.source || "API",
      text: a.texto || a.text || "",
    });
  });
  if (ALERTAS_DEMO.length > 20) ALERTAS_DEMO.length = 20;
  renderAlerts();
}

export function renderAlerts() {
  const feed = document.getElementById("alertsFeed");
  if (!feed) return;

  const filtro = AppState.filtroAlertas;
  const lista =
    filtro === "all"
      ? ALERTAS_DEMO
      : ALERTAS_DEMO.filter((a) => {
          if (filtro === "siata") return a.type === "siata";
          if (filtro === "reports") return a.type === "report";
          return a.type === "traffic";
        });

  feed.innerHTML = lista
    .map((a) => {
      const cls = a.type === "siata" ? "siata" : a.type === "report" ? "report" : "traffic";
      const icon = a.type === "siata" ? "🌧" : a.type === "report" ? "⚠" : "📊";
      return `<li class="alert-card"><div class="alert-icon ${cls}">${icon}</div><div>
        <p class="alert-meta"><strong>${a.time}</strong> · ${escapeHtml(a.source)}</p>
        <p class="alert-text">${escapeHtml(a.text)}</p></div></li>`;
    })
    .join("");

  const n = String(ALERTAS_DEMO.length);
  const c = document.getElementById("alertCount");
  const s = document.getElementById("statAlerts");
  if (c) c.textContent = n;
  if (s) s.textContent = n;
}

export function initAlertas() {
  document.querySelectorAll(".alert-tabs .tab").forEach((tab) => {
    tab.addEventListener("click", () => setAlertFilter(tab.dataset.filter || "all"));
  });
  renderAlerts();
}
