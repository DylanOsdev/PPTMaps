import { AppState } from "../nucleo/estado.js";
import { rellenar } from "../nucleo/utilidades.js";

export function initReloj() {
  const tick = () => {
    const ahora = new Date();
    const z = document.getElementById("zuluTime");
    if (z) {
      z.textContent = `ZULU ${rellenar(ahora.getUTCHours())}:${rellenar(ahora.getUTCMinutes())}:${rellenar(ahora.getUTCSeconds())}Z`;
    }
    const up = document.getElementById("uptime");
    if (up) {
      const s = Math.floor((Date.now() - AppState.inicioSesion) / 1000);
      up.textContent = `${rellenar(Math.floor(s / 3600))}:${rellenar(Math.floor((s % 3600) / 60))}:${rellenar(s % 60)}`;
    }
  };
  tick();
  setInterval(tick, 1000);
}

export function initTicker() {
  const items = [
    { cls: "up", t: "Valle de Aburrá: 10 municipios + 16 comunas" },
    { cls: "", t: "Conecta servidor + PostgreSQL" },
    { cls: "warn", t: "SIATA / Redis / Celery listos en docker" },
  ];
  const html = items.map((i) => `<span class="${i.cls}">${i.t}</span>`).join("");
  const track = document.getElementById("tickerTrack");
  if (track) track.innerHTML = html + html;
}

export function initThroughput() {
  setInterval(() => {
    const el = document.getElementById("statThroughput");
    if (el) el.textContent = `${(Math.random() * 0.08).toFixed(2).replace(".", ",")} MB/s`;
  }, 3000);
}
