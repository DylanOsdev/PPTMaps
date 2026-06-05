import React, { useMemo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

// ── Digital Rain ──────────────────────────────────────────────────────
const CHARS = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789";

function createRainDrop() {
  const len = 6 + Math.floor(Math.random() * 12);
  const chars = Array.from({ length: len }, () => CHARS[Math.floor(Math.random() * CHARS.length)]);
  return {
    x: Math.random() * 100,
    delay: Math.random() * 4,
    speed: 0.3 + Math.random() * 0.5,
    chars,
    head: Math.floor(Math.random() * len),
  };
}

function RainColumn({ drop }) {
  return (
    <div
      className="absolute top-0"
      style={{ left: `${drop.x}%`, width: 14, overflow: 'visible' }}
    >
      <motion.div
        className="flex flex-col items-center"
        initial={{ y: '-100%' }}
        animate={{ y: '200vh' }}
        transition={{
          duration: 8 / drop.speed,
          repeat: Infinity,
          delay: drop.delay,
          ease: 'linear',
        }}
      >
        {drop.chars.map((ch, i) => (
          <span
            key={i}
            className="font-mono text-[7px] md:text-[9px] leading-none"
            style={{
              color: i === drop.head ? '#67e8f9' : i > drop.head - 3 ? '#22D3EE' : '#22D3EE',
              opacity: i === drop.head ? 1 : i > drop.head - 3 ? 0.6 : 0.15 + (drop.chars.length - i) / drop.chars.length * 0.2,
              textShadow: i === drop.head ? '0 0 8px #22D3EE, 0 0 20px #22D3EE' : '0 0 4px #22D3EE',
            }}
          >
            {ch}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

function DigitalRain() {
  const drops = useMemo(() =>
    Array.from({ length: 30 }, () => createRainDrop()), []);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {drops.map((drop, i) => (
        <RainColumn key={i} drop={drop} />
      ))}
    </div>
  );
}

// ── Particles ─────────────────────────────────────────────────────────
function Dust() {
  const p = useMemo(() =>
    Array.from({ length: 30 }, () => ({
      x: Math.random() * 100, y: Math.random() * 100,
      size: 0.5 + Math.random() * 1.5,
      dur: 6 + Math.random() * 6, delay: Math.random() * 5,
      dx: (Math.random() - 0.5) * 15, dy: -(Math.random() * 10 + 3),
    })), []);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {p.map((pt, i) => (
        <motion.div key={i} className="absolute rounded-full"
          style={{ left: `${pt.x}%`, top: `${pt.y}%`, width: pt.size, height: pt.size, backgroundColor: '#22D3EE' }}
          animate={{ opacity: [0, 0.3, 0], x: [0, pt.dx], y: [0, pt.dy] }}
          transition={{ duration: pt.dur, repeat: Infinity, delay: pt.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

// ── Scan line ─────────────────────────────────────────────────────────
function Scanline() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <motion.div
        className="absolute left-0 right-0 h-[1px]"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(34,211,238,0.08) 30%, rgba(34,211,238,0.15) 50%, rgba(34,211,238,0.08) 70%, transparent 100%)',
          filter: 'blur(1px)',
        }}
        animate={{ top: ['-5%', '105%'] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

// ── Horizontal glitch bars ────────────────────────────────────────────
function GlitchBars() {
  const bars = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      top: Math.random() * 100,
      height: 1 + Math.random() * 3,
      delay: Math.random() * 5,
      dur: 0.1 + Math.random() * 0.3,
    })), []);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {bars.map((b, i) => (
        <motion.div
          key={i}
          className="absolute left-0 right-0 bg-[#22D3EE]"
          style={{ top: `${b.top}%`, height: b.height, opacity: 0.04 }}
          animate={{ opacity: [0, 0.08, 0] }}
          transition={{ duration: b.dur, repeat: Infinity, delay: b.delay, ease: 'steps(2)' }}
        />
      ))}
    </div>
  );
}

// ── Typing text ───────────────────────────────────────────────────────
function Typewriter({ text, delay = 0, className = "", style = {} }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    const t = setTimeout(() => {
      const interval = setInterval(() => {
        setDisplayed(text.slice(0, i + 1));
        i++;
        if (i >= text.length) { clearInterval(interval); setDone(true); }
      }, 30);
      return () => clearInterval(interval);
    }, delay * 1000);
    return () => clearTimeout(t);
  }, [text, delay]);

  return (
    <span className={className} style={style}>
      {displayed}
      {!done && <span className="animate-pulse" style={{ color: '#22D3EE' }}>_</span>}
    </span>
  );
}

// ── Stat counter ──────────────────────────────────────────────────────
function Counter({ to, suffix = "", label, delay = 0 }) {
  const [v, setV] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      let start = 0;
      const step = Math.ceil(to / 40);
      const interval = setInterval(() => {
        start += step;
        if (start >= to) { setV(to); clearInterval(interval); }
        else setV(start);
      }, 40);
      return () => clearInterval(interval);
    }, delay * 1000);
    return () => clearTimeout(t);
  }, [to, delay]);

  return (
    <div className="flex flex-col items-center">
      <span className="text-xl md:text-3xl font-bold font-['Space_Grotesk']" style={{ color: '#22D3EE', textShadow: '0 0 20px rgba(34,211,238,0.3)' }}>
        {v}{suffix}
      </span>
      <span className="text-[7px] md:text-[9px] font-mono tracking-[0.2em]" style={{ color: 'rgba(34,211,238,0.5)' }}>{label}</span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────
export default React.memo(function BackendSection() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden select-none"
      style={{ backgroundColor: '#041327' }}
    >
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 60% 50% at 50% 60%, rgba(34,211,238,0.04) 0%, transparent 60%),
            radial-gradient(ellipse 80% 60% at 30% 30%, rgba(34,211,238,0.02) 0%, transparent 50%),
            radial-gradient(ellipse 100% 50% at 50% 100%, rgba(34,211,238,0.02) 0%, transparent 50%)
          `,
        }}
      />

      <DigitalRain />
      <Dust />
      <Scanline />
      <GlitchBars />

      {/* CRT scan lines overlay */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
        }}
      />

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 30%, rgba(0,0,0,0.4) 100%)',
        }}
      />

      {/* Foreground content */}
      <div className="relative z-10 w-full h-full flex flex-col items-center justify-center px-6">

        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.p
            className="text-[10px] md:text-xs font-mono tracking-[0.5em] mb-3 md:mb-4"
            style={{ color: 'rgba(34,211,238,0.5)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
          >
            [ SISTEMA ]
          </motion.p>

          <h1 className="text-5xl md:text-8xl lg:text-9xl font-['Space_Grotesk'] font-bold tracking-tight leading-none">
            <span className="text-white">Backend</span>{' '}
            <span style={{
              color: '#22D3EE',
              textShadow: '0 0 30px rgba(34,211,238,0.4), 0 0 60px rgba(34,211,238,0.15), 0 0 100px rgba(34,211,238,0.08)',
            }}>Inteligente</span>
          </h1>

          <div className="mt-4 md:mt-6 h-6 md:h-8 flex items-center justify-center">
            <Typewriter
              text="> PROCESAMIENTO DISTRIBUIDO · VALLE DE ABURRÁ"
              delay={0.8}
              className="font-mono text-[9px] md:text-xs tracking-[0.2em]"
              style={{ color: 'rgba(34,211,238,0.7)' }}
            />
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          className="absolute bottom-16 md:bottom-24 flex items-center gap-8 md:gap-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 1, ease: 'easeOut' }}
        >
          <Counter to={12} suffix="" label="NODOS ACTIVOS" delay={1.8} />
          <Counter to={45} suffix="ms" label="LATENCIA MEDIA" delay={2.2} />
          <Counter to={99} suffix=".9%" label="TIEMPO ACTIVO" delay={2.6} />
        </motion.div>

        {/* Bottom glowing line */}
        <motion.div
          className="absolute bottom-8 left-[15%] right-[15%] h-[1px]"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(34,211,238,0.3) 20%, rgba(34,211,238,0.5) 50%, rgba(34,211,238,0.3) 80%, transparent 100%)',
            boxShadow: '0 0 10px rgba(34,211,238,0.3)',
          }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 2, duration: 1.5, ease: 'easeOut' }}
        />

      </div>
    </div>
  );
});
