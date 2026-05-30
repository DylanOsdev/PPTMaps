import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { initMap, setupMapLayers, updateMapStats, stopFatalitiesPolling } from "../static/js/map/map-service.js";
import { pingHealth, connectWebSocket, disconnectWebSocket, onWsEvent, offWsEvent } from "../static/js/services/api.js";
import { initAlerts } from "../static/js/ui/alerts.js";
import { initClock, initTicker, initThroughput } from "../static/js/ui/clock.js";
import { initLayersPanel } from "../static/js/ui/layers-panel.js";
import { initResponsive } from "../static/js/ui/responsive.js";
import { initSearch } from "../static/js/ui/search.js";
import { AppState } from "../static/js/core/state.js";

import { FaSkull, FaCity, FaSatelliteDish, FaCloudRain, FaExclamationTriangle, FaRoad, FaUser, FaMicrophone, FaBars, FaGlobeAmericas } from 'react-icons/fa';
import { TopBar } from '../components/TopBar.jsx';
import { WeatherWidget } from '../components/WeatherWidget.jsx';
import { useWeather } from '../hooks/useWeather.js';

export default function CommandCenter() {
  const mapRef = useRef(false);

  const [systemStatus, setSystemStatus] = React.useState("INICIANDO...");
  const [isSystemOk, setIsSystemOk]     = React.useState(false);
  const { weather, loading: weatherLoading, error: weatherError } = useWeather();

  useEffect(() => {
    if (mapRef.current) return;
    mapRef.current = true;

    async function boot() {
      try {
        const mapContainer = document.getElementById('map');
        if (mapContainer && mapContainer._leaflet_id) {
           if (AppState.map) {
             AppState.map.off();
             AppState.map.remove();
             AppState.map = null;
           }
        }

        initMap();
        const city = await setupMapLayers();
        updateMapStats(city.isInsideCity);

        initSearch();
        initLayersPanel();
        initResponsive();
        initAlerts();
        initClock();
        initTicker();
        initThroughput();

        const handleLayersChanged = () => {
          updateMapStats(city.isInsideCity);
        };
        document.addEventListener("tppmaps:layers-changed", handleLayersChanged);
        AppState._layersChangedHandler = handleLayersChanged;

        const btnSupport = document.getElementById("btnSupport");
        if (btnSupport) {
          btnSupport.addEventListener("click", () => {
            window.open("https://github.com", "_blank", "noopener");
          });
        }

        const ok = await pingHealth();
        setSystemStatus(ok ? "SISTEMA: CONECTADO" : "SISTEMA: OFFLINE (demo local)");
        setIsSystemOk(ok);

        if (ok) {
          connectWebSocket();
          AppState.wsConnected = true;
        }

        let healthTimer;
        const scheduleHealthCheck = async () => {
          const h = await pingHealth();
          setSystemStatus(h ? "SISTEMA: CONECTADO" : "SISTEMA: OFFLINE");
          setIsSystemOk(h);
          if (h && !AppState.wsConnected) {
            connectWebSocket();
            AppState.wsConnected = true;
          }
          healthTimer = setTimeout(scheduleHealthCheck, 30000);
        };
        healthTimer = setTimeout(scheduleHealthCheck, 30000);

        AppState.healthTimer = healthTimer;
      } catch (err) {
        console.error("[tppmaps]", err);
      }
    }

    boot();

    return () => {
      if (AppState.map) {
        AppState.map.off();
        AppState.map.remove();
        AppState.map = null;
      }
      if (AppState.healthTimer) {
        clearTimeout(AppState.healthTimer);
        AppState.healthTimer = null;
      }
      if (AppState._clockInterval) {
        clearInterval(AppState._clockInterval);
        AppState._clockInterval = null;
      }
      if (AppState._alertPollTimer) {
        clearInterval(AppState._alertPollTimer);
        AppState._alertPollTimer = null;
      }
      if (AppState._layersChangedHandler) {
        document.removeEventListener("tppmaps:layers-changed", AppState._layersChangedHandler);
        delete AppState._layersChangedHandler;
      }
      if (AppState._throughputReset) {
        clearInterval(AppState._throughputReset);
        AppState._throughputReset = null;
      }
      AppState._throughputInit = false;
      stopFatalitiesPolling();
      disconnectWebSocket();
      AppState.wsConnected = false;
      mapRef.current = false;
    };
  }, []);

  return (
    <>
      <div id="map" className="map-fullscreen" aria-label="Map of Valle del Aburrá"></div>
      <div id="panelBackdrop" className="panel-backdrop" aria-hidden="true"></div>

      <div className="app-shell">
        <TopBar systemStatus={systemStatus} isSystemOk={isSystemOk} />

          <aside className="panel panel-left" id="panelLayers" aria-label="Capas de datos">
          <div className="panel-head">
            <h2>DATA LAYERS</h2>
            <span className="layer-status-dot" id="layerStatusDot" style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:'#fbbf24',marginRight:4,boxShadow:'0 0 6px #fbbf24'}} title="Cargando capas..."></span>
            <span className="layer-fraction" id="layerFraction">6/14</span>
            <button type="button" className="btn-mini" id="btnLayerPreset" title="Preset MoviMed">SET</button>
            <button type="button" className="panel-close" aria-label="Cerrar">×</button>
          </div>
          <div className="panel-scroll" id="layersList">
            <details className="layer-group" open>
              <summary>
                <span className="layer-icon"><FaCity /></span>
                <span>VALLE DEL ABURRÁ — COMUNAS Y CORREGIMIENTOS</span>
                <span className="chevron"></span>
              </summary>
              <ul className="layer-items">
                <li>
                  <label className="layer-row">
                    <span>Contorno ciudad</span>
                    <input type="checkbox" className="toggle" data-layer="medellin-city" defaultChecked />
                  </label>
                </li>
                <li>
                  <label className="layer-row">
                    <span>Polígonos y etiquetas (Comunas/CG)</span>
                    <input type="checkbox" className="toggle" data-layer="medellin-comunas" defaultChecked />
                  </label>
                </li>
                <li>
                  <label className="layer-row">
                    <span>Municipios Área Metro (9)</span>
                    <input type="checkbox" className="toggle" data-layer="metro-municipios" defaultChecked />
                  </label>
                </li>
                <li>
                  <label className="layer-row">
                    <span><FaGlobeAmericas size={12} style={{verticalAlign:'middle',marginRight:4}} /> Satelital</span>
                    <input type="checkbox" className="toggle" data-layer="satellite-base" />
                  </label>
                </li>
              </ul>
              <div className="comunas-section">
                <h3>GO TO LOCATION</h3>
                <ul className="comunas-list" id="comunasList"></ul>
              </div>
            </details>

            <details className="layer-group" open>
              <summary>
                <span className="layer-icon"><FaSatelliteDish /></span>
                <span>TELEMETRÍA VIAL</span>
                <span className="chevron"></span>
              </summary>
              <ul className="layer-items">
                <li>
                  <label className="layer-row">
                    <span>GPS conductores (tiempo real)</span>
                    <input type="checkbox" className="toggle" data-layer="telemetry-gps" defaultChecked />
                  </label>
                </li>
                <li>
                  <label className="layer-row">
                    <span>Mapa predictivo congestión</span>
                    <input type="checkbox" className="toggle" data-layer="telemetry-predict" />
                  </label>
                </li>
                <li>
                  <label className="layer-row">
                    <span>Clusters accidentes (DBSCAN)</span>
                    <input type="checkbox" className="toggle" data-layer="accident-clusters" defaultChecked />
                  </label>
                </li>
                <li>
                  <label className="layer-row">
                    <span><FaSkull size={14} style={{verticalAlign:'middle',marginRight:6,color:'#ef4444'}} /> Muertes en tiempo real</span>
                    <input type="checkbox" className="toggle" data-layer="fatalities-layer" defaultChecked />
                  </label>
                </li>
              </ul>
            </details>

            <details className="layer-group" open>
              <summary>
                <span className="layer-icon"><FaCloudRain /></span>
                <span>SIATA Y CLIMA</span>
                <span className="chevron"></span>
              </summary>
              <ul className="layer-items">
                <li>
                  <label className="layer-row">
                    <span>Deprimidos inundables</span>
                    <input type="checkbox" className="toggle" data-layer="flood-zones" defaultChecked />
                  </label>
                </li>
                <li>
                  <label className="layer-row">
                    <span>Riesgo lluvia (2h)</span>
                    <input type="checkbox" className="toggle" data-layer="rain-risk" />
                  </label>
                </li>
                <li>
                  <label className="layer-row">
                    <span>Alertas meteorológicas</span>
                    <input type="checkbox" className="toggle" data-layer="weather-alerts" />
                  </label>
                </li>
              </ul>
            </details>

            <details className="layer-group">
              <summary>
                <span className="layer-icon"><FaExclamationTriangle /></span>
                <span>REPORTES CIUDADANOS</span>
                <span className="chevron"></span>
              </summary>
              <ul className="layer-items">
                <li>
                  <label className="layer-row">
                    <span>Colisiones activas</span>
                    <input type="checkbox" className="toggle" data-layer="reports-collision" defaultChecked />
                  </label>
                </li>
                <li>
                  <label className="layer-row">
                    <span>Inundaciones reportadas</span>
                    <input type="checkbox" className="toggle" data-layer="reports-flood" />
                  </label>
                </li>
                <li>
                  <label className="layer-row">
                    <span>Obstáculos y huecos</span>
                    <input type="checkbox" className="toggle" data-layer="reports-obstacle" />
                  </label>
                </li>
              </ul>
            </details>

            <details className="layer-group">
              <summary>
                <span className="layer-icon"><FaRoad /></span>
                <span>RUTAS SEGURAS</span>
                <span className="chevron"></span>
              </summary>
              <ul className="layer-items">
                <li>
                  <label className="layer-row">
                    <span>Ruta segura activa</span>
                    <input type="checkbox" className="toggle" data-layer="safe-route" defaultChecked />
                  </label>
                </li>
                <li>
                  <label className="layer-row">
                    <span>Vías bloqueadas</span>
                    <input type="checkbox" className="toggle" data-layer="blocked-roads" defaultChecked />
                  </label>
                </li>
              </ul>
            </details>

          </div>
        </aside>

        <aside className="panel panel-right" id="panelTools" aria-label="Herramientas y alertas">
          <div className="panel-head panel-head-tools">
            <h2>KIT Y ALERTAS</h2>
            <button type="button" className="panel-close" aria-label="Cerrar">×</button>
          </div>

          {/* Scrollable container for all right panel content */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
               className="panel-scroll">

            {/* ── Widget Clima Real ── */}
            <div style={{ borderBottom: '1px solid rgba(56, 189, 248, 0.15)' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 16px 6px',
                fontSize: '9px', letterSpacing: '0.12em', fontWeight: 600,
                color: '#67e8f9', fontFamily: '"JetBrains Mono", monospace',
                borderBottom: '1px solid rgba(56, 189, 248, 0.1)',
              }}>
                <span style={{ opacity: 0.8 }}>🌡</span>
                CLIMA — MEDELLÍN TIEMPO REAL
              </div>
              <WeatherWidget weather={weather} loading={weatherLoading} error={weatherError} />
            </div>

            <section className="tool-section">
              <div className="search-cmd">
                <span className="search-prefix">⌕</span>
                <input type="search" id="cmdSearch" placeholder="Comuna, corregimiento, barrio..." autoComplete="off" />
              </div>
              <div className="tool-grid" id="toolGrid">
                <button type="button" className="tool-btn" data-cmd="ruta" title="Ruta segura">RUTA</button>
                <button type="button" className="tool-btn" data-cmd="reporte">REPORTE</button>
                <button type="button" className="tool-btn" data-cmd="siata">SIATA</button>
                <button type="button" className="tool-btn" data-cmd="telemetria">GPS</button>
                <button type="button" className="tool-btn" data-cmd="clusters">DBSCAN</button>
                <button type="button" className="tool-btn" data-cmd="inundacion">INUNDA</button>
                <button type="button" className="tool-btn" data-cmd="prediccion">IA 2H</button>
                <button type="button" className="tool-btn" data-cmd="layers">CAPAS</button>
                <button type="button" className="tool-btn" data-cmd="mobile">MÓVIL</button>
                <button type="button" className="tool-btn btn-tool-all" data-cmd="all">TODO</button>
              </div>
              <div className="scan-box">
                <p className="scan-warn">SEARCH — MEDELLÍN Y VALLE</p>
                <div className="scan-row">
                  <input type="text" id="geoQuery" placeholder="Ej: Belén, San Cristóbal, Comuna 10" />
                  <button type="button" className="btn-scan" id="btnScan">ESCANEAR</button>
                </div>
                <span id="scanFeedback" style={{display:'none',fontSize:'9px',color:'#f87171',padding:'4px 0',letterSpacing:'0.05em'}}></span>
              </div>
            </section>

            <section className="alerts-section">
              <div className="alerts-head">
                <h2>LIVE ALERTS</h2>
                <div className="alert-tabs" role="tablist">
                  <button type="button" className="tab active" data-filter="all">ALL</button>
                  <button type="button" className="tab" data-filter="siata">SIATA</button>
                  <button type="button" className="tab" data-filter="reports">REPORTS</button>
                  <button type="button" className="tab" data-filter="traffic">TRAFFIC</button>
                </div>
              </div>
              <ul className="alerts-feed" id="alertsFeed" aria-live="polite"></ul>
            </section>

          </div>
        </aside>

        <footer className="bottom-bar">
          <div className="bottom-left">
            <button type="button" className="icon-btn" id="btnProfile" title="Perfil"><FaUser /></button>
            <button type="button" className="icon-btn" id="btnVoice" title="Voz"><FaMicrophone /></button>
            <span className="metro-label">Valle del Aburrá</span>
          </div>
          <div className="bottom-center" id="mapStats">
            {weather && (
              <>
                <span style={{ color: '#67e8f9', fontWeight: 700 }}>
                  {weather.condition.icon} {weather.temp.toFixed(1)}°C
                </span>
                <span className="sep">|</span>
                <span style={{ color: '#94a3b8', fontSize: '8px' }}>{weather.condition.label}</span>
                <span className="sep">|</span>
                <span style={{ color: weather.rain > 0 ? '#f87171' : '#4ade80', fontSize: '8px' }}>
                  {weather.rain > 0 ? `🌧 ${weather.rain.toFixed(1)}mm` : '✓ Sin lluvia'}
                </span>
                <span className="sep">|</span>
              </>
            )}
            <span><strong id="statCoords">6.2445, -75.5827</strong></span>
            <span className="sep">|</span>
            <span id="statLocation">Medellín, Antioquia</span>
            <span className="sep">|</span>
            <span>Zoom <strong id="statZoom">12</strong></span>
            <span className="sep">|</span>
            <span>Capas <strong id="statLayers">6</strong></span>
            <span className="sep">|</span>
            <span>Alertas <strong id="statAlerts">7</strong></span>
            <span className="sep">|</span>
            <span id="statFatalities">0 muertes</span>
          </div>
          <p className="stat-comuna" id="statComuna">Comuna — explore el mapa</p>
          <div className="bottom-right">
            <span className="throughput" id="statThroughput">0,00 MB/s</span>
          </div>
        </footer>

        <div className="ticker" aria-hidden="true">
          <div className="ticker-track" id="tickerTrack"></div>
        </div>
      </div>

      <div className="fab-map-actions" aria-label="Acciones rápidas">
        <button type="button" className="btn-icon" id="fabLayers" aria-label="Capas"><FaBars /></button>
        <button type="button" className="btn-icon" id="fabAlerts" aria-label="Alertas"><FaExclamationTriangle /></button>
      </div>

      <nav className="mobile-dock" aria-label="Vista móvil">
        <Link to="/" className="dock-item">Inicio</Link>
        <Link to="/navigate" className="dock-item">Navegar</Link>
        <Link to="/report" className="dock-item">Reportar</Link>
        <Link to="/map" className="dock-item dock-active">Comando</Link>
      </nav>
    </>
  );
}
