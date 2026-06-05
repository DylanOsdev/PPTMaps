import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';

// ── Light Rays (sun shafts through water) ────────────────────────────
function LightRays() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setT(n => n + 0.008), 50);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-full opacity-[0.04]"
        style={{
          background: `
            linear-gradient(${80 + Math.sin(t) * 5}deg, transparent 30%, rgba(34,211,238,0.04) 35%, transparent 38%),
            linear-gradient(${100 + Math.sin(t * 0.8 + 1) * 4}deg, transparent 45%, rgba(34,211,238,0.03) 49%, transparent 52%),
            linear-gradient(${75 + Math.sin(t * 0.6 + 2) * 6}deg, transparent 55%, rgba(34,211,238,0.025) 58%, transparent 62%),
            linear-gradient(${110 + Math.sin(t * 0.9 + 3) * 3}deg, transparent 65%, rgba(34,211,238,0.02) 68%, transparent 72%)
          `,
          filter: 'blur(12px)',
        }}
      />
    </div>
  );
}

// ── Bubbles ────────────────────────────────────────────────────────────
function Bubbles() {
  const items = useMemo(() =>
    Array.from({ length: 60 }, (_, i) => ({
      x: 2 + Math.random() * 96,
      size: 0.8 + Math.random() * 5,
      dur: 6 + Math.random() * 18,
      delay: -Math.random() * 25,
      driftAmt: (Math.random() - 0.5) * 6,
      wobbleSpeed: 0.6 + Math.random() * 0.7,
    })), []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {items.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${b.x}%`,
            width: b.size, height: b.size,
            border: b.size > 2 ? '0.5px solid rgba(34,211,238,0.1)' : 'none',
            background: `radial-gradient(circle at 35% 30%, rgba(34,211,238,${0.02 + b.size * 0.008}), transparent)`,
            boxShadow: b.size > 3 ? `inset 0 0 ${b.size}px rgba(34,211,238,0.03)` : 'none',
          }}
          animate={{
            y: ['110vh', '-10vh'],
            x: [0, b.driftAmt, -b.driftAmt * 0.7, b.driftAmt * 0.4, 0],
          }}
          transition={{
            y: { duration: b.dur, repeat: Infinity, delay: b.delay, ease: 'linear' },
            x: { duration: b.dur * b.wobbleSpeed, repeat: Infinity, delay: b.delay, ease: 'easeInOut' },
          }}
        />
      ))}
    </div>
  );
}

// ── Sonar Ping ─────────────────────────────────────────────────────────
function SonarPing() {
  const [key, setKey] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setKey(k => k + 1), 2800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
      {[0, 0.5, 1.1].map((delay, i) => (
        <motion.div
          key={`${key}-${i}`}
          className="absolute rounded-full"
          style={{
            width: 20, height: 20,
            border: `1px solid rgba(34,211,238,${0.1 - i * 0.03})`,
          }}
          animate={{ width: [20, 900], height: [20, 900], opacity: [0.25 - i * 0.05, 0] }}
          transition={{ duration: 2.8, ease: 'easeOut', delay }}
        />
      ))}
    </div>
  );
}

// ── Bioluminescence ────────────────────────────────────────────────────
function Bioluminescence() {
  const particles = useMemo(() =>
    Array.from({ length: 60 }, () => ({
      x: Math.random() * 100,
      y: 50 + Math.random() * 50,
      size: 0.5 + Math.random() * 2.2,
      dur: 3 + Math.random() * 7,
      delay: Math.random() * 10,
      driftX: (Math.random() - 0.5) * 3,
      color: Math.random() < 0.4 ? '#22D3EE' : Math.random() < 0.3 ? '#34D399' : '#67E8F9',
    })), []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`, top: `${p.y}%`,
            width: p.size, height: p.size,
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size * 5}px ${p.color}50, 0 0 ${p.size * 10}px ${p.color}20`,
          }}
          animate={{
            y: [0, -60 - Math.random() * 40, 0],
            x: [0, p.driftX, 0],
            opacity: [0, 0.7, 0],
          }}
          transition={{
            duration: p.dur,
            repeat: Infinity,
            delay: p.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// ── Caustic Light Floor ────────────────────────────────────────────────
function CausticFloor() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setT(n => n + 0.012), 50);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        className="absolute bottom-0 left-0 right-0 h-[55%] opacity-[0.06]"
        style={{
          background: `
            radial-gradient(ellipse 25% 12% at ${30 + Math.sin(t) * 6}% 85%, rgba(34,211,238,0.2) 0%, transparent 60%),
            radial-gradient(ellipse 18% 8% at ${65 + Math.sin(t + 1.5) * 5}% 80%, rgba(34,211,238,0.15) 0%, transparent 50%),
            radial-gradient(ellipse 35% 10% at ${50 + Math.sin(t * 0.7) * 10}% 92%, rgba(34,211,238,0.1) 0%, transparent 50%),
            radial-gradient(ellipse 15% 6% at ${20 + Math.sin(t * 0.5 + 2) * 8}% 75%, rgba(34,211,238,0.12) 0%, transparent 50%)
          `,
          filter: 'blur(25px)',
        }}
      />
    </div>
  );
}

// ── Deep Water Gradient ────────────────────────────────────────────────
function WaterGradient() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(180deg,
              rgba(6,78,102,0.12) 0%,
              rgba(2,6,23,0) 30%,
              rgba(2,6,23,0) 60%,
              rgba(6,78,102,0.08) 80%,
              rgba(15,118,110,0.1) 100%
            )
          `,
        }}
      />
    </div>
  );
}

