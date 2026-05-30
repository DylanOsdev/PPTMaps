import React from 'react';
import { StatusCluster } from './StatusCluster.jsx';

export function TopBar({ systemStatus, isSystemOk }) {
  return (
    <header className="col-span-full flex items-center justify-between gap-3 px-4 py-2.5 bg-gradient-to-b from-[rgba(5,8,12,0.9)] to-[rgba(5,8,12,0.7)] border-b border-[rgba(56,189,248,0.25)] backdrop-blur-md">
      <div className="flex flex-col">
        <h1 className="font-['Orbitron',sans-serif] text-[1.35rem] font-bold tracking-[0.18em] text-[#67e8f9] drop-shadow-[0_0_20px_rgba(56,189,248,0.5)] leading-tight">TPPMAPS</h1>
        <p className="text-[8px] tracking-[0.14em] text-[#94a3b8] mt-[3px] opacity-70">GEOSPATIAL INTELLIGENCE COMMAND</p>
        <span className="inline-block mt-1.5 py-0.5 px-2 text-[7px] tracking-[0.1em] text-[#4ade80] border border-[rgba(74,222,128,0.4)] rounded bg-[rgba(74,222,128,0.07)] shadow-[0_0_6px_rgba(74,222,128,0.4)] w-max">OPEN SOURCE</span>
      </div>

      <div className="md:hidden flex gap-2" aria-label="Menú móvil">
        <button type="button" className="w-8 h-8 flex items-center justify-center bg-[rgba(56,189,248,0.06)] border border-[rgba(56,189,248,0.25)] rounded text-[13px] text-[#94a3b8] hover:bg-[rgba(56,189,248,0.15)] hover:border-[#67e8f9] hover:text-[#67e8f9] hover:shadow-[0_0_10px_rgba(56,189,248,0.2)] transition-all" id="btnToggleLayers" aria-label="Abrir capas">☰</button>
        <button type="button" className="w-8 h-8 flex items-center justify-center bg-[rgba(56,189,248,0.06)] border border-[rgba(56,189,248,0.25)] rounded text-[13px] text-[#94a3b8] hover:bg-[rgba(56,189,248,0.15)] hover:border-[#67e8f9] hover:text-[#67e8f9] hover:shadow-[0_0_10px_rgba(56,189,248,0.2)] transition-all" id="btnToggleTools" aria-label="Abrir herramientas">⚙</button>
      </div>

      <StatusCluster systemStatus={systemStatus} isSystemOk={isSystemOk} />

      <div className="flex gap-2 shrink-0">
        <a href="/docs" className="px-3.5 py-1.5 font-['JetBrains_Mono',monospace] text-[9px] font-semibold tracking-[0.08em] text-[#fbbf24] bg-[rgba(251,191,36,0.05)] border border-[rgba(251,191,36,0.5)] rounded hover:bg-[rgba(251,191,36,0.14)] hover:border-[#fbbf24] hover:shadow-[0_0_16px_rgba(251,191,36,0.25)] transition-all no-underline" title="API FastAPI Swagger">API / DOCS</a>
        <button type="button" className="px-3.5 py-1.5 font-['JetBrains_Mono',monospace] text-[9px] font-semibold tracking-[0.08em] text-[#fbbf24] bg-[rgba(251,191,36,0.05)] border border-[rgba(251,191,36,0.5)] rounded hover:bg-[rgba(251,191,36,0.14)] hover:border-[#fbbf24] hover:shadow-[0_0_16px_rgba(251,191,36,0.25)] transition-all" id="btnSupport">PROYECTO DE APOYO</button>
      </div>
    </header>
  );
}
