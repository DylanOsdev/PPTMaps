import { COLORES_COMUNA } from "../configuracion/constantes.js";
import { AppState } from "../nucleo/estado.js";
import { escapeHtml, hexagonoAlrededor, puntoEnPoligono } from "../nucleo/utilidades.js";

const COLORES_MUNICIPIO = [
  "#f472b6", "#a78bfa", "#2dd4bf", "#fb7185", "#fcd34d",
  "#4ade80", "#38bdf8", "#f97316", "#c084fc",
];

function crearPanel(mapa, nombre, z) {
  if (!mapa.getPane(nombre)) {
    mapa.createPane(nombre);
    mapa.getPane(nombre).style.zIndex = String(z);
  }
  return nombre;
}

function obtenerRegion(datos) {
  return datos.region || datos.city;
}

function crearPoligonoZona(mapa, zona, indice, tipo, pane) {
  const esMunicipio = tipo === "municipio";
  const coords = hexagonoAlrededor(zona.center, zona.radius || (esMunicipio ? 0.02 : 0.012));
  zona._polygon = coords;
  const color = esMunicipio
    ? COLORES_MUNICIPIO[indice % COLORES_MUNICIPIO.length]
    : COLORES_COMUNA[indice % COLORES_COMUNA.length];

  const poly = L.polygon(coords, {
    pane,
    className: `zona-polygon zona-${zona.slug} ${tipo}`,
    color,
    weight: esMunicipio ? 2.5 : 2,
    opacity: 0.9,
    fillColor: color,
    fillOpacity: esMunicipio ? 0.2 : 0.15,
    dashArray: esMunicipio ? "6, 4" : undefined,
  });

  poly.on("mouseover", function () {
    this.setStyle({ fillOpacity: esMunicipio ? 0.38 : 0.35, weight: 3 });
    resaltarZonaUI(zona, tipo);
  });
  poly.on("mouseout", function () {
    this.setStyle({
      fillOpacity: esMunicipio ? 0.2 : 0.15,
      weight: esMunicipio ? 2.5 : 2,
    });
  });
  poly.on("click", () => {
    mapa.flyTo(zona.center, esMunicipio ? 13 : 14, { duration: 0.8 });
    const titulo = esMunicipio
      ? `<strong>${escapeHtml(zona.name)}</strong><br>Municipio — Valle de Aburrá`
      : `<strong>Comuna ${zona.number}</strong><br>${escapeHtml(zona.name)}`;
    L.popup().setLatLng(zona.center).setContent(titulo).openOn(mapa);
    resaltarZonaUI(zona, tipo);
  });

  const etiqueta = esMunicipio
    ? escapeHtml(zona.name).toUpperCase()
    : `C${zona.number} ${escapeHtml(zona.name)}`;

  const label = L.marker(zona.center, {
    pane,
    interactive: false,
    icon: L.divIcon({
      className: "comuna-label-wrap",
      html: `<span class="comuna-label ${esMunicipio ? "municipio-label" : ""}" style="border-color:${color}88;color:${color}">${etiqueta}</span>`,
      iconSize: [esMunicipio ? 100 : 120, 20],
      iconAnchor: [esMunicipio ? 50 : 60, 10],
    }),
  });

  return { poly, label };
}

