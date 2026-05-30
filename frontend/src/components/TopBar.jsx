import React from 'react';
import { StatusCluster } from './StatusCluster.jsx';

export function TopBar({ systemStatus, isSystemOk }) {
  return (
    <header className="top-bar">
      <div className="brand">
        <h1 className="brand-title">TPPMAPS</h1>
        <p className="brand-sub">GEOSPATIAL INTELLIGENCE COMMAND</p>
        <span className="badge-open">OPEN SOURCE</span>
      </div>

      <div className="header-toolbar" aria-label="Menú móvil">
        <button type="button" className="btn-icon" id="btnToggleLayers" aria-label="Abrir capas">☰</button>
        <button type="button" className="btn-icon" id="btnToggleTools" aria-label="Abrir herramientas">⚙</button>
      </div>

      <StatusCluster systemStatus={systemStatus} isSystemOk={isSystemOk} />

      <div className="header-actions">
        <a href="/docs" className="btn-gold" title="API FastAPI Swagger">API / DOCS</a>
        <button type="button" className="btn-gold" id="btnSupport">PROYECTO DE APOYO</button>
      </div>
    </header>
  );
}
