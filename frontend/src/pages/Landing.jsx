import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaMapMarkedAlt, FaCloudSunRain, FaCarCrash, FaMobileAlt, FaRoute, FaDatabase } from 'react-icons/fa';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f8f9f8] text-[#333333] font-['Inter',sans-serif] overflow-x-hidden">
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-[60px] flex items-center justify-between px-6 md:px-12 bg-transparent">
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="PPTMaps" className="h-9 w-9 rounded-full object-cover" />
          <span className="text-xl font-bold text-white tracking-tight">PPTMaps</span>
        </div>
      </nav>

      {/* HERO */}
      <section className="min-h-screen pt-[60px] flex items-center justify-center relative overflow-hidden bg-[#0d2a1a]">
        {/* Imagen de fondo de Medellín */}
        <img src="/medellin.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
        {/* Overlay para legibilidad del texto */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d2a1a]/45 via-[#0d2a1a]/30 to-[#0d2a1a]/55"></div>

        <div className="flex flex-col items-center text-center px-8 py-16 z-10 max-w-[820px]">
          <span className="text-sm text-[#a7f3d0] mb-6 font-semibold tracking-wide animate-[fadeUp_0.5s_0.1s_forwards] opacity-0">
            // INTELIGENCIA URBANA · MEDELLÍN · ACTIVO
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-white mb-6 animate-[fadeUp_0.5s_0.25s_forwards] opacity-0">
            MAPA<br />
            <span className="text-white">GEOESPACIAL</span><br />
            EN <span className="text-[#3db84f]">TIEMPO REAL</span>
          </h1>
          <p className="text-base leading-relaxed text-[#e0e0e0] max-w-[480px] mb-10 animate-[fadeUp_0.5s_0.4s_forwards] opacity-0">
            Plataforma de comando para monitoreo urbano de Medellín.
            Tráfico, alertas SIATA, telemetría vial y reportes ciudadanos
            en las 16 comunas — sincronizado en tiempo real.
          </p>
          <div className="flex flex-wrap gap-8 md:gap-12 mb-10 justify-center animate-[fadeUp_0.5s_0.55s_forwards] opacity-0">
            <div>
              <span className="text-3xl font-bold text-white block">16</span>
              <span className="text-sm text-[#cbd5cd] font-medium">COMUNAS</span>
            </div>
            <div>
              <span className="text-3xl font-bold text-white block">847</span>
              <span className="text-sm text-[#cbd5cd] font-medium">GPS ACTIVOS</span>
            </div>
            <div>
              <span className="text-3xl font-bold text-white block">0K</span>
              <span className="text-sm text-[#cbd5cd] font-medium">DEPRIMIDOS</span>
            </div>
            <div>
              <span className="text-3xl font-bold text-white block">7</span>
              <span className="text-sm text-[#cbd5cd] font-medium">ALERTAS HOY</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 items-center justify-center animate-[fadeUp_0.5s_0.7s_forwards] opacity-0">
            <button onClick={() => navigate('/map')} className="text-[0.95rem] font-semibold text-white bg-[#1a5c3a] px-8 py-3.5 rounded transition-colors hover:bg-[#2d9e5e]">
              ABRIR COMANDO
            </button>
            <button onClick={() => navigate('/dashboard')} className="text-[0.95rem] font-semibold text-white bg-transparent border-2 border-white px-8 py-3 rounded transition-colors hover:bg-white hover:text-[#1a5c3a]">
              DASHBOARD
            </button>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 px-8 md:px-16 bg-white border-t border-[#e0e0e0]">
        <div className="text-sm text-[#1a5c3a] mb-3 font-semibold tracking-wide">// CAPACIDADES DEL SISTEMA</div>
        <div className="text-3xl font-bold text-[#1a5c3a] mb-12">INTELIGENCIA URBANA COMPLETA</div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-[#f8f9f8] p-8 border border-[#e0e0e0] rounded transition-all hover:bg-white hover:border-[#1a5c3a] hover:shadow-[0_4px_12px_rgba(26,92,58,.08)]">
            <div className="w-12 h-12 mb-4 flex items-center justify-center text-[#1a5c3a]"><FaMapMarkedAlt size={32} /></div>
            <div className="text-[0.95rem] font-bold text-[#1a5c3a] mb-2.5">CAPAS DE DATOS</div>
            <div className="text-[0.95rem] leading-relaxed text-[#666666]">9 de 14 capas activas. Contorno ciudad, polígonos comunas, telemetría GPS y clusters de accidentes configurables en tiempo real.</div>
          </div>
          <div className="bg-[#f8f9f8] p-8 border border-[#e0e0e0] rounded transition-all hover:bg-white hover:border-[#1a5c3a] hover:shadow-[0_4px_12px_rgba(26,92,58,.08)]">
            <div className="w-12 h-12 mb-4 flex items-center justify-center text-[#1a5c3a]"><FaCloudSunRain size={32} /></div>
            <div className="text-[0.95rem] font-bold text-[#1a5c3a] mb-2.5">SIATA Y CLIMA</div>
            <div className="text-[0.95rem] leading-relaxed text-[#666666]">Integración directa con el Sistema de Alertas Tempranas. Deprimidos inundables, riesgo de lluvia a 2 horas y alertas meteorológicas.</div>
          </div>
          <div className="bg-[#f8f9f8] p-8 border border-[#e0e0e0] rounded transition-all hover:bg-white hover:border-[#1a5c3a] hover:shadow-[0_4px_12px_rgba(26,92,58,.08)]">
            <div className="w-12 h-12 mb-4 flex items-center justify-center text-[#1a5c3a]"><FaCarCrash size={32} /></div>
            <div className="text-[0.95rem] font-bold text-[#1a5c3a] mb-2.5">TELEMETRÍA VIAL</div>
            <div className="text-[0.95rem] leading-relaxed text-[#666666]">Rastreo GPS en tiempo real, mapas predictivos de congestión y clusters de accidentes via DBSCAN para las 16 comunas.</div>
          </div>
          <div className="bg-[#f8f9f8] p-8 border border-[#e0e0e0] rounded transition-all hover:bg-white hover:border-[#1a5c3a] hover:shadow-[0_4px_12px_rgba(26,92,58,.08)]">
            <div className="w-12 h-12 mb-4 flex items-center justify-center text-[#1a5c3a]"><FaMobileAlt size={32} /></div>
            <div className="text-[0.95rem] font-bold text-[#1a5c3a] mb-2.5">REPORTES CIUDADANOS</div>
            <div className="text-[0.95rem] leading-relaxed text-[#666666]">Canal georeferenciado de reportes. Obstáculos, obras sin señalización e incidentes procesados en segundos.</div>
          </div>
          <div className="bg-[#f8f9f8] p-8 border border-[#e0e0e0] rounded transition-all hover:bg-white hover:border-[#1a5c3a] hover:shadow-[0_4px_12px_rgba(26,92,58,.08)]">
            <div className="w-12 h-12 mb-4 flex items-center justify-center text-[#1a5c3a]"><FaRoute size={32} /></div>
            <div className="text-[0.95rem] font-bold text-[#1a5c3a] mb-2.5">RUTAS SEGURAS</div>
            <div className="text-[0.95rem] leading-relaxed text-[#666666]">Cálculo de rutas evitando zonas de riesgo activo, lluvia inminente y vías bloqueadas. Actualización cada 30 segundos.</div>
          </div>
          <div className="bg-[#f8f9f8] p-8 border border-[#e0e0e0] rounded transition-all hover:bg-white hover:border-[#1a5c3a] hover:shadow-[0_4px_12px_rgba(26,92,58,.08)]">
            <div className="w-12 h-12 mb-4 flex items-center justify-center text-[#1a5c3a]"><FaDatabase size={32} /></div>
            <div className="text-[0.95rem] font-bold text-[#1a5c3a] mb-2.5">API PÚBLICA</div>
            <div className="text-[0.95rem] leading-relaxed text-[#666666]">REST endpoints para todos los datos geoespaciales. PostGIS, Redis y soporte GeoJSON de alta velocidad.</div>
          </div>
        </div>
      </section>

      {/* METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-4 border-y border-[#e0e0e0] bg-[#f8f9f8]">
        <div className="p-8 md:p-12 text-center border-b md:border-b-0 md:border-r border-[#e0e0e0]">
          <span className="text-4xl font-bold block mb-2 text-[#1a5c3a]">16</span>
          <span className="text-sm text-[#666666] font-medium">COMUNAS ACTIVAS</span>
        </div>
        <div className="p-8 md:p-12 text-center border-b md:border-b-0 md:border-r border-[#e0e0e0]">
          <span className="text-4xl font-bold block mb-2 text-[#3db84f]">847</span>
          <span className="text-sm text-[#666666] font-medium">CONDUCTORES GPS</span>
        </div>
        <div className="p-8 md:p-12 text-center border-b md:border-b-0 md:border-r border-[#e0e0e0]">
          <span className="text-4xl font-bold block mb-2 text-[#3db84f]">0K</span>
          <span className="text-sm text-[#666666] font-medium">DEPRIMIDOS HOY</span>
        </div>
        <div className="p-8 md:p-12 text-center">
          <span className="text-4xl font-bold block mb-2 text-[#d32f2f]">7</span>
          <span className="text-sm text-[#666666] font-medium">ALERTAS EN CURSO</span>
        </div>
      </div>

      {/* CTA */}
      <section className="py-24 px-8 md:px-20 text-center bg-white border-t border-[#e0e0e0] relative overflow-hidden">
        <div className="text-sm text-[#1a5c3a] mb-3 font-semibold tracking-wide">// ACCESO AL SISTEMA</div>
        <h2 className="text-3xl font-bold text-[#1a5c3a] mb-3">ENTRA AL COMANDO GEOESPACIAL</h2>
        <p className="text-base text-[#666666] mb-10">Mapa satelital real de Medellín. Todas las capas. Todas las alertas. Tiempo real.</p>
        <button onClick={() => navigate('/map')} className="text-sm font-semibold bg-[#1a5c3a] text-white px-11 py-4 rounded hover:bg-[#2d9e5e] transition-colors">
          ABRIR TPPMAPS →
        </button>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#f8f9f8] border-t border-[#e0e0e0] py-8 px-8 md:px-16 flex flex-col md:flex-row items-center justify-between text-center gap-4">
        <span className="text-[0.95rem] font-bold text-[#1a5c3a]">TPPMAPS</span>
        <p className="text-[0.85rem] text-[#666666]">SISTEMA DEMO · MEDELLÍN, ANTIOQUIA · COLOMBIA</p>
        <p className="text-[0.85rem] text-[#666666]">PostGIS + Redis: CONECTADO · API v2.1</p>
      </footer>
    </div>
  );
}