export function crearCapasMedellin(mapa, datos) {
  const region = obtenerRegion(datos);
  const contornoValle = region.outline;
  const contornoMedellin = region.medellinOutline;
  const centro = region.center;

  const pValle = crearPanel(mapa, "medellinPane", 350);
  const pZonas = crearPanel(mapa, "comunasPane", 360);

  const brilloValle = L.polygon(contornoValle, {
    pane: pValle,
    className: "medellin-area-glow",
    color: "#67e8f9",
    weight: 10,
    opacity: 0.4,
    fillOpacity: 0,
  });

  const rellenoValle = L.polygon(contornoValle, {
    pane: pValle,
    className: "medellin-area-fill",
    color: "#fbbf24",
    weight: 3,
    opacity: 0.95,
    fillColor: "#38bdf8",
    fillOpacity: 0.08,
    dashArray: "12, 6",
  });

  const capasInteriores = [brilloValle, rellenoValle];

  if (contornoMedellin) {
    capasInteriores.push(
      L.polygon(contornoMedellin, {
        pane: pValle,
        className: "medellin-inner-outline",
        color: "#4ade80",
        weight: 2,
        opacity: 0.7,
        fillColor: "#4ade80",
        fillOpacity: 0.04,
        dashArray: "4, 8",
      })
    );
  }

  capasInteriores.push(
    L.marker(centro, {
      pane: pValle,
      interactive: false,
      icon: L.divIcon({
        className: "medellin-label-wrap",
        html: '<div class="medellin-city-label">VALLE DE ABURRÁ</div>',
        iconSize: [220, 36],
        iconAnchor: [110, 18],
      }),
    })
  );

  const polComunas = [];
  const etqComunas = [];
  const polMun = [];
  const etqMun = [];

  (datos.municipios || []).forEach((mun, i) => {
    const { poly, label } = crearPoligonoZona(mapa, mun, i, "municipio", pZonas);
    polMun.push(poly);
    etqMun.push(label);
  });

  (datos.comunas || []).forEach((comuna, i) => {
    const { poly, label } = crearPoligonoZona(mapa, comuna, i, "comuna", pZonas);
    polComunas.push(poly);
    etqComunas.push(label);
  });

  const grupoValle = L.layerGroup(capasInteriores);
  const grupoComunas = L.layerGroup([...polComunas, ...etqComunas]);
  const grupoMunicipios = L.layerGroup([...polMun, ...etqMun]);

  AppState.capas["medellin-city"] = grupoValle;
  AppState.capas["medellin-comunas"] = grupoComunas;
  AppState.capas["valle-municipios"] = grupoMunicipios;

  grupoValle.addTo(mapa);
  grupoComunas.addTo(mapa);
  grupoMunicipios.addTo(mapa);

  mapa.fitBounds(rellenoValle.getBounds(), { padding: [50, 50], maxZoom: 12 });

  return {
    contorno: contornoValle,
    dentroCiudad: (lat, lng) => puntoEnPoligono(lat, lng, contornoValle),
  };
}

function resaltarZonaUI(zona, tipo) {
  AppState.comunaActiva = zona;
  AppState.zonaActivaTipo = tipo;
  const el = document.getElementById("statComuna");
  if (!el) return;
  if (tipo === "municipio") {
    el.textContent = `Municipio ${zona.name} — Valle de Aburrá`;
  } else {
    el.textContent = `Comuna ${zona.number} — ${zona.name}`;
  }
  document.querySelectorAll(".comuna-list-item, .municipio-list-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.slug === zona.slug);
  });
}

function enlazarLista(contenedor, items, mapa, tipo) {
  if (!contenedor) return;
  const esMunicipio = tipo === "municipio";
  contenedor.innerHTML = items
    .map((z) => {
      const badge = esMunicipio
        ? `<span class="comuna-num municipio-badge">M</span>`
        : `<span class="comuna-num">C${z.number}</span>`;
      return `<li><button type="button" class="${esMunicipio ? "municipio" : "comuna"}-list-item" data-slug="${z.slug}" data-tipo="${tipo}">
        ${badge}<span class="comuna-name">${escapeHtml(z.name)}</span></button></li>`;
    })
    .join("");

  contenedor.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const z = items.find((x) => x.slug === btn.dataset.slug);
      if (z) {
        mapa.flyTo(z.center, esMunicipio ? 13 : 14);
        resaltarZonaUI(z, tipo);
      }
    });
  });
}

export function renderListaComunas(contenedorComunas, contenedorMunicipios, datos, mapa) {
  enlazarLista(contenedorComunas, datos.comunas || [], mapa, "comuna");
  enlazarLista(contenedorMunicipios, datos.municipios || [], mapa, "municipio");
}
