import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDevicePerformance } from '../../../hooks/useDevicePerformance';
import { seededRandom } from '../../../utils/random';
import { useCountUp } from '../../../hooks/useCountUp';

const VOICE_BARS = (() => {
  const rng = seededRandom(789);
  return Array.from({ length: 48 }, (_, i) => ({
    height: 4 + Math.sin(i * 0.5) * 8 + Math.sin(i * 1.2) * 6 + rng() * 4,
    dur: 0.8 + rng() * 0.6,
    delay: rng() * 0.5,
  }));
})();

const REPORT_ITEMS = [
  { text: "Accidente Múltiple", type: "critical", top: "18%", left: "22%" },
  { text: "Obstáculo en Vía",   type: "warning",  top: "72%", left: "75%" },
  { text: "Cierre Preventivo",  type: "critical", top: "35%", left: "80%" },
  { text: "Señalización Dañada",type: "info",     top: "75%", left: "10%" },
  { text: "Tráfico Detenido",   type: "warning",  top: "22%", left: "65%" },
  { text: "Inundación Vía",     type: "critical", top: "45%", left: "40%" },
  { text: "Deslizamiento",      type: "critical", top: "12%", left: "50%" },
  { text: "Semáforo Averiado",  type: "warning",  top: "60%", left: "30%" },
  { text: "Vía en Obra",        type: "info",     top: "85%", left: "55%" },
  { text: "Manifestación",      type: "critical", top: "30%", left: "10%" },
  { text: "Accidente Leve",     type: "warning",  top: "55%", left: "88%" },
  { text: "Árbol Caído",        type: "warning",  top: "40%", left: "58%" },
  { text: "Movilidad Reducida", type: "info",     top: "10%", left: "80%" },
  { text: "Derrumbes",          type: "critical", top: "65%", left: "15%" },
  { text: "Bache Profundo",     type: "info",     top: "88%", left: "35%" },
];

const COLORS = {
  critical: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/50", shadow: "rgba(239,68,68,0.6)", pulse: "rgba(239,68,68,0.3)", badge: "CRÍTICO", hex: "#ef4444" },
  warning:  { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-400/50", shadow: "rgba(234,179,8,0.4)", pulse: "rgba(234,179,8,0.25)", badge: "ALERTA", hex: "#eab308" },
  info:     { bg: "bg-cyan-500/20", text: "text-cyan-400", border: "border-cyan-400/50", shadow: "rgba(34,211,238,0.4)", pulse: "rgba(34,211,238,0.25)", badge: "INFO", hex: "#22d3ee" },
};

const CYBER_CHARS = "!<>-_\\/[]{}—=+*^?#________";
const GLITCH_CHARS = "!@#$%^&*()_+-=[]{}|;:,./<>?~`".split('');

const CITIES = [
  { name: "Medellín",  x: 50, y: 58, type: "critical", data: "234" },
  { name: "Bello",     x: 42, y: 32, type: "warning",  data: "87" },
  { name: "Envigado",  x: 65, y: 64, type: "info",     data: "45" },
  { name: "Itagüí",    x: 35, y: 63, type: "warning",  data: "62" },
  { name: "Sabaneta",  x: 58, y: 74, type: "info",     data: "28" },
];

const RADIAL_ANGLES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

function RadialGrid({ centerX, centerY, radius }) {
  return (
    <g>
      {RADIAL_ANGLES.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x = centerX + radius * Math.cos(rad);
        const y = centerY + radius * Math.sin(rad);
        return (
          <line key={`rg-${deg}`} x1={centerX} y1={centerY} x2={x} y2={y}
            stroke="rgba(34,211,238,0.03)" strokeWidth="0.15" />
        );
      })}
    </g>
  );
}

function ConcentricRings({ centerX, centerY }) {
  const rings = [10, 18, 26, 34, 40];
  return (
    <g>
      {rings.map((r, i) => (
        <circle key={`ring-${i}`} cx={centerX} cy={centerY} r={r}
          fill="none" stroke="rgba(34,211,238,0.05)" strokeWidth="0.15"
          strokeDasharray={i % 2 === 0 ? 'none' : '1 3'} />
      ))}
    </g>
  );
}

