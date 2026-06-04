import React from 'react';

export function StatusCluster({ systemStatus, isSystemOk, alertCount = 7, uptime = "00:00:00" }) {
  return (
    <div className="flex flex-wrap gap-x-3.5 gap-y-2 justify-center flex-1 max-w-[720px]" id="statusCluster">
      <span className="flex items-center gap-1 text-[#94a3b8] text-[9.5px] tracking-[0.06em] whitespace-nowrap px-2 py-1 border border-[rgba(56,189,248,0.12)] rounded bg-[rgba(8,12,18,0.6)]" id="zuluTime"></span>
      <span className={`flex items-center gap-1 text-[9.5px] tracking-[0.06em] whitespace-nowrap px-2 py-1 border border-[rgba(56,189,248,0.12)] rounded bg-[rgba(8,12,18,0.6)] ${isSystemOk ? "text-[#4ade80] drop-shadow-[0_0_6px_rgba(74,222,128,0.4)]" : "text-[#94a3b8]"}`} id="systemStatus">
        {systemStatus}
      </span>
      <span className="flex items-center gap-1 text-[#94a3b8] text-[9.5px] tracking-[0.06em] whitespace-nowrap px-2 py-1 border border-[rgba(56,189,248,0.12)] rounded bg-[rgba(8,12,18,0.6)]">SIATA: <span id="siataStatus">SYNC</span></span>
      <span className="flex items-center gap-1 text-[#94a3b8] text-[9.5px] tracking-[0.06em] whitespace-nowrap px-2 py-1 border border-[rgba(56,189,248,0.12)] rounded bg-[rgba(8,12,18,0.6)]"><span id="alertCount"></span> ALERTS</span>
      <span className="flex items-center gap-1 text-[#94a3b8] text-[9.5px] tracking-[0.06em] whitespace-nowrap px-2 py-1 border border-[rgba(56,189,248,0.12)] rounded bg-[rgba(8,12,18,0.6)]">UPTIME: <span id="uptime"></span></span>
    </div>
  );
}
