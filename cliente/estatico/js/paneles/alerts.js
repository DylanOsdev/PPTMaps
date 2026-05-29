import { escapeHtml } from "../core/utils.js";
import { AppState } from "../core/state.js";

export const MOCK_ALERTS = [
  { id: 1, type: "siata", time: "13:38", source: "SIATA Medellín", text: "Deprimidos despejados en zona Centro–La 80." },
  { id: 2, type: "traffic", time: "13:35", source: "Predicción IA", text: "Lluvia fuerte en 45 min. Salir por la 80 — evitar Bulerías." },
  { id: 3, type: "report", time: "13:32", source: "Reporte ciudadano", text: "Colisión leve Av. Regional sentido sur." },
  { id: 4, type: "siata", time: "13:28", source: "MEData", text: "Río en sector Belén — monitoreo activo." },
  { id: 5, type: "traffic", time: "13:25", source: "Telemetría", text: "Congestión en Poblado: 847 conductores < 15 km/h." },
  { id: 6, type: "report", time: "13:20", source: "Comuna 7 Robledo", text: "Obstáculo en vía — obra sin señalización." },
  { id: 7, type: "siata", time: "13:15", source: "SIATA", text: "16 comunas monitoreadas — sin alerta crítica." },
];

export function renderAlerts() {
  const feed = document.getElementById("alertsFeed");
  if (!feed) return;

  const filtered =
    AppState.alertFilter === "all"
      ? MOCK_ALERTS
      : MOCK_ALERTS.filter((a) => {
          if (AppState.alertFilter === "siata") return a.type === "siata";
          if (AppState.alertFilter === "reports") return a.type === "report";
          return a.type === "traffic";
        });

  feed.innerHTML = filtered
    .map((a) => {
      const iconClass = a.type === "siata" ? "siata" : a.type === "report" ? "report" : "traffic";
      const icon = a.type === "siata" ? "🌧" : a.type === "report" ? "⚠" : "📊";
      return `
      <li class="alert-card">
        <div class="alert-icon ${iconClass}">${icon}</div>
        <div>
          <p class="alert-meta"><strong>${a.time}</strong> · ${escapeHtml(a.source)}</p>
          <p class="alert-text">${escapeHtml(a.text)}</p>
        </div>
      </li>`;
    })
    .join("");

  const count = String(MOCK_ALERTS.length);
  const alertCount = document.getElementById("alertCount");
  const statAlerts = document.getElementById("statAlerts");
  if (alertCount) alertCount.textContent = count;
  if (statAlerts) statAlerts.textContent = count;
}

export function initAlerts() {
  document.querySelectorAll(".alert-tabs .tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".alert-tabs .tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      AppState.alertFilter = tab.dataset.filter || "all";
      renderAlerts();
    });
  });

  renderAlerts();

  setInterval(() => {
    const types = ["siata", "traffic", "report"];
    MOCK_ALERTS.unshift({
      id: Date.now(),
      type: types[Math.floor(Math.random() * types.length)],
      time: new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }),
      source: "tppmaps",
      text: "Actualización en tiempo real — demo.",
    });
    if (MOCK_ALERTS.length > 12) MOCK_ALERTS.pop();
    renderAlerts();
    document.dispatchEvent(new CustomEvent("tppmaps:layers-changed"));
  }, 30000);
}