function PulseWaves({ centerX, centerY }) {
  return (
    <g>
      {[0, 1.2, 2.4].map((delay, i) => (
        <circle key={`pw-${i}`} cx={centerX} cy={centerY} r={6}
          fill="none" stroke="rgba(34,211,238,0.08)" strokeWidth="0.3">
          <animate attributeName="r" values="4;42" dur="4s" begin={`-${delay}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.25;0" dur="4s" begin={`-${delay}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </g>
  );
}

function SpectrumBands({ centerX, centerY, radius, elapsed }) {
  const bands = [];
  for (let i = 0; i < 36; i++) {
    const angle = (i / 36) * 2 * Math.PI - Math.PI / 2;
    const baseR = radius;
    const h = 1.5 + Math.sin(elapsed * 0.003 + i * 0.8) * 2 + Math.sin(elapsed * 0.005 + i * 0.3) * 1.5;
    const x1 = centerX + baseR * Math.cos(angle);
    const y1 = centerY + baseR * Math.sin(angle);
    const x2 = centerX + (baseR + h) * Math.cos(angle);
    const y2 = centerY + (baseR + h) * Math.sin(angle);
    bands.push({ x1, y1, x2, y2, opacity: 0.06 + Math.abs(Math.sin(elapsed * 0.003 + i * 0.8)) * 0.08 });
  }

  return (
    <g>
      {bands.map((b, i) => (
        <line key={`sb-${i}`} x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2}
          stroke="rgba(34,211,238,0.15)" strokeWidth="0.5" strokeLinecap="round" opacity={b.opacity} />
      ))}
    </g>
  );
}

function ScanWedge({ centerX, centerY, radius }) {
  return (
    <g>
      <polygon points={`${centerX},${centerY} ${centerX + radius},${centerY - radius * 0.04} ${centerX + radius},${centerY + radius * 0.04}`}
        fill="url(#scanGrad)" opacity="0.07">
        <animateTransform attributeName="transform" type="rotate" from={`0 ${centerX} ${centerY}`} to={`360 ${centerX} ${centerY}`}
          dur="6s" repeatCount="indefinite" />
      </polygon>
      <line x1={centerX} y1={centerY} x2={centerX + radius} y2={centerY}
        stroke="rgba(34,211,238,0.08)" strokeWidth="0.15">
        <animateTransform attributeName="transform" type="rotate" from={`0 ${centerX} ${centerY}`} to={`360 ${centerX} ${centerY}`}
          dur="6s" repeatCount="indefinite" />
      </line>
    </g>
  );
}

function CentralOrb({ centerX, centerY }) {
  return (
    <g>
      <circle cx={centerX} cy={centerY} r={5}
        fill="url(#coreGrad)" opacity="0.4">
        <animate attributeName="r" values="4.5;5.5;4.5" dur="2.5s" repeatCount="indefinite" />
      </circle>
      <circle cx={centerX} cy={centerY} r={3}
        fill="rgba(34,211,238,0.15)" filter="url(#glow)">
        <animate attributeName="r" values="2.5;3.5;2.5" dur="2.5s" repeatCount="indefinite" />
      </circle>
      <circle cx={centerX} cy={centerY} r={1.5}
        fill="rgba(255,255,255,0.3)" filter="url(#glow)">
        <animate attributeName="opacity" values="0.2;0.5;0.2" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}

function OrbitalArcs({ elapsed }) {
  const arcs = [
    [0, 1], [0, 2], [0, 3], [0, 4],
    [1, 3], [2, 4], [2, 3], [1, 4],
  ];
  return (
    <g>
      {arcs.map(([ai, bi], idx) => {
        const a = CITIES[ai], b = CITIES[bi];
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const dx = mx - 50, dy = my - 50;
        const len = Math.hypot(dx, dy) || 0.01;
        const offset = 5 + Math.sin(elapsed * 0.001 + idx) * 1.5;
        const cx = mx + (dx / len) * offset;
        const cy = my + (dy / len) * offset;
        const d = `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
        return (
          <g key={`arc-${idx}`}>
            <path d={d} fill="none" stroke="rgba(34,211,238,0.04)" strokeWidth="0.3" />
            <path d={d} fill="none" stroke="rgba(34,211,238,0.06)" strokeWidth="0.12"
              strokeDasharray="1.5 4" strokeLinecap="round">
              <animate attributeName="stroke-dashoffset" from="0" to="5.5"
                dur={`${1.5 + idx * 0.3}s`} repeatCount="indefinite" />
            </path>
          </g>
        );
      })}
    </g>
  );
}

function CityNodes({ hoveredIndex, setHoveredIndex, elapsed }) {
  return (
    <g>
      {CITIES.map((city, i) => {
        const c = COLORS[city.type];
        const isHovered = hoveredIndex === i;
        const pulse = Math.sin(elapsed * 0.002 + i * 1.5) * 0.5 + 0.5;
        const ringR = 3.5 + pulse * 2;
        return (
          <g key={i} className="cursor-pointer" style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}>
            {/* Data ring - outer */}
            <circle cx={city.x} cy={city.y} r={ringR + 2.5}
              fill="none" stroke={c.hex} strokeWidth="0.12" opacity={0.08 + pulse * 0.06} />
            {/* Data ring - inner */}
            <circle cx={city.x} cy={city.y} r={3.5}
              fill="none" stroke={c.hex} strokeWidth="0.2" opacity={0.15 + (isHovered ? 0.2 : 0)}>
              <animate attributeName="r" values={`${isHovered ? 3 : 2.5};${isHovered ? 5.5 : 4.5};${isHovered ? 3 : 2.5}`}
                dur={`${1.5 + i * 0.2}s`} repeatCount="indefinite" />
            </circle>
            {/* Core */}
            <circle cx={city.x} cy={city.y} r={1.2 + (isHovered ? 0.4 : 0)}
              fill={c.hex} opacity={0.85} filter="url(#glow)" />
            <circle cx={city.x} cy={city.y} r={0.4}
              fill="#fff" opacity={0.8} />
            {/* City label */}
            <text x={city.x} y={city.y + 4.5}
              fill="rgba(148,163,184,0.45)"
              fontSize="1.8"
              fontFamily="monospace"
              textAnchor="middle"
              dominantBaseline="hanging"
              letterSpacing="0.8">
              {city.name}
            </text>
            {/* Data badge */}
            {isHovered && (
              <text x={city.x} y={city.y - 4.5}
                fill={c.hex}
                fontSize="2.4"
                fontFamily="monospace"
                textAnchor="middle"
                dominantBaseline="auto"
                letterSpacing="0.5"
                opacity="0.7">
                {city.data}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

function DataParticles({ elapsed }) {
  const particles = useMemo(() => {
    const list = [];
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * 2 * Math.PI;
      const baseR = 5 + (i % 6) * 6;
      const drift = Math.sin(i * 2.3) * 0.8;
      list.push({
        angle,
        r: baseR,
        drift,
        delay: i * 0.15,
        size: 0.15 + (i % 3) * 0.1,
        opacity: 0.04 + (i % 5) * 0.02,
      });
    }
    return list;
  }, []);

  return (
    <g>
      {particles.map((p, i) => {
        const t = ((elapsed * 0.0002 + p.delay) % 1) * 2 * Math.PI;
        const r = p.r + Math.sin(elapsed * 0.001 + i) * 1.5;
        const x = 50 + r * Math.cos(p.angle + t);
        const y = 50 + r * Math.sin(p.angle + t);
        return (
          <circle key={`dp-${i}`} cx={x} cy={y} r={p.size}
            fill="#22D3EE" opacity={p.opacity} filter="url(#glow)" />
        );
      })}
    </g>
  );
}

function FrequencyRings({ centerX, centerY }) {
  return (
    <g>
      {[0, 0.5, 1.0, 1.5, 2.0].map((delay, i) => (
        <circle key={`fr-${i}`} cx={centerX} cy={centerY} r={3}
          fill="none" stroke="rgba(34,211,238,0.03)" strokeWidth="1.5"
          strokeLinecap="round">
          <animate attributeName="r" values="0;45" dur="5s" begin={`-${delay}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.12;0" dur="5s" begin={`-${delay}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </g>
  );
}

function HoloHub({ elapsed }) {
  const cx = 50, cy = 50, radius = 38;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
      <svg viewBox="0 0 100 100" className="w-[140%] h-[140%] max-w-none">
        <defs>
          <radialGradient id="hubGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.06" />
            <stop offset="35%" stopColor="#22D3EE" stopOpacity="0.025" />
            <stop offset="70%" stopColor="#22D3EE" stopOpacity="0.01" />
            <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="coreGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#14b8a6" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="scanGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
          </linearGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="0.6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>

        {/* Base ambient glow */}
        <circle cx={cx} cy={cy} r={radius + 4} fill="url(#hubGlow)" />
        <ellipse cx={cx} cy={cy} rx={radius + 6} ry={radius * 0.35 + 2}
          fill="rgba(34,211,238,0.015)" />

        {/* Radial grid */}
        <RadialGrid centerX={cx} centerY={cy} radius={radius} />

        {/* Concentric rings */}
        <ConcentricRings centerX={cx} centerY={cy} />

        {/* Outer orbit ring */}
        <circle cx={cx} cy={cy} r={radius}
          fill="none" stroke="rgba(34,211,238,0.06)" strokeWidth="0.2" strokeDasharray="1 6" />

        {/* Frequency rings - voice waves */}
        <FrequencyRings centerX={cx} centerY={cy} />
        <PulseWaves centerX={cx} centerY={cy} />

        {/* Spectrum bands around outer ring */}
        <SpectrumBands centerX={cx} centerY={cy} radius={radius} elapsed={elapsed} />

        {/* Orbital arcs between cities */}
        <OrbitalArcs elapsed={elapsed} />

        {/* Data particles */}
        <DataParticles elapsed={elapsed} />

        {/* Scan wedge */}
        <ScanWedge centerX={cx} centerY={cy} radius={radius} />

        {/* Central orb */}
        <CentralOrb centerX={cx} centerY={cy} />

        {/* City nodes */}
        <CityNodes hoveredIndex={null} setHoveredIndex={() => {}} elapsed={elapsed} />
      </svg>
    </div>
  );
}

function GlitchTitle({ text, className }) {
  const [display, setDisplay] = useState(text);
  const [phase, setPhase] = useState('idle');
  const [layer, setLayer] = useState({ r: '', c: '' });
  const timer = useRef(null);
  const interval = useRef(null);

  const runDecode = useCallback(() => {
    const totalDuration = 4000;
    const chars = text.split('');
    const startTime = performance.now();
    setPhase('decoding');
    interval.current = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / totalDuration, 1);
      const revealCount = Math.floor(progress * chars.length);
      const current = chars.map((c, i) => {
        if (i < revealCount) return c;
        return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
      });
      const r = chars.map((c, i) => {
        if (i < revealCount) return '';
        return CYBER_CHARS[Math.floor(Math.random() * CYBER_CHARS.length)];
      }).join('');
      const cLayer = chars.map((c, i) => {
        if (i < revealCount) return '';
        return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
      }).join('');
      setDisplay(current.join(''));
      setLayer({ r, c: cLayer });
      if (progress >= 1) {
        clearInterval(interval.current);
        setDisplay(text);
        setLayer({ r: '', c: '' });
        setPhase('idle');
        timer.current = setTimeout(runDecode, 5000 + Math.random() * 3000);
      }
    }, 50);
    return () => clearInterval(interval.current);
  }, [text]);

  useEffect(() => {
    timer.current = setTimeout(runDecode, 1500);
    return () => { clearTimeout(timer.current); if (interval.current) clearInterval(interval.current); };
  }, [runDecode]);

  const isGlitching = phase === 'decoding';

  return (
    <span className={`${className} relative inline-block whitespace-nowrap`} style={{ width: `${text.length}ch` }}>
      <span className="relative z-10">{display}</span>
      {isGlitching && (
        <>
          <span className="absolute inset-0 z-20 pointer-events-none select-none whitespace-nowrap"
            style={{ color: '#ef4444', opacity: 0.35, transform: 'translateX(-2px)', clipPath: 'inset(15% 0 45% 0)', filter: 'blur(0.5px)' }}>
            {layer.r || display}
          </span>
          <span className="absolute inset-0 z-20 pointer-events-none select-none whitespace-nowrap"
            style={{ color: '#3b82f6', opacity: 0.35, transform: 'translateX(2px)', clipPath: 'inset(55% 0 5% 0)', filter: 'blur(0.5px)' }}>
            {layer.c || display}
          </span>
        </>
      )}
    </span>
  );
}

function StatusTicker() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('es-CO', { hour12: false }));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <motion.div
      className="absolute top-0 left-0 right-0 z-30 px-6 md:px-8 py-2.5 flex items-center justify-between font-mono text-[9px] tracking-widest select-none"
      style={{ background: 'linear-gradient(180deg, rgba(7,27,53,0.95) 0%, transparent 100%)' }}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.6 }}
    >
      <div className="flex items-center gap-4 md:gap-6">
        <span className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          </span>
          <span className="text-emerald-400/80 hidden sm:inline">SISTEMA</span>
          <span className="text-emerald-400 font-bold">ONLINE</span>
        </span>
        <span className="text-slate-600/50">|</span>
        <span className="text-slate-300">
          <span className="text-cyan-400 font-bold tabular-nums">234</span>
          <span className="text-slate-400 ml-1">REPORTES</span>
        </span>
        <span className="text-slate-600/50 hidden md:inline">|</span>
        <span className="text-slate-400 hidden md:inline">
          <span className="text-red-400 font-bold tabular-nums">2</span>
          <span className="text-slate-500 ml-1">CRITICOS</span>
        </span>
        <span className="text-slate-600/50 hidden lg:inline">|</span>
        <span className="text-slate-400 hidden lg:inline">
          <span className="text-amber-400 font-bold tabular-nums">5</span>
          <span className="text-slate-500 ml-1">ALERTAS</span>
        </span>
      </div>
      <div className="flex items-center gap-3 md:gap-4">
        <span className="text-slate-400 tabular-nums">{time}</span>
        <span className="flex items-center gap-1.5 text-cyan-400/50">
          <span className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />
          <span className="hidden sm:inline text-[8px] tracking-[0.2em]">LIVE</span>
        </span>
      </div>
    </motion.div>
  );
}

