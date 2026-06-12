import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';

// ── Canvas: underwater effects ──────────────────────────────────────────
function WaterCanvas() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    let rafId;
    let bubbles = [], biolum = [], fish = [];
    const WAVE_SEG = 100;

    const resize = () => {
      const p = canvas.parentElement;
      canvas.width = p.offsetWidth;
      canvas.height = p.offsetHeight;
      init();
    };

    const init = () => {
      const w = canvas.width, h = canvas.height;
      bubbles = Array.from({ length: 60 }, () => ({
        x: Math.random() * w, y: h + Math.random() * h * 0.5,
        size: 0.8 + Math.random() * 5,
        speed: 0.3 + Math.random() * 0.8,
        drift: (Math.random() - 0.5) * 0.4,
        wobble: 0.02 + Math.random() * 0.03,
        phase: Math.random() * Math.PI * 2,
      }));
      biolum = Array.from({ length: 60 }, () => ({
        x: Math.random() * w, y: h * 0.5 + Math.random() * h * 0.5,
        size: 0.5 + Math.random() * 2.2,
        speed: -(0.1 + Math.random() * 0.3),
        drift: (Math.random() - 0.5) * 0.3,
        alphaSpd: 0.002 + Math.random() * 0.004,
        phase: Math.random() * Math.PI * 2,
        color: ['#22D3EE','#34D399','#67E8F9'][Math.floor(Math.random() * 3)],
      }));
      fish = Array.from({ length: 6 }, () => ({
        x: Math.random() * w, y: h * 0.2 + Math.random() * h * 0.6,
        size: 4 + Math.random() * 8,
        speed: (0.3 + Math.random() * 0.5) * (Math.random() > 0.5 ? 1 : -1),
        alpha: 0.06 + Math.random() * 0.04,
      }));
    };

    const draw = (time) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width, h = canvas.height;
      const t = time * 0.001;

      // ── Surface wave ──
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let i = 0; i <= WAVE_SEG; i++) {
        const x = (i / WAVE_SEG) * w;
        const y = 8 + Math.sin(x * 0.02 + t * 2) * 5 + Math.sin(x * 0.01 + t * 1.3) * 3;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, 0);
      ctx.closePath();
      const wGrad = ctx.createLinearGradient(0, 0, 0, 50);
      wGrad.addColorStop(0, 'rgba(34,211,238,0.025)');
      wGrad.addColorStop(0.4, 'rgba(34,211,238,0.008)');
      wGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = wGrad;
      ctx.fill();

      // ── Light rays ──
      const rays = [
        { x: 0.3, a: 80, o: 0.04 }, { x: 0.45, a: 100, o: 0.03 },
        { x: 0.55, a: 75, o: 0.025 }, { x: 0.65, a: 110, o: 0.02 },
      ];
      for (const r of rays) {
        const angle = (r.a + Math.sin(t * r.x * 0.8 + r.x) * 5) * Math.PI / 180;
        ctx.save();
        ctx.translate(w * r.x, 0);
        ctx.rotate(angle);
        const g = ctx.createLinearGradient(-w*0.25, 0, w*0.25, 0);
        g.addColorStop(0, 'transparent');
        g.addColorStop(0.4, `rgba(34,211,238,${r.o*0.5})`);
        g.addColorStop(0.5, `rgba(34,211,238,${r.o})`);
        g.addColorStop(0.6, `rgba(34,211,238,${r.o*0.5})`);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fillRect(-w*0.25, -h*0.5, w*0.5, h*2);
        ctx.restore();
      }

      // ── Sonar ──
      for (let i = 0; i < 3; i++) {
        const cycle = 2.8;
        const offset = cycle / 3 * i;
        let p = ((t - offset) % cycle + cycle) % cycle / cycle;
        const alpha = Math.max(0, (1 - p) * 0.2);
        if (alpha > 0.001) {
          ctx.beginPath();
          ctx.arc(w / 2, h / 2, 10 + p * 440, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(34,211,238,${alpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // ── Caustic floor ──
      const spots = [
        { x: 0.3, y: 0.85, p: 0, ox: 0.06, s: 0.25, a: 0.04 },
        { x: 0.65, y: 0.8, p: 1.5, ox: 0.05, s: 0.18, a: 0.025 },
        { x: 0.5, y: 0.92, p: 0, ox: 0.1, s: 0.35, a: 0.02 },
      ];
      for (const s of spots) {
        const cx = w * (s.x + Math.sin(t * 0.8 + s.p) * s.ox);
        const cy = h * s.y;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * s.s);
        g.addColorStop(0, `rgba(34,211,238,${s.a})`);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      // ── Bubbles ──
      for (const b of bubbles) {
        b.y -= b.speed;
        b.x += Math.sin(t * b.wobble * 10 + b.phase) * b.drift;
        if (b.y < -20) { b.y = h + 20; b.x = Math.random() * w; }

        ctx.beginPath();
        ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(34,211,238,0.08)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        if (b.size > 2) {
          const g = ctx.createRadialGradient(b.x - b.size*0.3, b.y - b.size*0.3, 0, b.x, b.y, b.size);
          g.addColorStop(0, 'rgba(34,211,238,0.03)');
          g.addColorStop(1, 'transparent');
          ctx.fillStyle = g;
          ctx.fill();
        }
      }

      // ── Bioluminescence ──
      for (const p of biolum) {
        p.y += p.speed;
        p.x += p.drift * Math.sin(t + p.phase);
        if (p.y < -10) { p.y = h * 0.5 + Math.random() * h * 0.5; p.x = Math.random() * w; }

        const alpha = 0.3 + Math.sin(t * p.alphaSpd * 100 + p.phase) * 0.3;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.size * 5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, Math.min(alpha, 0.7));
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;

      // ── Fish ──
      for (const f of fish) {
        f.x += f.speed;
        if (f.speed > 0 && f.x > w + 50) { f.x = -50; f.y = 0.2*h + Math.random() * 0.6*h; }
        if (f.speed < 0 && f.x < -50) { f.x = w + 50; f.y = 0.2*h + Math.random() * 0.6*h; }

        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.scale(f.speed > 0 ? 1 : -1, 1);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(f.size * 0.6, -f.size * 0.35, f.size * 1.4, 0);
        ctx.quadraticCurveTo(f.size * 0.6, f.size * 0.35, 0, 0);
        ctx.fillStyle = `rgba(34,211,238,${f.alpha})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(f.size * 1.1, 0, Math.max(0.5, f.size * 0.08), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34,211,238,${f.alpha * 2})`;
        ctx.fill();
        ctx.restore();
      }

      rafId = requestAnimationFrame(draw);
    };

    init();
    window.addEventListener('resize', resize);
    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 pointer-events-none z-0" />;
}

// ── CSS Animated Bars ───────────────────────────────────────────────────
function AnimatedBars({ count = 8, color = '#22D3EE', height = 40 }) {
  return (
    <div className="flex items-end gap-[3px]" style={{ height }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="w-[3px] rounded-t-sm bar-pulse"
          style={{
            backgroundColor: color,
            animationDelay: `${i * 0.08}s`,
            animationDuration: `${0.8 + (i % 4) * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}

// ── Count-up ───────────────────────────────────────────────────────────
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
        <linearGradient id={`sg-${color.replace('#','')}-${Math.random().toString(36).slice(2,6)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.08" />
      <polygon points={`${pts} ${width},${height} 0,${height}`} fill="transparent" opacity="0.6" />
    </svg>
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

      {/* Background water gradient */}
      <div className="absolute inset-0 pointer-events-none"
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

      <WaterCanvas />

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

          <div className="sm:col-span-2 lg:col-span-3">
            <MetricCard label="Flujo de Eventos" value={dEvents.toLocaleString()} unit="ev/s" color="#22D3EE" sparkData={sparkEvents} delay={0.2}>
              <AnimatedBars count={12} color="#22D3EE" height={44} />
            </MetricCard>
          </div>

          <MetricCard label="GPS Activos" value={dGps.toString()} unit="señales" color="#34D399" sparkData={sparkGps} delay={0.35}>
            <AnimatedBars count={6} color="#34D399" height={32} />
          </MetricCard>

          <MetricCard label="Alertas Hoy" value={dAlerts.toString()} unit="eventos" color="#FBBF24" sparkData={sparkAlerts} delay={0.45}>
            <AnimatedBars count={6} color="#FBBF24" height={32} />
          </MetricCard>

          <MetricCard label="Latencia de Red" value="28" unit="ms" color="#A78BFA" delay={0.55}>
            <AnimatedBars count={6} color="#A78BFA" height={32} />
          </MetricCard>

          <MetricCard label="Satélites en Vista" value="14" unit="activos" color="#67E8F9" delay={0.65}>
            <AnimatedBars count={6} color="#67E8F9" height={32} />
          </MetricCard>

          <MetricCard label="Throughput" value="1.2" unit="Gbps" color="#22D3EE" delay={0.75} />

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