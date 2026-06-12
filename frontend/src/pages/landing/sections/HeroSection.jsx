import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import Globe3D from '../components/Globe3D.jsx';
import { useDevicePerformance } from '../../../hooks/useDevicePerformance';

function useReducedMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const handler = (e) => setReduceMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduceMotion;
}

function useAnimatedCounter(end, duration = 2, delay = 0) {
  const [count, setCount] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    let rafId;
    const timeout = setTimeout(() => {
      started.current = true;
      const startTime = Date.now();
      const animate = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCount(Math.floor(eased * end));
        if (progress < 1) rafId = requestAnimationFrame(animate);
      };
      rafId = requestAnimationFrame(animate);
    }, delay * 1000);
    return () => {
      clearTimeout(timeout);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [end, duration, delay]);
  return count;
}

function useLiveClock() {
  const [display, setDisplay] = useState({ time: '', date: '' });
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setDisplay({
        time: now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
        date: now.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase(),
      });
    };
    update();
    let id = setInterval(update, 1000);
    const handleVisibility = () => {
      if (document.hidden) {
        clearInterval(id);
      } else {
        update();
        id = setInterval(update, 1000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);
  return display;
}

function StatusIndicator() {
  return (
    <div className="flex items-center gap-3">
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-400 shadow-[0_0_12px_rgba(74,222,128,0.9)]" />
      </span>
      <span className="font-mono text-xs text-green-400 tracking-[0.15em] font-bold">SISTEMA ACTIVO</span>
    </div>
  );
}

function TopBar({ weather }) {
  const { time, date } = useLiveClock();
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.6 }}
      className="absolute top-0 left-0 right-0 z-30 px-6 md:px-10 pt-4 md:pt-6"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <StatusIndicator />
        <div className="flex items-center gap-4 md:gap-6">
          <div className="hidden sm:flex items-center gap-2 font-mono text-xs text-cyan-400/60">
            <span className="text-cyan-400/40">NODE:</span>
            <span className="text-white font-bold tracking-wider text-sm">MEDELLÍN</span>
          </div>
          <div className="w-[1px] h-5 bg-cyan-400/20 hidden sm:block" />
          <div className="font-mono text-sm text-cyan-300 tracking-wider tabular-nums font-medium">{time}</div>
          <div className="w-[1px] h-5 bg-cyan-400/20 hidden sm:block" />
          <div className="font-mono text-[11px] text-cyan-400/50 tracking-wider hidden md:block font-medium">{date}</div>
          {weather && (
            <>
              <div className="w-[1px] h-5 bg-cyan-400/20 hidden md:block" />
              <div className="hidden md:flex items-center gap-2 font-mono text-sm text-cyan-300 font-medium">
                <span className="text-lg">{weather.condition.icon}</span>
                <span className="tabular-nums">{weather.temp}°C</span>
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

const STAT_CARDS = [
  { label: 'GPS ACTIVOS', end: 847, suffix: '', icon: 'sat', color: 'from-cyan-400 to-blue-500' },
  { label: 'COMUNAS', end: 16, suffix: '', icon: 'com', color: 'from-green-400 to-emerald-500' },
  { label: 'CAPAS', end: 9, suffix: '', icon: 'lay', color: 'from-violet-400 to-purple-500' },
  { label: 'LATENCIA', end: 28, suffix: 'ms', icon: 'lat', color: 'from-amber-400 to-orange-500' },
];

function StatIcon({ type }) {
  if (type === 'sat') return (
    <svg className="w-7 h-7 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-5.5 3 2-7L3 9h7l2-7z" />
    </svg>
  );
  if (type === 'com') return (
    <svg className="w-7 h-7 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
  if (type === 'lay') return (
    <svg className="w-7 h-7 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
    </svg>
  );
  return (
    <svg className="w-7 h-7 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function StatCard({ label, end, suffix, icon, color, delay, duration }) {
  const count = useAnimatedCounter(end, duration, delay);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay + 0.3, duration: 0.5, ease: 'easeOut' }}
      className="relative group"
    >
      <div className="absolute -inset-[1px] bg-gradient-to-br from-white/5 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative bg-[#0A1A30]/60 backdrop-blur-sm border border-cyan-400/15 rounded-xl px-5 py-4 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
        <div className="flex items-center gap-4">
          <div className="scale-125">
            <StatIcon type={icon} />
          </div>
          <div className="flex flex-col">
            <span className="font-mono text-2xl md:text-3xl lg:text-4xl font-bold text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.25)] tabular-nums leading-none">
              {count}{suffix}
            </span>
            <span className="font-mono text-[10px] md:text-xs text-cyan-400/50 tracking-[0.2em] mt-1">
              {label}
            </span>
          </div>
        </div>
        <div className={`absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r ${color} opacity-40 group-hover:opacity-70 transition-opacity duration-500`} />
      </div>
    </motion.div>
  );
}

function DataPanel({ config, weather }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.6, duration: 0.8, ease: 'easeOut' }}
      className="w-full lg:w-[520px] xl:w-[580px] 2xl:w-[620px] flex-shrink-0"
    >
      <div className="bg-[#0A1A30]/80 border border-cyan-400/20 rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(34,211,238,0.08),inset_0_0_60px_rgba(34,211,238,0.02)]">
        <div className="px-6 py-4 border-b border-cyan-400/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
          </div>
          <span className="font-mono text-xs text-cyan-400/40 tracking-[0.2em] uppercase font-semibold">control room · v2.4</span>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
            <span className="font-mono text-[10px] text-green-400/70 tracking-wider font-bold">LINK</span>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {STAT_CARDS.map((stat, i) => (
              <StatCard
                key={stat.label}
                {...stat}
                delay={0.8 + i * 0.2}
                duration={config.counterDuration}
              />
            ))}
          </div>
          <WeatherWidget weather={weather} />
          <DataStream />
        </div>
      </div>
    </motion.div>
  );
}

