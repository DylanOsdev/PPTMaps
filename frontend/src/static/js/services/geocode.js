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

function parseColombianAddress(query) {
  let text = query.toLowerCase().trim();
  
  // Extraer el barrio si viene después de un guión o la palabra barrio
  let barrio = "";
  const parts = text.split(/(?:- | barrio | sector )/);
  if (parts.length > 1) {
    barrio = parts.slice(1).join(" ").trim();
    text = parts[0].trim(); // Deja solo la dirección
  }
  
  // Expresión regular para capturar el formato colombiano:
  // Ej: calle 105 a # 39 a - 38
  const regex = /(calle|carrera|cra|cll|circular|transversal|diagonal|av|avenida)\s+(\d+\s*[a-z]?)\s*#?\s*(\d+\s*[a-z]?)\s*(?:[-a]|al)?\s*(\d+)/i;
  const match = text.match(regex);
  if (match) {
    let tipoVia = match[1];
    if (tipoVia === 'cra') tipoVia = 'carrera';
    if (tipoVia === 'cll') tipoVia = 'calle';
    if (tipoVia === 'av') tipoVia = 'avenida';
    
    // Convertir "105 a" en "105A"
    const via = match[2].replace(/\s+/g, '').toUpperCase();
    const cruce = match[3].replace(/\s+/g, '').toUpperCase();
    const placa = match[4];
    
    // Retorna el formato ideal para OpenStreetMap: "Calle 105A 39A-38"
    let result = `${tipoVia.charAt(0).toUpperCase() + tipoVia.slice(1)} ${via} ${cruce}-${placa}`;
    if (barrio) {
      result += `, ${barrio}`;
    }
    return result;
  }
  return null;
}

export async function geocodeQuery(query, index) {
  const norm = normalizeText(query.trim());
  if (!norm) return null;

  // 1. Check local aliases and comunas first
  for (const [key, coords] of Object.entries(index)) {
    if (norm.includes(key) || key.includes(norm)) return coords;
  }

  // 2. Check direct coordinate input
  const coordMatch = query.match(/(-?\d+\.?\d*)\s*[,;\s]\s*(-?\d+\.?\d*)/);
  if (coordMatch) return [parseFloat(coordMatch[1]), parseFloat(coordMatch[2])];

  // 3. Fallback to OpenStreetMap Nominatim for exact addresses
  const cleanQuery = query.replace(/#/g, '').replace(/No\.?/gi, '').trim();
  const parsedAddress = parseColombianAddress(query);
  
  const queriesToTry = [];
  if (parsedAddress) queriesToTry.push(`${parsedAddress}, Medellín`);
  queriesToTry.push(`${cleanQuery}, Medellín`);
  queriesToTry.push(`${query.split('#')[0].trim()}, Medellín`);

  for (const q of queriesToTry) {
    try {
      const searchUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
      const res = await fetch(searchUrl, {
        headers: {
          "User-Agent": "PPTMaps/1.0",
          "Accept-Language": "es"
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        }
      }
    } catch (err) {
      console.warn("Geocoding failed for", q, err);
    }
  }

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
