import { CONFIG } from "../config/constants.js";

const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/telemetry?channel=global`;

let ws = null;
let wsReconnectTimer = null;
let wsReconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const wsListeners = {};

export function onWsEvent(type, fn) {
  if (!wsListeners[type]) wsListeners[type] = [];
  wsListeners[type].push(fn);
}

export function offWsEvent(type, fn) {
  if (!wsListeners[type]) return;
  wsListeners[type] = wsListeners[type].filter(f => f !== fn);
}

function dispatchWsEvent(type, data) {
  (wsListeners[type] || []).forEach(fn => fn(data));
  document.dispatchEvent(new CustomEvent(`ws:${type}`, { detail: data }));
}

export function connectWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  try {
    ws = new WebSocket(WS_URL);
  } catch (err) {
    console.warn("[ws] No se pudo crear WebSocket:", err);
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    console.log("[ws] Conectado a telemetría en tiempo real");
    wsReconnectAttempts = 0;
    dispatchWsEvent("connected", null);
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === "telemetry") {
        dispatchWsEvent("telemetry", msg.data || msg);
      } else if (msg.type === "alerts") {
        dispatchWsEvent("alerts", msg.data || msg);
      } else if (msg.type === "accident") {
        dispatchWsEvent("accidents", msg.data || msg);
      } else if (msg.type === "new_report") {
        dispatchWsEvent("new_report", msg.data || msg);
      } else {
        dispatchWsEvent("message", msg);
      }
    } catch {
      // Non-JSON message
    }
  };

  ws.onclose = () => {
    console.log("[ws] Desconectado, reconectando...");
    ws = null;
    dispatchWsEvent("disconnected", null);
    scheduleReconnect();
  };

  ws.onerror = () => {
    ws?.close();
  };
}

function scheduleReconnect() {
  if (wsReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.warn("[ws] Máximo de reintentos alcanzado");
    return;
  }
  const delay = Math.min(1000 * Math.pow(2, wsReconnectAttempts), 30000);
  wsReconnectAttempts++;
  clearTimeout(wsReconnectTimer);
  wsReconnectTimer = setTimeout(connectWebSocket, delay);
}

export function clearAllWsListeners() {
  Object.keys(wsListeners).forEach(key => delete wsListeners[key]);
}

export function disconnectWebSocket() {
  clearTimeout(wsReconnectTimer);
  wsReconnectAttempts = MAX_RECONNECT_ATTEMPTS;
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
  clearAllWsListeners();
}

export async function pingHealth() {
  try {
    const res = await fetch("/health", { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.status === "ok";
  } catch {
    return false;
  }
}

export async function fetchTelemetry() {
  const res = await fetch(`${CONFIG.apiBase}/public/telemetry/latest`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("Error fetching telemetry");
  return res.json();
}

export async function fetchAlerts() {
  const res = await fetch(`${CONFIG.apiBase}/public/alerts?is_resolved=false&limit=20`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("Error fetching alerts");
  return res.json();
}

export async function fetchAccidentsGeoJSON() {
  const res = await fetch(`${CONFIG.apiBase}/public/accidents/geojson`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("Error fetching accidents");
  return res.json();
}

export async function fetchAccidentZones() {
  const res = await fetch(`${CONFIG.apiBase}/public/accident-zones`, {  // Sin limit = default 630
    signal: AbortSignal.timeout(15000),  // Más timeout para 630 zonas
  });
  if (!res.ok) throw new Error("Error fetching accident zones");
  return res.json();
}

export async function fetchFatalities() {
  const res = await fetch(`${CONFIG.apiBase}/public/fatalities`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("Error fetching fatalities");
  return res.json();
}

export async function fetchFloodZones() {
  const res = await fetch(`${CONFIG.apiBase}/public/flood-zones`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("Error fetching flood zones");
  return res.json();
}

export async function fetchRoute(destination, origin = null) {
  // destination y origin en formato "lat,lng"
  const [destLat, destLng] = destination.split(",").map(v => parseFloat(v.trim()));
  const [origLat, origLng] = origin ? origin.split(",").map(v => parseFloat(v.trim())) : [6.2518, -75.5636]; // Default: Centro Medellín
  
  const url = `${CONFIG.apiBase}/public/routes?origin_lat=${origLat}&origin_lng=${origLng}&dest_lat=${destLat}&dest_lng=${destLng}&_cb=${Date.now()}`;
  
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error("Route fetch failed");
  return res.json();
}

export async function fetchWeather() {
  const res = await fetch(`${CONFIG.apiBase}/public/weather`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("Error fetching weather");
  return res.json();
}

export async function fetchRainRisk() {
  const res = await fetch(`${CONFIG.apiBase}/public/rain-risk`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("Error fetching rain risk");
  return res.json();
}

export async function fetchAirQualityStations() {
  const res = await fetch(`${CONFIG.apiBase}/public/air-quality/current`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("Error fetching air quality");
  return res.json();
}

export async function fetchPublicReports() {
  const res = await fetch(`${CONFIG.apiBase}/public/reports`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("Error fetching public reports");
  return res.json();
}

export async function fetchTrafficPredictions() {
  const res = await fetch(`${CONFIG.apiBase}/public/traffic/predictions`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("Error fetching traffic predictions");
  return res.json();
}

export async function createPublicReport({ report_type, description, latitude, longitude }) {
  const res = await fetch(`${CONFIG.apiBase}/public/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ report_type, description, latitude, longitude }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error("Error creating report");
  return res.json();
}
