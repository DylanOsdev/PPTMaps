import { CONFIG } from "../config/constants.js";

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
  
  const url = `${CONFIG.apiBase}/public/routes/safe-weather?origin_lat=${origLat}&origin_lng=${origLng}&dest_lat=${destLat}&dest_lng=${destLng}&_cb=${Date.now()}`;
  
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

export async function fetchAccidentRiskHeatmap() {
  const res = await fetch(`${CONFIG.apiBase}/public/accident-risk/heatmap`, {
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error("Error fetching accident risk heatmap");
  return res.json();
}

export async function fetchHistoricalAccidentHeatmap({ severities, year, comuna } = {}) {
  const params = new URLSearchParams();
  if (severities && severities.length > 0) {
    severities.forEach(s => params.append("severities", s));
  }
  if (year) params.set("year", String(year));
  if (comuna) params.set("comuna", comuna);
  const res = await fetch(`${CONFIG.apiBase}/public/accidents/historical/heatmap?${params}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error("Error fetching historical accident heatmap");
  return res.json();
}

export async function fetchHistoricalPrecipComunas(year) {
  const params = year ? `?year=${year}` : "";
  const res = await fetch(`${CONFIG.apiBase}/public/weather/historical/comunas${params}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("Error fetching precipitation by comuna");
  return res.json();
}

export async function fetchHistoricalPrecipitationGrid(year) {
  const params = year ? `?year=${year}` : "";
  const res = await fetch(`${CONFIG.apiBase}/public/weather/historical/grid${params}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("Error fetching historical precipitation grid");
  return res.json();
}

export async function fetchHistoricalAccidents({ limit = 5000, severities, year, comuna } = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (severities && severities.length > 0) {
    severities.forEach(s => params.append("severities", s));
  }
  if (year) params.set("year", String(year));
  if (comuna) params.set("comuna", comuna);
  const res = await fetch(`${CONFIG.apiBase}/public/accidents/historical?${params}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error("Error fetching historical accidents");
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
