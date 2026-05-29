import { AppState } from "../nucleo/estado.js";
import { normalizarTexto } from "../nucleo/utilidades.js";

export function construirIndice(datos) {
  const indice = {
    "valle de aburra": datos.region?.center || datos.city?.center,
    "area metropolitana": datos.region?.center || datos.city?.center,
  };

  (datos.municipios || []).forEach((m) => {
    indice[m.slug] = m.center;
    indice[normalizarTexto(m.name)] = m.center;
    (m.aliases || []).forEach((a) => {
      indice[normalizarTexto(a)] = m.center;
    });
  });

  (datos.comunas || []).forEach((c) => {
    indice[c.slug] = c.center;
    indice[normalizarTexto(c.name)] = c.center;
    if (c.number) indice[`comuna ${c.number}`] = c.center;
    (c.aliases || []).forEach((a) => {
      indice[normalizarTexto(a)] = c.center;
    });
  });

  return indice;
}

export function geocodificar(consulta, indice) {
  const norm = normalizarTexto(consulta.trim());
  if (!norm || !indice) return null;

  const claves = Object.keys(indice).sort((a, b) => b.length - a.length);
  for (const clave of claves) {
    if (norm.includes(clave) || clave.includes(norm)) return indice[clave];
  }

  const m = consulta.match(/(-?\d+\.?\d*)\s*[,;\s]\s*(-?\d+\.?\d*)/);
  if (m) return [parseFloat(m[1]), parseFloat(m[2])];
  return null;
}

function puntoEnZona(lat, lng, zona) {
  const poly = zona._polygon;
  if (!poly) return false;
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i];
    const [yj, xj] = poly[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      dentro = !dentro;
    }
  }
  return dentro;
}

export function comunaEnPunto(lat, lng) {
  const datos = AppState.datosComunas;
  if (!datos) return null;

  for (const c of datos.comunas || []) {
    if (puntoEnZona(lat, lng, c)) return { ...c, tipo: "comuna" };
  }
  for (const m of datos.municipios || []) {
    if (puntoEnZona(lat, lng, m)) return { ...m, tipo: "municipio" };
  }
  return null;
}
