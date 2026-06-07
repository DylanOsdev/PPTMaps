import { escapeHtml } from "../core/utils.js";
import { AppState } from "../core/state.js";
import { onWsEvent, fetchAlerts } from "../services/api.js";
import { getAlertIconSvg } from "../icons/react-icons.js";

let alerts = [];
let alertTimer = null;

function renderAlerts() {
  const feed = document.getElementById("alertsFeed");
  if (!feed) return;

  const filtered =
    AppState.alertFilter === "all"
      ? alerts
      : alerts.filter((a) => {
          if (AppState.alertFilter === "siata") return a.type === "siata" || a.category === "siata";
          if (AppState.alertFilter === "reports") return a.type === "report" || a.type === "citizen";
          return a.type === "traffic" || a.category === "traffic";
        });

  feed.innerHTML = filtered
    .map((a) => {
      const iconClass = a.type === "siata" ? "siata" : a.type === "report" || a.type === "citizen" ? "report" : "traffic";
      const icon = getAlertIconSvg(a.type);
      const time = a.time || a.created_at || a.timestamp || "";
      const source = a.source || a.origin || "Sistema";
      const text = a.text || a.message || a.description || "";
      return `
      <li class="alert-card">
        <div class="alert-icon ${iconClass}">${icon}</div>
        <div>
          <p class="alert-meta"><strong>${time}</strong> · ${escapeHtml(source)}</p>
          <p class="alert-text">${escapeHtml(text)}</p>
        </div>
      </li>`;
    })
    .join("");

  const count = String(alerts.length);
  const alertCount = document.getElementById("alertCount");
  const statAlerts = document.getElementById("statAlerts");
  if (alertCount) alertCount.textContent = count;
  if (statAlerts) statAlerts.textContent = count;
}

function addAlert(alert) {
  const exists = alerts.some(a => a.id === alert.id || (a.text === alert.text && a.time === alert.time));
  if (exists) return;

  alerts.unshift({
    id: alert.id || Date.now(),
    type: alert.type || alert.category || "traffic",
    time: alert.time || alert.created_at || new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }),
    source: alert.source || alert.origin || "Sistema",
    text: alert.text || alert.message || alert.description || "Evento",
  });

  if (alerts.length > 50) alerts.pop();
  renderAlerts();
}

function replaceAlerts(newAlerts) {
  if (!Array.isArray(newAlerts) || newAlerts.length === 0) return;
  alerts = newAlerts.map(a => ({
    id: a.id || Date.now() + Math.random(),
    type: a.type || a.category || "traffic",
    time: a.time || a.created_at || a.timestamp || new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }),
    source: a.source || a.origin || "Sistema",
    text: a.text || a.message || a.description || "Evento",
  }));
  renderAlerts();
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

  // Carga inicial desde REST API
  function loadFromRest() {
    fetchAlerts()
      .then((data) => {
        if (Array.isArray(data)) replaceAlerts(data);
      })
      .catch(() => {
        console.warn("[alerts] API no disponible, esperando WebSocket...");
      });
  }
  loadFromRest();

  // Polling REST cada 30s como respaldo cuando WS no está disponible.
  AppState._alertPollTimer = setInterval(loadFromRest, 30000);

  // Listen for WebSocket real-time alerts
  AppState._alertsWsHandler = (data) => {
    if (Array.isArray(data)) {
      if (data.length === 1 && alerts.length > 0) {
        // Broadcast de una alerta individual (ej: overspeed desde Celery).
        addAlert(data[0]);
      } else {
        replaceAlerts(data);
      }
    } else {
      addAlert(data);
    }
  };
  onWsEvent("alerts", AppState._alertsWsHandler);
}

// Export solo para testing - NO usar en producción
export function __resetForTesting() {
  alerts = [];
  renderAlerts();
}
