import { AppState } from "../core/state.js";
import { normalizeText } from "../core/utils.js";

const METRO_ALIASES = {
  envigado: [6.169, -75.578],
  itagui: [6.171, -75.614],
  bello: [6.337, -75.558],
  rionegro: [6.155, -75.374],
};

export function buildGeocodeIndex(comunasData) {
  const index = { ...METRO_ALIASES };

  comunasData.comunas.forEach((c) => {
    index[c.slug] = c.center;
    index[normalizeText(c.name)] = c.center;
    index[`comuna ${c.number}`] = c.center;
    index[`c${c.number}`] = c.center;
    (c.aliases || []).forEach((alias) => {
      index[normalizeText(alias)] = c.center;
    });
  });

  return index;
}

export function geocodeQuery(query, index) {
  const norm = normalizeText(query.trim());
  if (!norm) return null;

  for (const [key, coords] of Object.entries(index)) {
    if (norm.includes(key) || key.includes(norm)) return coords;
  }

  const coordMatch = query.match(/(-?\d+\.?\d*)\s*[,;\s]\s*(-?\d+\.?\d*)/);
  if (coordMatch) return [parseFloat(coordMatch[1]), parseFloat(coordMatch[2])];

  return null;
}

export function findComunaAt(lat, lng) {
  const data = AppState.comunasData;
  if (!data) return null;

  for (const comuna of data.comunas) {
    const poly = comuna._polygon;
    if (!poly) continue;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [yi, xi] = poly[i];
      const [yj, xj] = poly[j];
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    if (inside) return comuna;
  }
  return null;
}
