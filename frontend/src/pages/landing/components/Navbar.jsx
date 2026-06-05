import React, { useEffect, useState } from 'react';
import { FiActivity } from 'react-icons/fi';
import { motion } from 'framer-motion';

const NAV_LINKS = [
  { id: "hero", label: "CONSOLA" },
  { id: "telemetry", label: "TELEMETRÍA" },
  { id: "weather", label: "CLIMA" },
  { id: "reports", label: "REPORTES" },
  { id: "backend", label: "RED" },
  { id: "layers", label: "CAPAS" },
];

function scrollToSection(id) {
  const el = document.getElementById(`section-${id}`);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

export default function Navbar() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    };
    updateTime();
    const t = setInterval(updateTime, 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-[#041327]/80 backdrop-blur-md border-b border-cyan-400/30 shadow-[0_4px_30px_rgba(34,211,238,0.15)] flex items-center justify-between px-6 font-mono">
      
      <div className="flex items-center gap-6">
        <div className="cursor-default text-xl font-['Space_Grotesk'] font-bold tracking-[0.3em] text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]">
          PPTMAPS
        </div>
        <div className="hidden md:flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[9px] text-cyan-400/60 tracking-widest uppercase">
            6.24° N, -75.58° W
          </span>
        </div>
      </div>

      <div className="hidden lg:flex items-center gap-6">
        {NAV_LINKS.map((link, i) => (
          <button
            key={link.id}
            onClick={() => link.isRoute ? window.location.href = link.route : scrollToSection(link.id)}
            className="relative group cursor-pointer py-2 bg-transparent border-none"
          >
            <span className="text-[10px] text-cyan-400/50 mr-2">[{String(i + 1).padStart(2, '0')}]</span>
            <span className="text-xs text-slate-300 group-hover:text-cyan-400 transition-colors tracking-widest">
              {link.label}
            </span>
            <div className="absolute bottom-0 left-0 w-0 h-[1px] bg-cyan-400 group-hover:w-full transition-all duration-300 shadow-[0_0_8px_#22D3EE]" />
          </button>
        ))}
      </div>

      <div className="flex items-center gap-6">
        <button
          onClick={() => { window.location.href = '/dashboard'; }}
          className="px-4 py-1.5 border border-cyan-400/40 bg-[#041327]/60 text-cyan-400 text-[9px] font-bold tracking-widest uppercase cursor-pointer"
          style={{ clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))" }}
        >
          Estadísticas
        </button>
        <div className="hidden sm:block text-[11px] text-slate-300 tracking-widest">
          {time}
        </div>
        <button
          onClick={() => { window.location.href = '/map'; }}
          className="px-4 py-1.5 border border-cyan-400/40 bg-[#041327]/60 text-cyan-400 text-[9px] font-bold tracking-widest uppercase cursor-pointer"
          style={{ clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))" }}
        >
          Abrir Panel de Control
        </button>
        <div className="relative group cursor-pointer">
          <div className="absolute inset-0 bg-cyan-400/20 blur-[8px] group-hover:blur-[12px] transition-all" />
          <div className="relative px-4 py-1.5 border border-cyan-400/40 bg-[#041327]/60 flex items-center gap-2 overflow-hidden"
               style={{ clipPath: "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))" }}>
            <motion.div 
              className="absolute inset-0 w-full h-[200%] bg-gradient-to-b from-transparent via-cyan-400/20 to-transparent pointer-events-none opacity-0 group-hover:opacity-100" 
              animate={{ y: ["-100%", "100%"] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />
            <FiActivity className="text-cyan-400 text-xs" />
            <span className="text-[9px] text-cyan-400 tracking-widest font-bold">
              SECURE_LINK // CONNECTED
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}
