import React from 'react';

export function StatusCluster({ systemStatus, isSystemOk, alertCount = 7, uptime = "00:00:00" }) {
  return (
    <div className="status-cluster" id="statusCluster">
      <span className="status-item" id="zuluTime">ZULU --:--:--Z</span>
      <span className={`status-item ${isSystemOk ? "status-ok" : ""}`} id="systemStatus">
        {systemStatus}
      </span>
      <span className="status-item">SIATA: <span id="siataStatus">SYNC</span></span>
      <span className="status-item"><span id="alertCount">{alertCount}</span> ALERTS</span>
      <span className="status-item">UPTIME: <span id="uptime">{uptime}</span></span>
    </div>
  );
}
