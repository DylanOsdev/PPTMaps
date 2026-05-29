import { CONFIG } from "../configuracion/constantes.js";

function url(ruta) {
  const base = CONFIG.apiBase.replace(/\/$/, "");
  return `${base}${ruta.startsWith("/") ? ruta : `/${ruta}`}`;
}

export async function verificarSalud() {
  const res = await fetch("/health");
  return res.ok ? res.json() : null;
}

export async function obtenerEstadoCompleto() {
  const res = await fetch(url("/estado"));
  if (!res.ok) throw new Error("estado no disponible");
  return res.json();
}

export async function obtenerTelemetria() {
  const res = await fetch(url("/telemetria/mapa-predictivo"));
  if (!res.ok) throw new Error("telemetría no disponible");
  return res.json();
}

export async function obtenerClusters() {
  const res = await fetch(url("/telemetria/clusters"));
  if (!res.ok) throw new Error("clusters no disponibles");
  return res.json();
}

export async function obtenerRuta(destino) {
  const res = await fetch(url(`/rutas?dest=${encodeURIComponent(destino)}`));
  if (!res.ok) throw new Error("ruta no disponible");
  return res.json();
}

export async function obtenerAlertasSiata() {
  const res = await fetch(url("/siata/alertas"));
  if (!res.ok) throw new Error("SIATA no disponible");
  return res.json();
}

export async function obtenerInundaciones() {
  const res = await fetch(url("/siata/inundaciones"));
  if (!res.ok) throw new Error("inundaciones no disponibles");
  return res.json();
}

export async function obtenerPrediccionLluvia() {
  const res = await fetch(url("/prediccion/lluvia"));
  if (!res.ok) throw new Error("predicción no disponible");
  return res.json();
}

export async function enviarReporte(datos) {
  const res = await fetch(url("/reportes"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  });
  if (!res.ok) throw new Error("error al reportar");
  return res.json();
}