function DataTicker() {
  return (
    <motion.div
      className="absolute bottom-0 left-0 right-0 z-30 overflow-hidden h-10 border-t border-cyan-400/10"
      style={{ background: 'linear-gradient(0deg, rgba(7,27,53,0.95) 0%, transparent 100%)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.8, duration: 0.6 }}
    >
      <div className="flex items-center h-full gap-8 font-mono text-[9px] text-cyan-400/30 tracking-wider whitespace-nowrap px-4"
        style={{ animation: 'ticker 30s linear infinite' }}>
        <span className="text-cyan-400/50">◆ SYS::REPORT_STREAM [234 ACTIVOS]</span>
        <span>◇ MEDELLIN: 234</span>
        <span>◇ BELLO: 87</span>
        <span>◇ ENVIGADO: 45</span>
        <span>◇ ITAGUE: 62</span>
        <span>◇ SABANETA: 28</span>
        <span>◇ LATENCY: 28MS</span>
        <span>◇ UPTIME: 99.97%</span>
        <span>◇ SENSORS: 1,247</span>
        <span>◇ COVERAGE: 100%</span>
      </div>
    </motion.div>
  );
}

function SeverityBar() {
  const counts = useMemo(() => ({
    critical: REPORT_ITEMS.filter(r => r.type === 'critical').length,
    warning: REPORT_ITEMS.filter(r => r.type === 'warning').length,
    info: REPORT_ITEMS.filter(r => r.type === 'info').length,
  }), []);
  return (
    <motion.div
      className="flex items-center gap-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.6 }}
    >
      <span className="font-mono text-[8px] text-slate-500 tracking-[0.25em] uppercase">Severidad</span>
      <div className="flex gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-50" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
          </span>
          <span className="font-mono text-[11px] text-red-400 font-bold tabular-nums">{counts.critical}</span>
          <span className="font-mono text-[7px] text-red-400/50 uppercase tracking-wider hidden sm:inline">critico</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_6px_rgba(234,179,8,0.6)]" />
          <span className="font-mono text-[11px] text-yellow-400 font-bold tabular-nums">{counts.warning}</span>
          <span className="font-mono text-[7px] text-yellow-400/50 uppercase tracking-wider hidden sm:inline">alerta</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)]" />
          <span className="font-mono text-[11px] text-cyan-400 font-bold tabular-nums">{counts.info}</span>
          <span className="font-mono text-[7px] text-cyan-400/50 uppercase tracking-wider hidden sm:inline">info</span>
        </div>
      </div>
    </motion.div>
  );
}

