export function escapeHtml(text) {
  const el = document.createElement("div");
  el.textContent = text;
  return el.innerHTML;
}

export function pad(n) {
  return String(n).padStart(2, "0");
}

export function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Ray-casting: punto dentro de polígono [[lat,lng], ...] */
export function pointInPolygon(lat, lng, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Polígono hexagonal aproximado alrededor de un centro */
export function hexagonAround(center, radiusDeg = 0.012) {
  const [lat, lng] = center;
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * 60 * Math.PI) / 180;
    points.push([lat + radiusDeg * Math.cos(angle), lng + radiusDeg * Math.sin(angle)]);
  }
  return points;
}

export function $(id) {
  return document.getElementById(id);
}
