import { AppState } from "../core/state.js";
import { pad } from "../core/utils.js";
import { onWsEvent } from "../services/api.js";

export function initClock() {
  if (AppState._clockInterval) clearInterval(AppState._clockInterval);

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
  AppState._clockInterval = setInterval(tick, 1000);
}

export function initTicker() {
  const items = [
    { cls: "up", t: "16 comunas Medellín activas" },
    { cls: "", t: "SIATA: Deprimidos OK" },
    { cls: "warn", t: "Sistema de monitoreo activo" },
    { cls: "", t: "PostGIS + Redis: CONECTADO" },
  ];
  const html = items.map((i) => `<span class="${i.cls}">${i.t}</span>`).join("");
  const track = document.getElementById("tickerTrack");
  if (track) track.innerHTML = html + html;
}

export function initThroughput() {
  const el = document.getElementById("statThroughput");
  if (!el) return;
  if (AppState._throughputInit) return;
  AppState._throughputInit = true;

  let bytesTotal = 0;
  let lastTs = performance.now();

  const update = (val) => {
    const now = performance.now();
    const elapsed = (now - lastTs) / 1000;
    bytesTotal += val * (1024 * 1024);
    if (elapsed > 0 && bytesTotal > 0) {
      const mbps = (bytesTotal / (1024 * 1024)) / elapsed;
      el.textContent = `${mbps.toFixed(2).replace(".", ",")} MB/s`;
    }
  };

  AppState._throughputHandler = (data) => {
    const items = Array.isArray(data) ? data : (data.positions || [data]);
    const size = JSON.stringify(items).length;
    const mb = size / (1024 * 1024);
    update(mb);
  };
  onWsEvent("telemetry", AppState._throughputHandler);

  AppState._throughputReset = setInterval(() => {
    bytesTotal = 0;
    lastTs = performance.now();
  }, 10000);
}
