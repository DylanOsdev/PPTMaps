import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
// import '../../static/css/movil.css';

function Clock() {
  const [time, setTime] = useState(new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }));
  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return <>{time}</>;
}

export default function Navigate() {
  return (
    <div className="mobile-page">
      <a className="desktop-link" href="/map">← Vista comando tppmaps</a>
      <div className="status-bar">
        <span>TPPMAPS</span>
        <span><Clock /></span>
        <span>98%</span>
      </div>
      <div className="sub-bar">
        <span className="voice">🔊 Voz Activa</span>
        <span>🕐 18 min</span>
      </div>
      <div className="alert-banner">⚠ Recalculando ruta segura…</div>
      <main style={{ paddingTop: 0 }}>
        <div className="map-placeholder" style={{ height: 'min(52vh, 380px)' }}>
          <div className="route-line"></div>
        </div>
        <div className="route-card">
          <h3>🛡 RUTA SEGURA MOVIMED</h3>
          <div className="stats-row">
            <div><div className="val">Belén</div><div className="lbl">Destino</div></div>
            <div><div className="val" style={{ color: 'var(--green)' }}>0%</div><div className="lbl">Riesgo lluvia</div></div>
            <div><div className="val" style={{ color: 'var(--orange)' }}>3</div><div className="lbl">Puntos evitados</div></div>
          </div>
        </div>
      </main>
      <nav className="nav-bottom">
        <Link to="/">📍 Inicio</Link>
        <Link to="/navigate" className="active">🧭 Navegar</Link>
        <Link to="/report">⚠ Reportar</Link>
      </nav>
    </div>
  );
}
