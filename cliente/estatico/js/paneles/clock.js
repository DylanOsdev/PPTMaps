import { AppState } from "../core/state.js";
import { pad } from "../core/utils.js";

export function initClock() {
  const tick = () => {
    const now = new Date();
    const zulu = document.getElementById("zuluTime");
    if (zulu) {
      zulu.textContent = `ZULU ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}Z`;
    }
    const uptime = document.getElementById("uptime");
    if (uptime) {
      const s = Math.floor((Date.now() - AppState.startTime) / 1000);
      uptime.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
    }
  };
  tick();
  setInterval(tick, 1000);
}

export function initTicker() {
  const items = [
    { cls: "up", t: "16 comunas Medellín activas" },
    { cls: "", t: "SIATA: Deprimidos OK" },
    { cls: "warn", t: "Lluvia 45min — Bulerías" },
    { cls: "down", t: "Vía bloqueada Av. Regional" },
    { cls: "", t: "PostGIS + Redis: CONECTADO" },
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