// ── Surface Wave ───────────────────────────────────────────────────────
function SurfaceWave() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setT(n => n + 0.02), 50);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="absolute top-0 left-0 right-0 h-16 pointer-events-none overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-full"
        style={{
          background: `
            linear-gradient(180deg,
              rgba(34,211,238,0.025) 0%,
              rgba(34,211,238,0.008) 40%,
              transparent 100%
            )
          `,
          maskImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 64'%3E%3Cpath d='M0,32 C200,${
            8 + Math.sin(t) * 6
          } 400,${
            56 - Math.sin(t * 0.7) * 6
          } 600,${
            32 + Math.sin(t * 0.5 + 1) * 8
          } C800,${
            8 + Math.sin(t * 0.8 + 2) * 5
          } 1000,${
            56 - Math.sin(t * 0.6) * 5
          } 1200,32 L1200,0 L0,0 Z' fill='white'/%3E%3C/svg%3E")`,
          WebkitMaskImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 64'%3E%3Cpath d='M0,32 C200,${
            8 + Math.sin(t) * 6
          } 400,${
            56 - Math.sin(t * 0.7) * 6
          } 600,${
            32 + Math.sin(t * 0.5 + 1) * 8
          } C800,${
            8 + Math.sin(t * 0.8 + 2) * 5
          } 1000,${
            56 - Math.sin(t * 0.6) * 5
          } 1200,32 L1200,0 L0,0 Z' fill='white'/%3E%3C/svg%3E")`,
          maskSize: '1200px 64px',
          WebkitMaskSize: '1200px 64px',
          maskRepeat: 'repeat-x',
          WebkitMaskRepeat: 'repeat-x',
        }}
      />
    </div>
  );
}

// ── Shadow Fish ────────────────────────────────────────────────────────
function ShadowFish() {
  const fish = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => ({
      x: Math.random() * 100,
      y: 20 + Math.random() * 60,
      size: 4 + Math.random() * 8,
      dur: 14 + Math.random() * 20,
      delay: -Math.random() * 25,
      dir: Math.random() > 0.5 ? 1 : -1,
    })), []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {fish.map((f, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ top: `${f.y}%`, left: `${f.x}%` }}
          animate={{
            x: f.dir === 1 ? [0, 120] : [0, -120],
            opacity: [0, 0.15, 0.15, 0],
          }}
          transition={{
            x: { duration: f.dur, repeat: Infinity, delay: f.delay, ease: 'linear' },
            opacity: { duration: f.dur, repeat: Infinity, delay: f.delay, ease: 'linear', times: [0, 0.1, 0.8, 1] },
          }}
        >
          <svg width={f.size * 3} height={f.size} viewBox="0 0 30 10" className={`${f.dir === -1 ? 'scale-x-[-1]' : ''}`}>
            <path
              d={`M${f.dir === 1 ? 0 : 30},5 Q${f.size * 0.5},${2} ${f.size * 1.2},${5} Q${f.size * 0.5},${8} ${f.dir === 1 ? 0 : 30},${5}`}
              fill="rgba(34,211,238,0.06)"
            />
            <circle cx={f.dir === 1 ? f.size * 2 : f.size} cy="5" r="0.8" fill="rgba(34,211,238,0.1)" />
          </svg>
        </motion.div>
      ))}
    </div>
  );
}