function RippleWave({ x, y, color }) {
  return (
    <div className="absolute pointer-events-none z-0" style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}>
      <div className="w-1 h-1 rounded-full" style={{ border: `1.5px solid ${color}80`, animation: 'rippleExpand 0.9s ease-out forwards', boxShadow: `0 0 6px ${color}40` }} />
      <div className="w-1 h-1 rounded-full absolute inset-0" style={{ border: `1px solid ${color}40`, animation: 'rippleExpand 0.9s ease-out 0.12s forwards' }} />
      <div className="w-1 h-1 rounded-full absolute inset-0" style={{ border: `0.5px solid ${color}20`, animation: 'rippleExpand 0.9s ease-out 0.24s forwards' }} />
    </div>
  );
}

function CollidingDots({ hoveredIndex, setHoveredIndex }) {
  const [ripples, setRipples] = useState([]);
  const dotsRef = useRef([]);
  const containerRef = useRef(null);
  const particlesRef = useRef(
    REPORT_ITEMS.map((r, i) => {
      const n = REPORT_ITEMS.length;
      const angle = (i / n) * 2 * Math.PI;
      const layer = 1 + (i % 3);
      const dist = 14 + layer * 8;
      const speed = 0.15 + (i % 5) * 0.04;
      return {
        x: 50 + dist * Math.cos(angle),
        y: 50 + dist * Math.sin(angle),
        vx: -Math.sin(angle) * speed,
        vy: Math.cos(angle) * speed,
        layer,
      };
    })
  );
  const lastCollision = useRef({});
  const rippleId = useRef(0);
  const frameRef = useRef(null);
  const ripplesRef = useRef([]);
  const rippleTimeouts = useRef(new Set());

  useEffect(() => {
    const COLLIDE_DIST = 5;
    const MAX_SPEED = 1.0;
    let lastTime = 0;
    let lastRippleUpdate = 0;
    const RIPPLE_THROTTLE = 100;

    const step = (now) => {
      if (now - lastTime < 32) {
        frameRef.current = requestAnimationFrame(step);
        return;
      }
      lastTime = now;
      const parts = particlesRef.current;

      for (const p of parts) {
        let dx = p.x - 50;
        let dy = p.y - 50;
        let dist = Math.hypot(dx, dy);
        if (dist < 0.5) dist = 0.5;
        const repel = 0.04 / (dist * 0.12 + 0.3);
        p.vx += (dx / dist) * repel;
        p.vy += (dy / dist) * repel;
      }

      for (const p of parts) {
        let dx = p.x - 50;
        let dy = p.y - 50;
        let dist = Math.hypot(dx, dy);
        if (dist < 0.5) dist = 0.5;
        const vortex = 0.008 / (dist * 0.02 + 0.3);
        p.vx += (-dy / dist) * vortex;
        p.vy += (dx / dist) * vortex;
      }

      for (const p of parts) {
        p.x += p.vx * 0.15;
        p.y += p.vy * 0.15;

        const spd = Math.hypot(p.vx, p.vy);
        if (spd > MAX_SPEED) {
          p.vx = (p.vx / spd) * MAX_SPEED;
          p.vy = (p.vy / spd) * MAX_SPEED;
        }

        if (p.x < 2) { p.x = 2; p.vx = Math.abs(p.vx) * 0.5; }
        if (p.x > 98) { p.x = 98; p.vx = -Math.abs(p.vx) * 0.5; }
        if (p.y < 2) { p.y = 2; p.vy = Math.abs(p.vy) * 0.5; }
        if (p.y > 98) { p.y = 98; p.vy = -Math.abs(p.vy) * 0.5; }
      }

      let hasNewRipple = false;
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
          const a = parts[i], b = parts[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          const key = `${i}-${j}`;
          const last = lastCollision.current[key] || 0;

          if (dist < COLLIDE_DIST && now - last > 700) {
            lastCollision.current[key] = now;

            const nx = dx / dist || 1;
            const ny = dy / dist || 0;

            const repelForce = 1.2;
            a.vx -= nx * repelForce;
            a.vy -= ny * repelForce;
            b.vx += nx * repelForce;
            b.vy += ny * repelForce;

            const scatter = 0.6 + Math.random() * 0.6;
            a.vx += (Math.random() - 0.5) * scatter;
            a.vy += (Math.random() - 0.5) * scatter;
            b.vx += (Math.random() - 0.5) * scatter;
            b.vy += (Math.random() - 0.5) * scatter;

            const overlap = COLLIDE_DIST - dist + 0.5;
            a.x -= nx * overlap / 2;
            a.y -= ny * overlap / 2;
            b.x += nx * overlap / 2;
            b.y += ny * overlap / 2;

            const midX = (a.x + b.x) / 2;
            const midY = (a.y + b.y) / 2;
            const id = rippleId.current++;
            const hex = COLORS[REPORT_ITEMS[i].type].hex;
            ripplesRef.current = [...ripplesRef.current, { id, x: midX, y: midY, hex }];
            hasNewRipple = true;
            const tid = setTimeout(() => {
              rippleTimeouts.current.delete(tid);
              ripplesRef.current = ripplesRef.current.filter(r => r.id !== id);
              setRipples([...ripplesRef.current]);
            }, 950);
            rippleTimeouts.current.add(tid);
          }
        }
      }

      if (hasNewRipple && now - lastRippleUpdate > RIPPLE_THROTTLE) {
        lastRippleUpdate = now;
        setRipples([...ripplesRef.current]);
      }

      for (let i = 0; i < parts.length; i++) {
        const el = dotsRef.current[i];
        if (el) {
          el.style.transform = `translate(${parts[i].x}%, ${parts[i].y}%) translate(-50%, -50%)`;
        }
      }

      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frameRef.current);
      rippleTimeouts.current.forEach(tid => clearTimeout(tid));
      rippleTimeouts.current.clear();
    };
  }, []);

  return (
    <>
      {ripples.map(r => (
        <RippleWave key={r.id} x={r.x} y={r.y} color={r.hex} />
      ))}
      <div ref={containerRef}>
        {REPORT_ITEMS.map((report, i) => {
          const c = COLORS[report.type];
          const isHovered = hoveredIndex === i;
          return (
            <div key={`m-${i}`} className="absolute z-10"
              ref={el => { dotsRef.current[i] = el; }}
              style={{ left: 0, top: 0, transform: `translate(${particlesRef.current[i].x}%, ${particlesRef.current[i].y}%) translate(-50%, -50%)` }}
              onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)}>
              <div className={`relative cursor-pointer transition-all duration-200 ${isHovered ? 'scale-125' : ''}`}>
                <div className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: c.hex, boxShadow: `0 0 8px ${c.hex}80` }}>
                  {isHovered && (
                    <span className="absolute -inset-2 rounded-full border" style={{ borderColor: `${c.hex}80` }} />
                  )}
                </div>
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap pointer-events-none">
                <AnimatePresence>
                  {isHovered && (
                    <motion.div initial={{ opacity: 0, y: -4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.95 }}
                      transition={{ duration: 0.12 }}
                      className="bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700/50 shadow-lg">
                      <span className={`text-[7px] font-mono tracking-widest px-1.5 py-0.5 rounded ${c.bg} ${c.text} border ${c.border} mr-1.5`}>{c.badge}</span>
                      <span className="font-mono text-[11px] text-slate-200">{report.text}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default React.memo(function ReportsSection() {
  const { config } = useDevicePerformance();
  const [reportCount, setReportCount] = useState(234);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const displayCount = useCountUp(reportCount);

  useEffect(() => {
    const t = setInterval(() => setReportCount(n => Math.min(n + Math.floor(Math.random() * 3), 99999)), 2500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const start = performance.now();
    const throttleMs = 50;
    let raf;
    let lastUpdate = 0;
    const step = (now) => {
      const t = now - start;
      if (t - lastUpdate > throttleMs) {
        lastUpdate = t;
        setElapsed(t);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="w-full h-full relative flex items-center justify-center overflow-hidden bg-[#071B35]">
      <style>{`
        @keyframes rippleExpand {
          0% { transform: scale(0); opacity: 0.6; width: 2px; height: 2px; }
          100% { transform: scale(12); opacity: 0; width: 2px; height: 2px; }
        }
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes voiceBar {
          0%, 100% { transform: scaleY(0.3); opacity: 0.15; }
          50% { transform: scaleY(1); opacity: 0.5; }
        }
      `}</style>
      <StatusTicker />
      <DataTicker />

      <div className="absolute inset-0 cartographic-grid opacity-[0.08] pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(34,211,238,0.06) 2px, rgba(34,211,238,0.06) 4px)' }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 40%, rgba(34,211,238,0.04) 0%, transparent 60%), radial-gradient(ellipse at 80% 60%, rgba(59,130,246,0.03) 0%, transparent 50%), radial-gradient(ellipse at 20% 30%, rgba(20,184,166,0.02) 0%, transparent 40%)'
      }} />

      <HoloHub elapsed={elapsed} />

      {config.collidingDots && <CollidingDots hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} />}

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 z-10 pointer-events-none opacity-30">
        <div className="flex items-end justify-center gap-[3px] h-16 w-64">
          {VOICE_BARS.map((bar, i) => (
            <div key={i} className="w-[3px] rounded-full bg-gradient-to-t from-cyan-500/40 to-cyan-300/60"
              style={{
                height: `${bar.height}px`,
                animation: `voiceBar ${bar.dur}s ease-in-out ${bar.delay}s infinite alternate`,
                transformOrigin: 'bottom',
              }}
            />
          ))}
        </div>
      </div>

      <div className="z-20 pointer-events-none text-center px-6 flex flex-col items-center">
        <motion.h2 className="text-6xl md:text-8xl lg:text-9xl font-['Space_Grotesk'] font-bold mb-4 drop-shadow-[0_0_40px_rgba(34,211,238,0.15)]"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}>
          <GlitchTitle text="La ciudad habla" />
        </motion.h2>
        <motion.p className="text-slate-400 text-lg md:text-xl lg:text-2xl max-w-2xl mx-auto font-light mb-6 tracking-wide"
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.8 }}>
          Valle de Aburrá — transmisiones en tiempo real.
        </motion.p>
      </div>

      <div className="absolute bottom-14 md:bottom-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 md:gap-6">
        <motion.div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#0A1A30]/80 border border-cyan-400/10"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 150, damping: 15 }}>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
          </span>
          <span className="font-mono text-xs md:text-sm text-slate-300 tracking-widest">
            <strong className="text-white text-base md:text-lg tabular-nums font-bold">{displayCount.toLocaleString()}</strong>
            <span className="ml-1.5 text-slate-400">reportes hoy</span>
          </span>
        </motion.div>
        <SeverityBar />
      </div>
    </div>
  );
});
