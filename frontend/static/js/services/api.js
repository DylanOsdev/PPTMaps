import { CONFIG } from "../config/constants.js";

export async function pingHealth() {
  const res = await fetch(`${CONFIG.backendUrl}/health`, { method: "GET" });
  return res.ok;
}

export async function fetchTelemetry() {
  const res = await fetch(`${CONFIG.apiBase}/telemetry/latest`);
  if (!res.ok) throw new Error("telemetry unavailable");
  return res.json();
}

export async function fetchRoute(destination) {
  const res = await fetch(
    `${CONFIG.apiBase}/routes?dest=${encodeURIComponent(destination)}`
  );
  if (!res.ok) throw new Error("routes unavailable");
  return res.json();
}