function WeatherWidget({ weather }) {
  const loading = !weather;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.6, duration: 0.5 }}
      className="bg-[#041327]/40 backdrop-blur-sm border border-cyan-400/10 rounded-xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] text-cyan-400/40 tracking-[0.25em] uppercase font-semibold">Condiciones actuales</span>
        <span className="font-mono text-[10px] text-cyan-400/40 font-semibold">{weather ? 'LIVE' : '--'}</span>
      </div>
      {loading ? (
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-cyan-400/10 rounded-full animate-pulse" />
          <div className="space-y-1.5 flex-1">
            <div className="h-5 w-20 bg-cyan-400/10 rounded animate-pulse" />
            <div className="h-4 w-32 bg-cyan-400/10 rounded animate-pulse" />
          </div>
        </div>
      ) : weather ? (
        <div className="flex items-center gap-4">
          <div className="text-4xl font-mono font-bold text-cyan-300 w-14 text-center drop-shadow-[0_0_12px_rgba(34,211,238,0.3)]">{weather.condition.icon}</div>
          <div>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-3xl font-bold text-white tabular-nums drop-shadow-[0_0_10px_rgba(255,255,255,0.15)]">{weather.temp}°</span>
              <span className="font-mono text-xs text-cyan-400/50">ST {weather.feelsLike}°</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="font-mono text-xs text-cyan-400/80 font-medium">{weather.condition.label}</span>
              <span className="text-cyan-400/30">·</span>
              <span className="font-mono text-xs text-cyan-400/60">HUM {weather.humidity}%</span>
              <span className="text-cyan-400/30">·</span>
              <span className="font-mono text-xs text-cyan-400/60">WND {weather.windSpeed} km/h</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <div className="text-4xl font-mono font-bold text-cyan-300 w-14 text-center drop-shadow-[0_0_12px_rgba(34,211,238,0.3)]">SOL</div>
          <div>
            <div className="font-mono text-3xl font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.15)]">24°</div>
            <div className="font-mono text-xs text-cyan-400/60 mt-0.5">Medellín · Parcialmente nublado</div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function DataStream() {
  const messages = useMemo(() => [
    '[SIATA] 1,247 sensores activos en la red',
    '[METRO] 9.2M viajes este mes',
    '[CLIMA] Estaciones pluviometricas · 42 reportando',
    '[TRAF] 316 camaras en linea',
    '[EMERG] 8 incidentes activos',
    '[PROC] 2.4K datos/segundo',
    '[BLOCK] 1,892 transacciones',
    '[COBERT] 16 comunas monitoreadas',
  ], []);

  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let timeoutId;
    const interval = setInterval(() => {
      setVisible(false);
      timeoutId = setTimeout(() => {
        setIndex((prev) => (prev + 1) % messages.length);
        setVisible(true);
      }, 400);
    }, 3000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeoutId);
    };
  }, [messages.length]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 2, duration: 0.5 }}
      className="bg-[#041327]/40 backdrop-blur-sm border border-cyan-400/10 rounded-xl px-4 py-3 overflow-hidden"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-[10px] text-cyan-400/40 tracking-[0.25em] uppercase font-semibold">Data Stream</span>
        <span className="flex-1" />
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
        </span>
      </div>
      <AnimatePresence mode="wait">
        {visible && (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="font-mono text-sm text-cyan-300/90 tracking-wide font-medium"
          >
            {messages[index]}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TypewriterText({ text, delay = 0, baseSpeed = 0.04, className = '' }) {
  const [progress, setProgress] = useState(0);
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    setProgress(0);
    setShowCursor(true);
    let innerInterval = null;
    let cursorTimeout = null;
    const startTimeout = setTimeout(() => {
      let i = 0;
      innerInterval = setInterval(() => {
        i++;
        setProgress(i / text.length);
        if (i >= text.length) {
          clearInterval(innerInterval);
          innerInterval = null;
          cursorTimeout = setTimeout(() => setShowCursor(false), 2000);
        }
      }, baseSpeed * 1000);
    }, delay * 1000);
    return () => {
      clearTimeout(startTimeout);
      if (innerInterval) clearInterval(innerInterval);
      if (cursorTimeout) clearTimeout(cursorTimeout);
    };
  }, [text.length, delay, baseSpeed]);

  return (
    <span className="inline-block relative">
      <span className={className} style={{ clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)` }}>
        {text}
      </span>
      {showCursor && progress < 1 && (
        <span className="inline-block w-[3px] h-[0.85em] bg-cyan-400 ml-0.5 align-middle animate-pulse shadow-[0_0_8px_#22D3EE]"
          style={{ position: 'absolute', right: `${(1 - progress) * 100}%` }}
        />
      )}
    </span>
  );
}

function HeroCTA() {
  const navigate = useNavigate();
  const [isExpanding, setIsExpanding] = useState(false);
  const timerRef = useRef(null);

  const handleClick = () => {
    setIsExpanding(true);
    timerRef.current = setTimeout(() => navigate('/map'), 1200);
  };

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.2, duration: 0.6, ease: 'easeOut' }}
      >
        <button
          onClick={handleClick}
          className="group relative px-8 md:px-10 py-4 md:py-3.5 bg-gradient-to-r from-cyan-500/15 via-cyan-400/25 to-cyan-500/15 border border-cyan-400/40 rounded-xl text-white font-bold text-xs md:text-sm tracking-[0.3em] uppercase overflow-hidden cursor-pointer transition-all duration-500"
          style={{
            boxShadow: '0 0 30px rgba(34,211,238,0.12), inset 0 0 30px rgba(34,211,238,0.03)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 0 50px rgba(34,211,238,0.35), inset 0 0 40px rgba(34,211,238,0.1)';
            e.currentTarget.style.borderColor = 'rgba(34,211,238,0.7)';
            e.currentTarget.style.background = 'linear-gradient(to right, rgba(34,211,238,0.25), rgba(34,211,238,0.4), rgba(34,211,238,0.25))';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 0 30px rgba(34,211,238,0.12), inset 0 0 30px rgba(34,211,238,0.03)';
            e.currentTarget.style.borderColor = 'rgba(34,211,238,0.4)';
            e.currentTarget.style.background = 'linear-gradient(to right, rgba(34,211,238,0.15), rgba(34,211,238,0.25), rgba(34,211,238,0.15))';
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
          <div className="absolute inset-0 rounded-xl border border-cyan-400/0 group-hover:border-cyan-400/50 transition-all duration-500 scale-90 group-hover:scale-105" />
          <span className="relative z-10 flex items-center gap-3">
            Explorar Dashboard
            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </span>
        </button>
        <div className="flex items-center justify-center gap-3 mt-3">
          <span className="font-mono text-[8px] text-cyan-400/30 tracking-[0.3em]">
            {`[`}<span className="text-cyan-400/60">ENTER</span>{`]`}
          </span>
          <span className="w-1 h-1 rounded-full bg-cyan-400/30" />
          <span className="font-mono text-[8px] text-cyan-400/30 tracking-[0.3em]">
            ACCEDER AL PANEL
          </span>
        </div>
      </motion.div>

      <AnimatePresence>
        {isExpanding && (
          <motion.div
            className="fixed z-[100] bg-cyan-400 rounded-full pointer-events-none"
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 8, opacity: 1 }}
            transition={{ duration: 1.2, ease: 'circIn' }}
            style={{ top: '50%', left: '50%', width: '100vmax', height: '100vmax', x: '-50%', y: '-50%' }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function ScanLine() {
  return (
    <motion.div
      className="absolute left-0 right-0 h-[2px] pointer-events-none z-10"
      style={{
        background: 'linear-gradient(90deg, transparent 0%, rgba(34,211,238,0.12) 30%, rgba(34,211,238,0.25) 50%, rgba(34,211,238,0.12) 70%, transparent 100%)',
      }}
      animate={{ y: ['-2vh', '102vh'], opacity: [0, 1, 1, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'linear', times: [0, 0.1, 0.9, 1] }}
    />
  );
}

function StatusBar() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 2.8, duration: 0.6, ease: 'easeOut' }}
      className="absolute bottom-0 left-0 right-0 z-20 px-4 md:px-8 pb-4 md:pb-5"
    >
      <div className="max-w-7xl mx-auto bg-[#041327]/90 border border-cyan-400/15 rounded-xl px-5 py-2.5 shadow-[0_0_25px_rgba(34,211,238,0.06)]">
        <div className="flex items-center gap-4 md:gap-6 font-mono text-[8px] md:text-[10px] text-cyan-400/50 tracking-[0.15em] uppercase overflow-x-auto">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-cyan-400/30">SYS:</span>
            <span className="text-white font-bold">PPT-001</span>
          </div>
          <span className="w-[1px] h-3 bg-cyan-400/15 shrink-0" />
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-cyan-400/30">NODE:</span>
            <span className="text-white font-bold">MEDELLÍN</span>
          </div>
          <span className="w-[1px] h-3 bg-cyan-400/15 shrink-0" />
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-cyan-400/30">UPLINK:</span>
            <span className="text-green-400 font-bold">STABLE</span>
          </div>
          <span className="w-[1px] h-3 bg-cyan-400/15 shrink-0" />
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-cyan-400/30">GPS:</span>
            <span className="text-white font-bold">847 ONLINE</span>
          </div>
          <span className="w-[1px] h-3 bg-cyan-400/15 shrink-0" />
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-cyan-400/30">SENSORES:</span>
            <span className="text-white font-bold">1,247</span>
          </div>
          <span className="w-[1px] h-3 bg-cyan-400/15 shrink-0" />
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-green-400 animate-pulse">●</span>
            <span className="text-green-400/70">SISTEMA OPERACIONAL</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function HeroSection() {
  const reduceMotion = useReducedMotion();
  const { config, isReady } = useDevicePerformance();
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    let mounted = true;
    fetch('/api/v1/public/weather/forecast')
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => {
        if (!mounted) return;
        const cur = data.current;
        const WMO = {
          0: { label: 'Despejado', icon: 'SOL' }, 1: { label: 'Mayormente despejado', icon: 'SOL' },
          2: { label: 'Parcialmente nublado', icon: 'NUB' }, 3: { label: 'Nublado', icon: 'NUB' },
          45: { label: 'Niebla', icon: 'NIE' }, 61: { label: 'Lluvia', icon: 'LLU' },
          63: { label: 'Lluvia', icon: 'LLU' }, 80: { label: 'Chubascos', icon: 'LLU' },
          95: { label: 'Tormenta', icon: 'TOR' },
        };
        const cond = WMO[cur.weather_code] || { label: '--', icon: 'SOL' };
        setWeather({
          temp: cur.temperature_2m,
          condition: cond,
          humidity: cur.relative_humidity_2m,
          windSpeed: cur.wind_speed_10m,
        });
      })
      .catch(() => { if (mounted) setWeather(null); });
    return () => { mounted = false; };
  }, []);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 40, damping: 25 });
  const springY = useSpring(mouseY, { stiffness: 40, damping: 25 });
  const bgX = useTransform(springX, v => v * -20);
  const bgY = useTransform(springY, v => v * -20);

  const handleMouseMove = useCallback((e) => {
    const { innerWidth, innerHeight } = window;
    mouseX.set((e.clientX / innerWidth - 0.5) * 2);
    mouseY.set((e.clientY / innerHeight - 0.5) * 2);
  }, [mouseX, mouseY]);

  if (!isReady) {
    return (
      <div className="w-full h-full bg-[#041327]">
        <div className="absolute inset-0 cartographic-grid opacity-20 pointer-events-none z-0" />
      </div>
    );
  }

  const enableScanLine = config.enableScanLine && !reduceMotion;

  return (
    <div onMouseMove={handleMouseMove} className="w-full h-full flex flex-col bg-[#041327] overflow-hidden selection:bg-cyan-400/30 contain-[layout_style]">
      <div className="absolute inset-0 cartographic-grid opacity-20 pointer-events-none z-0" />
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse at 30% 50%, rgba(34,211,238,0.04) 0%, transparent 60%), radial-gradient(ellipse at 70% 20%, rgba(59,130,246,0.03) 0%, transparent 50%)',
      }} />
      {enableScanLine && <ScanLine />}

      <motion.div
        className="absolute inset-0 z-0 pointer-events-none"
        style={!reduceMotion ? { x: bgX, y: bgY } : {}}
      >
        <Globe3D config={config} />
      </motion.div>

      <TopBar weather={weather} />
      <StatusBar />

      <div className="relative z-20 flex-1 flex items-center justify-center px-4 md:px-8 lg:px-12">
        <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-center lg:items-center justify-between gap-8 lg:gap-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="flex flex-col items-center lg:items-start text-center lg:text-left flex-1 max-w-2xl"
          >
            <div className="flex items-center gap-3 mb-5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_#22D3EE]" />
              <span className="font-mono text-xs text-cyan-400/50 tracking-[0.25em] uppercase font-semibold">
                Plataforma de Inteligencia Urbana
              </span>
            </div>

            <h1 className="font-['Space_Grotesk'] font-bold leading-none whitespace-nowrap">
              <div className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl text-white">
                <TypewriterText
                  text="INTELIGENCIA"
                  delay={0.5}
                  baseSpeed={config.typewriterSpeed}
                />
              </div>
              <div className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl mt-1">
                <TypewriterText
                  text="URBANA"
                  delay={1.5}
                  baseSpeed={config.typewriterSpeed * 1.1}
                  className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-cyan-400 to-blue-400 drop-shadow-[0_0_40px_rgba(34,211,238,0.4)]"
                />
              </div>
            </h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.2, duration: 0.8 }}
              className="font-mono text-sm md:text-base text-slate-400 tracking-[0.25em] uppercase leading-relaxed mt-6 max-w-xl"
            >
              Monitoreo geoespacial en tiempo real · Medellín, Colombia
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.5, duration: 0.8 }}
              className="mt-4 flex items-center gap-5 font-mono text-xs text-cyan-400/40 tracking-[0.2em] font-semibold"
            >
              <span className="hover:text-cyan-300 transition-colors duration-300 cursor-default">SIATA</span>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/30" />
              <span className="hover:text-cyan-300 transition-colors duration-300 cursor-default">OPEN-METEO</span>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/30" />
              <span className="hover:text-cyan-300 transition-colors duration-300 cursor-default">MEDATA</span>
            </motion.div>

            <div className="mt-8 md:mt-10">
              <HeroCTA />
            </div>
          </motion.div>

          <DataPanel config={config} weather={weather} />
        </div>
      </div>
    </div>
  );
}
