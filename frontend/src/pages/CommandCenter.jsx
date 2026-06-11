import React, { useEffect, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { initMap, setupMapLayers, updateMapStats, stopFatalitiesPolling, stopReportsPolling } from "../static/js/map/map-service.js";
import { pingHealth, connectWebSocket, disconnectWebSocket, onWsEvent, offWsEvent } from "../static/js/services/api.js";
import { initAlerts } from "../static/js/ui/alerts.js";
import { initClock, initTicker, initThroughput } from "../static/js/ui/clock.js";
import { applySavedLayerState, initLayersPanel } from "../static/js/ui/layers-panel.js";
import { initResponsive } from "../static/js/ui/responsive.js";
import { initSearch } from "../static/js/ui/search.js";
import { AppState } from "../static/js/core/state.js";

import { FaCrosshairs, FaSkull, FaCity, FaSatelliteDish, FaCloudRain, FaExclamationTriangle, FaRoad, FaUser, FaFileAlt, FaBars, FaGlobeAmericas } from 'react-icons/fa';
import { TopBar } from '../components/TopBar.jsx';
import { WeatherWidget } from '../components/WeatherWidget.jsx';
import { useWeather } from '../hooks/useWeather.js';
import Chatbot from '../components/Chatbot.jsx';

export default function CommandCenter() {
  const mapRef = useRef(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [systemStatus, setSystemStatus] = React.useState("INICIANDO...");
  const [isSystemOk, setIsSystemOk]     = React.useState(false);
  const { weather, loading: weatherLoading, error: weatherError } = useWeather();
  const [locating, setLocating] = React.useState(false);
  const [chatbotOpen, setChatbotOpen] = React.useState(false);

  const handleLocateMe = () => {
    const m = AppState.map;
    if (!m) return;

    if (AppState.watchId) {
      navigator.geolocation.clearWatch(AppState.watchId);
      AppState.watchId = null;
      AppState.followUser = false;
      setLocating(false);
      return;
    }

    setLocating(true);
    AppState.followUser = true;

    AppState.watchId = navigator.geolocation.watchPosition((pos) => {
      const latlng = [pos.coords.latitude, pos.coords.longitude];
      AppState.userLocation = { lat: latlng[0], lng: latlng[1] };

      if (!AppState.userMarker) {
        AppState.userMarker = L.marker(latlng, {
          icon: L.divIcon({
            className: "",
            html: `<div style="width:12px;height:12px;background:#38bdf8;border-radius:50%;border:2px solid #fff;box-shadow:0 0 12px #38bdf8;"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          })
        }).addTo(m).bindPopup("Estás aquí");
      } else {
        AppState.userMarker.setLatLng(latlng);
      }

      if (AppState.followUser) {
        m.panTo(latlng, { animate: true, duration: 1.0 });
      }
    }, (err) => {
      if (AppState.watchId) navigator.geolocation.clearWatch(AppState.watchId);
      AppState.watchId = null;
      AppState.followUser = false;
      setLocating(false);
    }, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000
    });
  };

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
        applySavedLayerState();
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

        const pLat = parseFloat(searchParams.get("lat"));
        const pLng = parseFloat(searchParams.get("lng"));
        const pZoom = parseInt(searchParams.get("zoom"), 10) || 16;
        if (!isNaN(pLat) && !isNaN(pLng)) {
          const m = AppState.map;
          if (m) {
            setTimeout(() => {
              m.flyTo([pLat, pLng], pZoom, { duration: 1.5 });
              L.popup({ className: "popup-dark" })
                .setLatLng([pLat, pLng])
                .setContent(`<div class="popup-accident"><div class="popup-accident-title">Tu reporte</div><div class="popup-accident-coords">${pLat.toFixed(4)}, ${pLng.toFixed(4)}</div></div>`)
                .openOn(m);
            }, 600);
          }
        }

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
      stopReportsPolling();
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
            <span className="layer-fraction" id="layerFraction">0/16</span>
            <button type="button" className="panel-close" aria-label="Cerrar">×</button>
          </div>
          <div className="panel-scroll" id="layersList">
            <div className="layer-search">
              <span className="search-prefix">⌕</span>
              <input type="search" id="layerSearch" placeholder="Buscar capas..." autoComplete="off" />
            </div>
            <div className="preset-bar">
              <button type="button" className="btn-preset" id="btnPresetNavigation" title="Navegación (7 capas)">NAV</button>
              <button type="button" className="btn-preset" id="btnPresetAll" title="Todas (16 capas)">ALL</button>
              <button type="button" className="btn-preset" id="btnPresetWeather" title="Clima (5 capas)">CLIMA</button>
              <button type="button" className="btn-preset" id="btnPresetMinimal" title="Mínimo (2 capas)">MIN</button>
            </div>
            <details className="layer-group" open data-group="comunas">
              <summary>
                <span className="layer-icon"><FaCity /></span>
                <span>VALLE DEL ABURRÁ — COMUNAS Y CORREGIMIENTOS</span>
                <span className="group-count" id="count-comunas">0/4</span>
                <button type="button" className="btn-toggle-all" data-group="comunas" title="Toggle all">⊞</button>
                <span className="chevron"></span>
              </summary>
              <ul className="layer-items">
                <li>
                  <label className="layer-row">
                    <span>Contorno ciudad</span>
                    <input type="checkbox" className="toggle" data-layer="medellin-city" />
                  </label>
                </li>
                <li>
                  <label className="layer-row">
                    <span>Polígonos y etiquetas (Comunas/CG)</span>
                    <input type="checkbox" className="toggle" data-layer="medellin-comunas" />
                  </label>
                </li>
                <li>
                  <label className="layer-row">
                    <span>Municipios Área Metro (9)</span>
                    <input type="checkbox" className="toggle" data-layer="metro-municipios" />
                  </label>
                </li>
                <li>
                  <label className="layer-row">
                    <span><FaGlobeAmericas size={12} style={{verticalAlign:'middle',marginRight:4}} /> Satelital</span>
                    <input type="checkbox" className="toggle" data-layer="satellite-base" />
                  </label>
                </li>
                <li className="sat-opacity-row" id="satOpacityRow" style={{display:'none'}}>
                  <label className="layer-row" style={{gap:8}}>
                    <span style={{fontSize:8,opacity:0.6}}>Opacidad satelital</span>
                    <input type="range" id="satOpacity" min="0.1" max="1" step="0.05" defaultValue="1" className="opacity-slider" />
                  </label>
                </li>
              </ul>
              <div className="comunas-section">
                <h3>GO TO LOCATION</h3>
                <ul className="comunas-list" id="comunasList"></ul>
              </div>
            </details>

            <details className="layer-group" open data-group="climate">
              <summary>
                <span className="layer-icon"><FaCloudRain /></span>
                <span>SIATA Y CLIMA</span>
                <span className="group-count" id="count-climate">0/3</span>
                <button type="button" className="btn-toggle-all" data-group="climate" title="Toggle all">⊞</button>
                <span className="chevron"></span>
              </summary>
              <ul className="layer-items">
                <li>
                  <label className="layer-row">
                    <span>Deprimidos inundables</span>
                    <input type="checkbox" className="toggle" data-layer="flood-zones" />
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

            <details className="layer-group" data-group="reports">
              <summary>
                <span className="layer-icon"><FaExclamationTriangle /></span>
                <span>REPORTES CIUDADANOS</span>
                <span className="group-count" id="count-reports">0/2</span>
                <button type="button" className="btn-toggle-all" data-group="reports" title="Toggle all">⊞</button>
                <span className="chevron"></span>
              </summary>
              <ul className="layer-items">
                <li>
                  <label className="layer-row">
                    <span>Accidentes reportados</span>
                    <input type="checkbox" className="toggle" data-layer="reports-collision" />
                  </label>
                </li>
                <li>
                  <label className="layer-row">
                    <span>Inundaciones reportadas</span>
                    <input type="checkbox" className="toggle" data-layer="reports-flood" />
                  </label>
                </li>
              </ul>
            </details>

            <details className="layer-group" data-group="routes">
              <summary>
                <span className="layer-icon"><FaRoad /></span>
                <span>RUTAS SEGURAS</span>
                <span className="group-count" id="count-routes">0/1</span>
                <button type="button" className="btn-toggle-all" data-group="routes" title="Toggle all">⊞</button>
                <span className="chevron"></span>
              </summary>
              <ul className="layer-items">
                <li>
                  <label className="layer-row">
                    <span>Ruta segura activa</span>
                    <input type="checkbox" className="toggle" data-layer="safe-route" />
                  </label>
                </li>
              </ul>
            </details>

            <div className="kbd-hint">
              <span className="kbd">1</span>–<span className="kbd">9</span> atajos de capas
            </div>
          </div>
        </aside>

        <aside className="panel panel-right" id="panelTools" aria-label="Herramientas y alertas">
          <div className="panel-head panel-head-tools">
            <h2>KIT Y ALERTAS</h2>
            <button type="button" className="panel-close" aria-label="Cerrar">×</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
               className="panel-scroll">

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
              <div className="scan-box">
                <p className="scan-warn" style={{ color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.35)', backgroundColor: 'rgba(5, 8, 12, 0.6)' }}>¿A DÓNDE VAS? // DIRECCIONES</p>
                <div className="scan-row" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input type="text" id="geoQuery" placeholder="Ej: Comuna 13, Belén, Poblado..." />
                  <button
                    type="button"
                    onClick={handleLocateMe}
                    id="btnLocateGPS"
                    style={{
                      padding: '6px 10px',
                      fontFamily: 'inherit',
                      fontSize: '9px',
                      fontWeight: '600',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.3s',
                      backgroundColor: locating ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                      border: locating ? '1px solid #ef4444' : '1px solid #38bdf8',
                      color: locating ? '#ef4444' : '#38bdf8',
                      boxShadow: locating ? '0 0 10px rgba(239, 68, 68, 0.4)' : 'none'
                    }}
                    title={locating ? "Detener seguimiento GPS" : "Iniciar seguimiento GPS"}
                  >
                    <FaCrosshairs />
                    {locating ? "GPS ON" : "UBICACIÓN"}
                  </button>
                </div>
                 <span id="scanFeedback" style={{display:'none',fontSize:'9px',color:'#f87171',padding:'4px 0',letterSpacing:'0.05em'}}></span>
                 <div id="safetyBriefing" style={{ display: 'none', marginTop: '10px', padding: '10px', backgroundColor: 'rgba(5, 8, 12, 0.85)', border: '1px dashed rgba(56, 189, 248, 0.35)', borderRadius: '4px', fontFamily: '"JetBrains Mono", monospace' }}>
                   <div style={{ fontSize: '9px', color: '#38bdf8', fontWeight: 'bold', borderBottom: '1px solid rgba(56, 189, 248, 0.15)', paddingBottom: '4px', marginBottom: '6px', letterSpacing: '0.05em' }}>INFORME DE SEGURIDAD DE RUTA</div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '4px' }}>
                     <span style={{ color: '#94a3b8' }}>PELIGRO DESTINO:</span>
                     <strong id="briefingDest" style={{ color: '#4ade80' }}>BAJO</strong>
                   </div>
                   <div style={{ fontSize: '8.5px', color: '#cbd5e1', marginBottom: '8px', lineHeight: '1.3' }} id="briefingDestDesc">...</div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '4px', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '6px' }}>
                     <span style={{ color: '#94a3b8' }}>PELIGRO RUTA:</span>
                     <strong id="briefingRoute" style={{ color: '#4ade80' }}>BAJO</strong>
                   </div>
                   <div style={{ fontSize: '8.5px', color: '#cbd5e1', lineHeight: '1.3' }} id="briefingRouteDesc">...</div>
                 </div>
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
            <button type="button" className="icon-btn" id="btnProfile" title="Chatbot IA" onClick={() => setChatbotOpen(true)}><FaUser /></button>
            <button type="button" className="icon-btn" id="btnReport" title="Crear Reporte" onClick={() => navigate('/report')}><FaFileAlt /></button>
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
            <span><strong id="statCoords"></strong></span>
            <span className="sep">|</span>
            <span id="statLocation"></span>
            <span className="sep">|</span>
            <span>Zoom <strong id="statZoom"></strong></span>
            <span className="sep">|</span>
            <span>Capas <strong id="statLayers"></strong></span>
            <span className="sep">|</span>
            <span>Alertas <strong id="statAlerts"></strong></span>
            <span className="sep">|</span>
            <span id="statFatalities"></span>
          </div>
          <p className="stat-comuna" id="statComuna"></p>
          <div className="bottom-right">
            <span className="throughput" id="statThroughput"></span>
          </div>
        </footer>

        <div className="ticker" aria-hidden="true">
          <div className="ticker-track" id="tickerTrack"></div>
        </div>
      </div>

      <div className="fab-map-actions" aria-label="Acciones rápidas">
        <button type="button" className={`btn-icon ${locating ? 'active-glow' : ''}`} onClick={handleLocateMe} aria-label="Mi ubicación" title={locating ? "Seguimiento Activo (Click para detener)" : "Iniciar Seguimiento GPS"} style={{ opacity: 1, backgroundColor: locating ? '#0ea5e9' : 'rgba(56,189,248,0.2)', boxShadow: locating ? '0 0 20px #0ea5e9' : '0 0 10px rgba(56,189,248,0.5)', border: '2px solid #0ea5e9', transform: 'scale(1.25)', marginBottom: '15px' }}>
          <FaCrosshairs />
        </button>
        <button type="button" className="btn-icon" id="fabLayers" aria-label="Capas"><FaBars /></button>
        <button type="button" className="btn-icon" id="fabAlerts" aria-label="Alertas"><FaExclamationTriangle /></button>
      </div>

      <nav className="mobile-dock" aria-label="Vista móvil">
        <Link to="/" className="dock-item">Inicio</Link>
        <Link to="/navigate" className="dock-item">Navegar</Link>
        <Link to="/report" className="dock-item">Reportar</Link>
        <Link to="/map" className="dock-item dock-active">Comando</Link>
      </nav>

      {/* Chatbot IA */}
      {chatbotOpen && <Chatbot isOpen={chatbotOpen} onClose={() => setChatbotOpen(false)} />}
    </>
  );
}
