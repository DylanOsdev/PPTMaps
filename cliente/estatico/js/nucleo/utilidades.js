export function escapeHtml(texto) {
  const el = document.createElement("div");
  el.textContent = texto;
  return el.innerHTML;
}

export function rellenar(n) {
  return String(n).padStart(2, "0");
}

export function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function puntoEnPoligono(lat, lng, poligono) {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [yi, xi] = poligono[i];
    const [yj, xj] = poligono[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      dentro = !dentro;
    }
  }
  return dentro;
}

export function hexagonoAlrededor(centro, radio = 0.012) {
  const [lat, lng] = centro;
  const puntos = [];
  for (let i = 0; i < 6; i++) {
    const angulo = (i * 60 * Math.PI) / 180;
    puntos.push([lat + radio * Math.cos(angulo), lng + radio * Math.sin(angulo)]);
  }
  return puntos;
}
