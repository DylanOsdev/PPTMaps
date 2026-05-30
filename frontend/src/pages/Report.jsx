import React, { useState, useEffect } from 'react';
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

const reportTypes = [
  { icon: '🚗', label: 'Accidente', desc: 'Choque, volcamiento' },
  { icon: '🚧', label: 'Vía cerrada', desc: 'Cierre total o parcial' },
  { icon: '🌊', label: 'Inundación', desc: 'Agua en la vía' },
  { icon: '🕳️', label: 'Hueco', desc: 'Bache o hundimiento' },
  { icon: '🚦', label: 'Semáforo', desc: 'Dañado o apagado' },
  { icon: '🛑', label: 'Otro', desc: 'Cualquier otra novedad' },
];

export default function Report() {
  const [selected, setSelected] = useState(null);

  const handleSubmit = () => {
    alert('Reporte enviado ✅');
  };

  return (
    <div className="mobile-page">
      <a className="desktop-link" href="/map">← Vista comando tppmaps</a>
      <div className="status-bar">
        <span>TPPMAPS</span>
        <span><Clock /></span>
        <span>98%</span>
      </div>
      <div className="page-title">📍 REPORTAR INCIDENTE</div>
      <main style={{ paddingTop: 0 }}>
        <div className="prompt">¿Qué tipo de incidente viste?</div>
        <div className="report-grid">
          {reportTypes.map(t => (
            <button
              key={t.label}
              className={`report-type ${selected === t.label ? 'selected' : ''}`}
              onClick={() => setSelected(t.label)}
            >
              <div className="icon">{t.icon}</div>
              <strong>{t.label}</strong>
              <span>{t.desc}</span>
            </button>
          ))}
        </div>
        <button className="btn-voice" onClick={handleSubmit}>🎤 Describir con voz & enviar</button>
      </main>
      <nav className="nav-bottom">
        <Link to="/">📍 Inicio</Link>
        <Link to="/navigate">🧭 Navegar</Link>
        <Link to="/report" className="active">⚠ Reportar</Link>
      </nav>
    </div>
  );
}