// ── Count-up ──────────────────────────────────────────────────────────
function useCountUp(target, duration = 1200) {
  const [display, setDisplay] = useState(target);
  const prev = useRef(target);
  const raf = useRef(null);
  useEffect(() => {
    if (target === prev.current) return;
    const start = performance.now();
    const from = prev.current;
    prev.current = target;
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return display;
}

// ── Sparkline ─────────────────────────────────────────────────────────
function Sparkline({ data, color, height = 32, width = 120 }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.08" />
      <polygon points={`${pts} ${width},${height} 0,${height}`} fill="url(#sparkGrad)" opacity="0.6" />
    </svg>
  );
}

// ── Animated Bars ─────────────────────────────────────────────────────
function AnimatedBars({ count = 8, color = '#22D3EE', height = 40 }) {
  return (
    <div className="flex items-end gap-[3px]" style={{ height }}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-t-sm"
          style={{ backgroundColor: color }}
          animate={{
            height: [`${15 + (i % 5) * 10}%`, `${40 + (i % 3) * 20}%`, `${15 + (i % 5) * 10}%`],
          }}
          transition={{
            duration: 0.8 + (i % 4) * 0.2,
            repeat: Infinity,
            delay: i * 0.08,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// ── Metric Card ───────────────────────────────────────────────────────
function MetricCard({ label, value, unit, color = '#22D3EE', sparkData, children, delay = 0 }) {
  return (
    <motion.div
      className="relative rounded-2xl backdrop-blur-xl bg-white/[0.02] border border-white/[0.05] overflow-hidden group"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
      <div className="relative p-5 md:p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}60` }} />
          <span className="font-mono text-[9px] md:text-[10px] tracking-[0.2em] uppercase" style={{ color: `${color}99` }}>
            {label}
          </span>
        </div>
        <div className="flex items-end justify-between gap-4">
          <div className="flex items-end gap-2">
            <span className="text-3xl md:text-4xl lg:text-5xl font-bold font-['Space_Grotesk'] leading-none tracking-tight"
              style={{ color, textShadow: `0 0 20px ${color}30` }}>
              {value}
            </span>
            <span className="font-mono text-[9px] md:text-[10px] mb-1" style={{ color: `${color}40` }}>{unit}</span>
          </div>
          {children}
        </div>
        {sparkData && (
          <div className="mt-3 h-8">
            <Sparkline data={sparkData} color={color} />
          </div>
        )}
      </div>
      <div className="absolute -bottom-10 -right-10 w-20 h-20 rounded-full opacity-[0.03]" style={{ background: `radial-gradient(circle, ${color}, transparent)` }} />
    </motion.div>
  );
}

// ── Clock ─────────────────────────────────────────────────────────────
function Clock() {
  const [t, setT] = useState('');
  useEffect(() => {
    const u = () => setT(new Date().toLocaleTimeString('es-CO', { hour12: false }));
    u(); const i = setInterval(u, 1000);
    return () => clearInterval(i);
  }, []);
  return <span className="font-mono text-sm md:text-base text-cyan-400/40 tabular-nums tracking-wider">{t}</span>;
}

// ── Main ──────────────────────────────────────────────────────────────
export default React.memo(function TelemetrySection() {
  const [events, setEvents] = useState(12847);
  const [gps, setGps] = useState(847);
  const [alerts, setAlerts] = useState(234);

  useEffect(() => {
    const t = setInterval(() => {
      setEvents(n => Math.max(12000, n + Math.floor(Math.random() * 9) - 3));
      setGps(n => Math.max(820, Math.min(870, n + Math.floor(Math.random() * 6) - 2)));
      setAlerts(n => n + Math.floor(Math.random() * 2));
    }, 2800);
    return () => clearInterval(t);
  }, []);

  const dEvents = useCountUp(events);
  const dGps = useCountUp(gps);
  const dAlerts = useCountUp(alerts);

  const sparkEvents = [12400, 12600, 12500, 12700, 12800, 12750, 12847, 12830, 12860, 12840, 12855, 12847, 12852];
  const sparkGps = [820, 835, 840, 830, 845, 847, 840, 850, 845, 847, 843];
  const sparkAlerts = [228, 230, 229, 231, 232, 230, 233, 234, 233, 234, 235];

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden bg-[#021A26] select-none">

      <WaterGradient />
      <LightRays />
      <CausticFloor />
      <SurfaceWave />
      <Bubbles />
      <Bioluminescence />
      <ShadowFish />
      <SonarPing />

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 50%, transparent 20%, rgba(2,26,38,0.7) 100%)' }} />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-6 md:px-8 py-3 md:py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-300 animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
            <span className="font-mono text-[9px] md:text-[11px] text-cyan-400/60 tracking-[0.3em] uppercase font-bold">En Vivo</span>
          </div>
          <span className="text-slate-700 text-[11px] hidden sm:inline">|</span>
          <span className="font-mono text-[8px] md:text-[9px] text-slate-500 tracking-[0.2em] hidden sm:inline">Valle de Aburrá</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[8px] text-cyan-400/20 tracking-[0.2em] hidden sm:inline">SAT-NET v2.4.1</span>
          <Clock />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 md:px-6 flex flex-col h-full justify-center">

        {/* Title */}
        <div className="text-center mb-8 md:mb-10">
          <motion.p
            className="font-mono text-[9px] md:text-[11px] text-cyan-400/40 tracking-[0.5em] uppercase mb-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          >
            Cobertura Satelital · Centro de Control
          </motion.p>
          <motion.h2
            className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-['Space_Grotesk'] font-bold tracking-tight leading-none"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="text-white">Red</span>{' '}
            <span className="text-cyan-400" style={{ textShadow: '0 0 40px rgba(34,211,238,0.3), 0 0 80px rgba(34,211,238,0.1)' }}>Satelital</span>
          </motion.h2>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">

          {/* Eventos - full width */}
          <div className="sm:col-span-2 lg:col-span-3">
            <MetricCard label="Flujo de Eventos" value={dEvents.toLocaleString()} unit="ev/s" color="#22D3EE" sparkData={sparkEvents} delay={0.2}>
              <AnimatedBars count={12} color="#22D3EE" height={44} />
            </MetricCard>
          </div>

          {/* GPS */}
          <MetricCard label="GPS Activos" value={dGps.toString()} unit="señales" color="#34D399" sparkData={sparkGps} delay={0.35}>
            <AnimatedBars count={6} color="#34D399" height={32} />
          </MetricCard>

          {/* Alertas */}
          <MetricCard label="Alertas Hoy" value={dAlerts.toString()} unit="eventos" color="#FBBF24" sparkData={sparkAlerts} delay={0.45}>
            <AnimatedBars count={6} color="#FBBF24" height={32} />
          </MetricCard>

          {/* Latencia */}
          <MetricCard label="Latencia de Red" value="28" unit="ms" color="#A78BFA" delay={0.55}>
            <AnimatedBars count={6} color="#A78BFA" height={32} />
          </MetricCard>

          {/* Satélites */}
          <MetricCard label="Satélites en Vista" value="14" unit="activos" color="#67E8F9" delay={0.65}>
            <AnimatedBars count={6} color="#67E8F9" height={32} />
          </MetricCard>

          {/* Throughput */}
          <MetricCard label="Throughput" value="1.2" unit="Gbps" color="#22D3EE" delay={0.75} />

          {/* Uptime */}
          <MetricCard label="Tiempo Activo" value="99.97" unit="%" color="#34D399" delay={0.85} />

        </div>

        {/* Bottom status */}
        <motion.div
          className="mt-5 pt-3 border-t border-white/[0.03] flex items-center justify-between font-mono text-[7px] md:text-[8px] text-slate-600/60 uppercase tracking-widest"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
        >
          <span>Uptime 99.97% · Latencia 28ms · Throughput 1.2 Gbps · 0.03% pérdida</span>
          <span className="hidden sm:inline">Cluster Aburrá · SAT-NET v2.4.1</span>
        </motion.div>

      </div>
    </div>
  );
});
