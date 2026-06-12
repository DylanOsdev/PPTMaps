import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { useDevicePerformance } from '../../../hooks/useDevicePerformance';
import {
  FiSun, FiCloud, FiCloudRain, FiCloudLightning, FiWind,
  FiDroplet, FiEye, FiThermometer, FiMapPin, FiNavigation,
  FiCompass, FiActivity, FiArrowUp, FiArrowDown,
} from 'react-icons/fi';

function useWeatherData() {
  const [weather, setWeather] = useState({
    temp: 28, feelsLike: 32, humidity: 65, windSpeed: 12,
    windGusts: 43, windDir: 180, cloudCover: 40,
    precipProb: 20, visibility: "10.0", uvIndex: 8.2,
    pressure: 1013, dewPoint: 18,
    tempMin: 22, tempMax: 30,
    loading: true, error: false
  });

  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();
    const fetchWeather = async () => {
      try {
        const res = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=6.2442&longitude=-75.5812"
          + "&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover,dewpoint_2m,surface_pressure"
          + "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum"
          + "&hourly=precipitation_probability,visibility,uv_index"
          + "&timezone=America/Bogota&forecast_days=1",
          { signal: ctrl.signal }
        );
        if (res.ok) {
          const data = await res.json();
          const hStr = new Date().toLocaleString('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hour12: false });
          const h = parseInt(hStr.split(' ')[0]) % 24 || 0;
          if (mounted) setWeather({
            temp:        data.current?.temperature_2m ?? 28,
            feelsLike:   data.current?.apparent_temperature ?? 32,
            humidity:    data.current?.relative_humidity_2m ?? 65,
            windSpeed:   data.current?.wind_speed_10m ?? 12,
            windGusts:   data.current?.wind_gusts_10m ?? 43,
            windDir:     data.current?.wind_direction_10m ?? 180,
            cloudCover:  data.current?.cloud_cover ?? 40,
            dewPoint:    data.current?.dewpoint_2m ?? 18,
            precipProb:  data.hourly?.precipitation_probability?.[h] ?? 20,
            visibility:  data.hourly?.visibility?.[h] != null ? (data.hourly.visibility[h] / 1000).toFixed(1) : "10.0",
            uvIndex:     data.hourly?.uv_index?.[h] ?? 8.2,
            pressure:    data.current?.surface_pressure ?? 1013,
            tempMin:     data.daily?.temperature_2m_min?.[0] ?? 22,
            tempMax:     data.daily?.temperature_2m_max?.[0] ?? 30,
            loading: false, error: false
          });
        } else {
          if (mounted) setWeather(p => ({ ...p, loading: false, error: true }));
        }
      } catch (e) {
        if (mounted && e.name !== 'AbortError') setWeather(p => ({ ...p, loading: false, error: true }));
      }
    };
    fetchWeather();
    const t = setInterval(fetchWeather, 300000);
    return () => { mounted = false; ctrl.abort(); clearInterval(t); };
  }, []);

  return weather;
}

function useWeatherStyle(weather) {
  return useMemo(() => {
    const alerta = weather.precipProb > 40 || weather.windGusts > 35;
    const warn = weather.precipProb > 20 || weather.windGusts > 25;
    return alerta
      ? { hex: "#ef4444", rgb: "239,68,68",  tw: "text-red-400",    border: "border-red-500/25",    bg: "bg-red-500/[0.08]",  label: "Tormenta",   risk: "CRÍTICO",  icon: FiCloudLightning }
      : warn
      ? { hex: "#eab308", rgb: "234,179,8",  tw: "text-yellow-400", border: "border-yellow-500/25", bg: "bg-yellow-500/[0.08]", label: "Precaución", risk: "MODERADO", icon: FiCloud }
      : { hex: "#22d3ee", rgb: "34,211,238", tw: "text-cyan-400",   border: "border-cyan-500/25",   bg: "bg-cyan-500/[0.08]",  label: "Óptimo",     risk: "ESTABLE",  icon: FiSun };
  }, [weather.precipProb, weather.windGusts]);
}

function useAnimatedValue(target, duration = 1000) {
  const [display, setDisplay] = useState(target || 0);
  const raf = useRef(null);
  const prevTarget = useRef();
  const currentVal = useRef(target || 0);
  useEffect(() => {
    if (target == null || isNaN(target)) { setDisplay(0); currentVal.current = 0; return; }
    if (prevTarget.current === target) return;
    const from = currentVal.current;
    prevTarget.current = target;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = from + (target - from) * eased;
      currentVal.current = val;
      setDisplay(val);
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);
  return display;
}

function AnimatedNumber({ value, decimals = 0, className = "" }) {
  const animated = useAnimatedValue(value, 1200);
  return <span className={className}>{animated.toFixed(decimals)}</span>;
}

const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 40, scale: 0.95 },
  visible: (i) => ({ opacity: 1, y: 0, scale: 1, transition: { delay: 0.08 * i, duration: 0.6, ease: [0.25, 0.1, 0.25, 1] } })
};

/* ─── Thermometer ─── */
function MercuryThermometer({ temp, min, max }) {
  const pct = Math.max(0, Math.min(100, ((temp - min) / (max - min)) * 100));
  const color = temp > 30 ? '#ef4444' : temp > 26 ? '#fbbf24' : '#22d3ee';
  return (
    <div className="flex flex-col items-center gap-1 h-full justify-end">
      <FiThermometer className="text-slate-500 text-lg" />
      <div className="w-2 h-20 md:h-24 bg-white/[0.06] rounded-full relative overflow-hidden">
        <motion.div
          className="absolute bottom-0 w-full rounded-full origin-bottom"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: pct / 100 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
        />
      </div>
      <span className="font-mono text-[7px] text-slate-500 tabular-nums">{Math.round(temp)}°</span>
    </div>
  );
}

/* ─── Compass ─── */
function Compass({ degrees }) {
  const labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round(degrees / 45) % 8;
  return (
    <div className="flex items-center gap-2">
      <motion.div
        animate={{ rotate: degrees }}
        transition={{ duration: 1.5, ease: [0.25, 0.1, 0.25, 1] }}
        className="text-slate-400"
      >
        <FiCompass size={18} />
      </motion.div>
      <span className="font-mono text-[10px] text-slate-400 w-6">{labels[idx]}</span>
    </div>
  );
}

/* ─── Heat Waves ─── */
function HeatWaves({ color }) {
  const waves = useMemo(() => [1, 2, 3, 4].map((_, i) => ({
    id: i,
    size: 100 + i * 80,
    duration: 3 + i * 0.6,
    delay: i * 0.8,
  })), []);

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-[2] opacity-[0.04]" style={{ willChange: 'transform' }}>
      {waves.map(w => (
        <div key={w.id} className="absolute rounded-full border" style={{
          width: w.size, height: w.size,
          borderColor: color,
          animation: `heat-wave ${w.duration}s ease-out infinite`,
          animationDelay: `${w.delay}s`,
          willChange: 'transform, opacity',
        }} />
      ))}
    </div>
  );
}

/* ─── Radar ─── */
function RadarSweep() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[1] opacity-[0.03]" style={{ willChange: 'transform' }}>
      <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/20" />
      <div className="absolute top-1/2 left-1/2 w-[500px] h-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/10" />
      <div className="absolute top-1/2 left-1/2 w-1 h-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400 shadow-[0_0_10px_#22D3EE]" />
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px]"
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        style={{
          background: 'linear-gradient(to right, transparent 0%, rgba(34,211,238,0.25) 50%, transparent 100%)',
          clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
          transformOrigin: 'center bottom',
          willChange: 'transform',
        }}
      />
    </div>
  );
}

/* ─── Lightning ─── */
function LightningFlash({ active }) {
  const [flash, setFlash] = useState(false);
  const flashX = useRef(50);
  const flashY = useRef(50);
  const boltHeight = useRef(80);
  const boltRotation = useRef(0);
  useEffect(() => {
    if (!active) { setFlash(false); return; }
    let timeoutId;
    let flashTimeout;
    const scheduleFlash = () => {
      timeoutId = setTimeout(() => {
        flashX.current = 20 + Math.random() * 60;
        flashY.current = 15 + Math.random() * 70;
        boltHeight.current = 60 + Math.random() * 80;
        boltRotation.current = -20 + Math.random() * 40;
        setFlash(true);
        flashTimeout = setTimeout(() => setFlash(false), 80 + Math.random() * 60);
        scheduleFlash();
      }, 2000 + Math.random() * 4000);
    };
    scheduleFlash();
    return () => {
      clearTimeout(timeoutId);
      clearTimeout(flashTimeout);
    };
  }, [active]);
  if (!active) return null;
  return (
    <>
      {flash && (
        <motion.div
          className="absolute inset-0 pointer-events-none z-[5]"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.18, 0] }}
          transition={{ duration: 0.15 }}
          style={{
            background: `radial-gradient(circle at ${flashX.current}% ${flashY.current}%, rgba(255,255,255,0.9) 0%, transparent 60%)`,
          }}
        />
      )}
      {flash && (
        <motion.div
          className="absolute pointer-events-none z-[5]"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{ duration: 0.12 }}
          style={{
            left: `${flashX.current}%`,
            top: `${flashY.current}%`,
            width: '2px',
            height: `${boltHeight.current}px`,
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.8), transparent)',
            transform: `rotate(${boltRotation.current}deg)`,
            filter: 'blur(1px)',
          }}
        />
      )}
    </>
  );
}

/* ─── Floating Clouds ─── */
function DriftingClouds({ cover }) {
  const count = Math.min(5, Math.ceil(cover / 20));
  const clouds = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      top: 10 + i * 20 + Math.random() * 10,
      size: 40 + i * 15,
      duration: 20 + i * 8,
      delay: -Math.random() * 20,
    }))
  , [count]);
  if (cover < 15) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[2] opacity-[0.04]" style={{ willChange: 'transform' }}>
      {clouds.map(c => (
        <div key={c.id} className="absolute text-white" style={{
          top: `${c.top}%`,
          left: `-100px`,
          animation: `cloud-drift ${c.duration}s linear infinite`,
          animationDelay: `${c.delay}s`,
          willChange: 'transform',
        }}>
          <FiCloud size={c.size} />
        </div>
      ))}
    </div>
  );
}

/* ─── Wind Streaks ─── */
function WindStreaks({ speed, dir }) {
  const count = Math.min(8, Math.ceil(speed / 4));
  const streaks = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      top: 15 + i * 10 + Math.random() * 5,
      width: 60 + Math.random() * 120,
      duration: 3 + i * 0.8,
      delay: -Math.random() * 5,
    }))
  , [count]);
  if (speed < 5) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[2] opacity-[0.05]" style={{ willChange: 'transform' }}>
      {streaks.map(s => (
        <div key={s.id} className="absolute h-px" style={{
          top: `${s.top}%`,
          left: '-10%',
          width: `${s.width}px`,
          background: 'linear-gradient(to right, transparent, rgba(34,211,238,0.5), transparent)',
          transform: `rotate(${dir - 180}deg)`,
          transformOrigin: 'left center',
          animation: `wind-streak ${s.duration}s linear infinite`,
          animationDelay: `${s.delay}s`,
          willChange: 'transform',
        }} />
      ))}
    </div>
  );
}

/* ─── Rain ─── */
function RainEffect({ active }) {
  const drops = useMemo(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: -Math.random() * 50,
      height: 12 + Math.random() * 25,
      duration: 0.25 + Math.random() * 0.35,
      delay: Math.random() * 2.5,
      opacity: 0.12 + Math.random() * 0.2,
    }))
  , []);
  if (!active) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-[3]" style={{ willChange: 'transform' }}>
      {drops.map(d => (
        <div key={d.id} className="absolute w-px" style={{
          left: `${d.left}%`,
          top: `${d.top}%`,
          height: `${d.height}px`,
          background: 'linear-gradient(to bottom, transparent, rgba(103,232,249,0.2))',
          animation: `rain-drop ${d.duration}s linear infinite`,
          animationDelay: `${d.delay}s`,
          opacity: d.opacity,
          willChange: 'transform',
        }} />
      ))}
    </div>
  );
}

/* ─── DataStream ─── */
function DataStream() {
  const lines = useMemo(() => [
    { top: 10, duration: 16, delay: 0 },
    { top: 34, duration: 22, delay: -8 },
    { top: 58, duration: 28, delay: -16 },
    { top: 82, duration: 34, delay: -24 },
  ], []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-[0.02]" style={{ willChange: 'transform' }}>
      {lines.map((l, i) => (
        <div key={i} className="absolute font-mono text-[7px] text-cyan-400 whitespace-nowrap" style={{
          top: `${l.top}%`,
          left: '0',
          animation: `data-scroll ${l.duration}s linear infinite`,
          animationDelay: `${l.delay}s`,
          willChange: 'transform',
        }}>
          {"{temp:28.4 lat:6.2442 lon:-75.5812 hum:67% wind:12km/h dir:180° cloud:40% dew:18°}".repeat(20)}
        </div>
      ))}
    </div>
  );
}

/* ─── Particles ─── */
function ParticleField({ count = 15, color }) {
  const particles = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i, x: Math.random() * 100, y: Math.random() * 100,
      size: 1 + Math.random() * 2, duration: 3 + Math.random() * 4,
      delay: -Math.random() * 5, drift: Math.random() * 30 - 15,
      opacity: 0.12 + Math.random() * 0.2,
    })), [count]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" style={{ willChange: 'transform' }}>
      {particles.map(p => (
        <div key={p.id} className="absolute rounded-full" style={{
          left: `${p.x}%`, top: `${p.y}%`,
          width: p.size, height: p.size,
          backgroundColor: color || '#22d3ee',
          opacity: p.opacity,
          animation: `particle-float ${p.duration}s ease-in-out infinite`,
          animationDelay: `${p.delay}s`,
          transform: `translateX(${p.drift}px)`,
          willChange: 'transform, opacity',
        }} />
      ))}
    </div>
  );
}

function StatCard({ children, className = "" }) {
  return <div className={`rounded-2xl border border-white/[0.06] bg-white/[0.04] ${className}`}>{children}</div>;
}

function Skeleton() {
  return (
    <div className="absolute inset-0 bg-[#041327] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <div className="w-24 h-24 rounded-full bg-white/[0.04]" />
        <div className="w-48 h-6 rounded bg-white/[0.04]" />
        <div className="w-32 h-4 rounded bg-white/[0.03]" />
      </div>
    </div>
  );
}

function HourCell({ hour, prob, temp, delay }) {
  const WeatherIcon = prob > 60 ? FiCloudLightning : prob > 30 ? FiCloudRain : prob > 15 ? FiCloud : FiSun;
  const iconColor = prob > 60 ? '#ef4444' : prob > 30 ? '#eab308' : prob > 15 ? '#94a3b8' : '#fbbf24';
  return (
    <motion.div
      custom={delay}
      variants={CARD_VARIANTS} initial="hidden" animate="visible"
      className="flex flex-col items-center gap-1.5 min-w-[56px] px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]
        hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-300 cursor-default group"
    >
      <span className="font-mono text-[9px] text-slate-500">{hour}</span>
      <div style={{ color: iconColor }} className="text-xs">
        <WeatherIcon />
      </div>
      <span className="text-base text-white font-light tabular-nums">{temp}°</span>
      <div className="w-1 h-9 bg-white/[0.05] rounded-full relative overflow-hidden">
        <motion.div className="absolute bottom-0 w-full rounded-full origin-bottom"
          initial={{ scaleY: 0 }} animate={{ scaleY: prob / 100 }}
          transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
          style={{ backgroundColor: prob > 60 ? '#ef4444' : prob > 30 ? '#eab308' : '#22d3ee' }} />
      </div>
    </motion.div>
  );
}

function MiniTempBar({ min, max, current }) {
  const pct = Math.max(0, Math.min(100, ((current - min) / (max - min)) * 100));
  return (
    <div className="flex items-center gap-2">
      <FiArrowDown size={8} className="text-blue-400" />
      <span className="font-mono text-[9px] text-blue-400">{Math.round(min)}°</span>
      <div className="w-16 h-1 bg-white/[0.06] rounded-full overflow-hidden relative">
        <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(to right, #3b82f6, #22d3ee, #fbbf24, #ef4444)', opacity: 0.5 }} />
        <motion.div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]"
          initial={{ left: '0%' }} animate={{ left: `${pct}%` }} transition={{ duration: 1.2, ease: "easeOut" }} />
      </div>
      <span className="font-mono text-[9px] text-orange-400">{Math.round(max)}°</span>
      <FiArrowUp size={8} className="text-orange-400" />
    </div>
  );
}

export default React.memo(function WeatherSection() {
  const weather = useWeatherData();
  const ac = useWeatherStyle(weather);
  const { tier } = useDevicePerformance();

  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const parallaxX = useTransform(mouseX, [0, 1], [-8, 8]);
  const parallaxY = useTransform(mouseY, [0, 1], [-8, 8]);

  const handleMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
  }, [mouseX, mouseY]);

  const isLoading = weather.loading;
  const fmt = useCallback((v, d = 0) => (isLoading || v == null) ? "--" : Number(v).toFixed(d), [isLoading]);

  const forecastData = useMemo(() => {
    if (isLoading || weather.error) return [];
    const baseProb = weather.precipProb;
    const baseTemp = weather.temp;
    return Array.from({ length: 8 }, (_, i) => {
      const hh = (new Date().getHours() + i) % 24;
      return {
        hour: `${String(hh).padStart(2, '0')}:00`,
        prob: Math.max(0, Math.min(100, baseProb + (i * 3) + Math.floor(Math.sin(i * 1.5) * 3))),
        temp: baseTemp + Math.floor(Math.cos(i * 1.2) * 1.5),
      };
    });
  }, [isLoading, weather.error, weather.precipProb, weather.temp]);

  if (isLoading || weather.error) return <Skeleton />;

  const isStorm = weather.precipProb > 40 || weather.windGusts > 35;
  const isRaining = weather.precipProb > 25;
  const StatusIcon = ac.icon;

  const metrics = [
    { id: "HUMEDAD",  value: weather.humidity,    unit: "%",     max: 100, color: "#67e8f9", icon: FiDroplet },
    { id: "LLUVIA",   value: weather.precipProb,  unit: "%",     max: 100, color: "#fbbf24", icon: FiCloudRain },
    { id: "ROCIO",    value: weather.dewPoint,     unit: "°C",   max: 30,  color: "#60a5fa", icon: FiDroplet },
    { id: "VISIB.",   value: parseFloat(weather.visibility) || 0, unit: "km", max: 15, color: "#a78bfa", icon: FiEye },
    { id: "UV",       value: weather.uvIndex,      unit: "UVI",   max: 11,  color: "#fb923c", icon: FiSun },
    { id: "NUBES",    value: weather.cloudCover,    unit: "%",     max: 100, color: "#94a3b8", icon: FiCloud },
    { id: "PRESIÓN",  value: weather.pressure,      unit: "hPa",  max: 1050, min: 950, color: "#c084fc", icon: FiCompass },
  ];

  const particleCount = tier === 'HIGH' ? 20 : tier === 'MEDIUM' ? 12 : 8;
  const showHeatWaves = tier !== 'LOW';
  const showClouds = tier !== 'LOW' && weather.cloudCover >= 15;
  const showWindStreaks = tier !== 'LOW' && weather.windSpeed >= 5;
  const showRain = tier !== 'LOW' && isRaining;
  const showLightning = tier !== 'LOW' && isStorm;

  // MEDIUM tier: cap to max 3 optional effects to avoid overload
  let optionalCount = 0;
  const maxOptional = tier === 'HIGH' ? 99 : 3;
  const canShow = (show) => { if (show && optionalCount < maxOptional) { optionalCount++; return true; } return false; };

  return (
    <div className="absolute inset-0 bg-[#041327] overflow-hidden" onMouseMove={handleMouseMove}>
      <DataStream />
      <RadarSweep />
      <ParticleField count={particleCount} color={ac.hex} />
      {showHeatWaves && <HeatWaves color={ac.hex} />}
      {canShow(showClouds) && <DriftingClouds cover={weather.cloudCover} />}
      {canShow(showWindStreaks) && <WindStreaks speed={weather.windSpeed} dir={weather.windDir} />}
      {canShow(showLightning) && <LightningFlash active={isStorm} />}
      {canShow(showRain) && <RainEffect active={isRaining} />}

      <div className="absolute -top-[30%] -right-[20%] w-[100vmin] h-[100vmin] transition-all duration-1500"
        style={{ background: `radial-gradient(circle, rgba(${ac.rgb},0.08) 0%, transparent 60%)` }} />
      <div className="absolute -bottom-[30%] -left-[20%] w-[80vmin] h-[80vmin] transition-all duration-1500"
        style={{ background: `radial-gradient(circle, rgba(${ac.rgb},0.05) 0%, transparent 60%)` }} />
      <div className="absolute inset-0 cartographic-grid opacity-[0.03]" />

      <div className="absolute inset-0 flex flex-col px-6 md:px-12 lg:px-20 pt-20 pb-8 z-10">
        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex items-center justify-between mb-6 pb-4 border-b border-white/[0.03] flex-none">
          <div className="flex items-center gap-4">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="flex items-center gap-2 mb-0.5">
              <motion.span className="w-2 h-2 rounded-full"
                animate={{ backgroundColor: ac.hex, boxShadow: `0 0 10px ${ac.hex}` }}
                transition={{ duration: 0.8 }} />
              <motion.span key={ac.label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                className={`font-mono text-[10px] tracking-[0.2em] uppercase ${ac.tw}`}>{ac.label}</motion.span>
            </motion.div>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <FiMapPin size={10} className="text-slate-500" />
            <span className="font-mono text-[9px] text-slate-500 tracking-[0.1em]">Medellín · 6.24°N 75.58°W</span>
            <span className="w-px h-3 bg-white/[0.06]" />
            <MiniTempBar min={weather.tempMin} max={weather.tempMax} current={weather.temp} />
            <span className="w-px h-3 bg-white/[0.06]" />
            <motion.span className="font-mono text-[9px] text-slate-500 tabular-nums"
              animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }}>
              {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </motion.span>
          </div>
        </motion.div>

        <div className="flex-1 flex flex-col lg:flex-row gap-5 min-h-0">
          {/* ─── LEFT ─── */}
          <div className="w-full lg:w-[27%] flex flex-col gap-4">
            <motion.div custom={0} variants={CARD_VARIANTS} initial="hidden" animate="visible">
              <StatCard className="flex-1 flex flex-col justify-center p-6 md:p-8 min-h-[200px] relative overflow-hidden group">
                <div className="absolute -top-6 -right-6 text-6xl text-white/[0.02] group-hover:text-white/[0.04] transition-all duration-700">
                  <FiThermometer />
                </div>
                <div className="flex gap-6">
                  <div className="flex-1">
                    <span className="font-mono text-[10px] text-slate-500 tracking-[0.15em] uppercase mb-1 block">Temperatura</span>
                    <div className="flex items-baseline gap-1 -ml-1 relative">
                      <motion.span className="text-8xl md:text-9xl font-light text-white leading-none tracking-tight tabular-nums"
                        key={weather.temp} initial={{ scale: 1.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.5 }}>
                        <AnimatedNumber value={weather.temp} />
                      </motion.span>
                      <span className="absolute top-2 right-[-20px] text-xl text-white/40 font-light">°C</span>
                    </div>
                    <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/[0.04]">
                      <div>
                        <span className="font-mono text-[8px] text-slate-500 tracking-widest uppercase">Sensación</span>
                        <p className="text-base text-slate-300 font-light"><AnimatedNumber value={weather.feelsLike} />°C</p>
                      </div>
                      <div className="w-px h-8 bg-white/[0.04]" />
                      <div>
                        <span className="font-mono text-[8px] text-slate-500 tracking-widest uppercase">Humedad</span>
                        <p className="text-base text-slate-300 font-light"><AnimatedNumber value={weather.humidity} />%</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/[0.03]">
                      <MiniTempBar min={weather.tempMin} max={weather.tempMax} current={weather.temp} />
                    </div>
                  </div>
                  <MercuryThermometer temp={weather.temp} min={weather.tempMin} max={weather.tempMax} />
                </div>
              </StatCard>
            </motion.div>

            <motion.div custom={1} variants={CARD_VARIANTS} initial="hidden" animate="visible">
              <StatCard className="p-6 md:p-8 relative overflow-hidden group">
                <div className="absolute -bottom-4 -right-4 text-4xl text-white/[0.02] group-hover:text-white/[0.04] transition-all duration-700">
                  <FiWind />
                </div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-[10px] text-slate-500 tracking-[0.15em] uppercase">Viento</span>
                  <span className="text-xs text-slate-500"><AnimatedNumber value={weather.windSpeed} /> km/h</span>
                </div>
                <div className="relative h-16 flex items-center gap-4">
                  <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full origin-left"
                      initial={{ scaleX: 0 }} animate={{ scaleX: Math.min(1, weather.windSpeed * 0.025) }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                      style={{ backgroundColor: ac.hex }} />
                  </div>
                  <motion.div animate={{ rotate: weather.windDir }}
                    transition={{ duration: 1.5, ease: [0.25, 0.1, 0.25, 1] }}>
                    <FiNavigation size={16} className="text-cyan-400 shrink-0 drop-shadow-[0_0_8px_#22d3ee]" />
                  </motion.div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <Compass degrees={weather.windDir} />
                  <span className="font-mono text-[8px] text-slate-500">
                    Ráfagas <AnimatedNumber value={weather.windGusts} /> km/h
                  </span>
                </div>
              </StatCard>
            </motion.div>
          </div>

          {/* ─── CENTER ─── */}
          <div className="w-full lg:w-[46%] flex items-center">
            <motion.div custom={1.5} variants={CARD_VARIANTS} initial="hidden" animate="visible" className="w-full h-full">
              <StatCard className="w-full h-full flex flex-col items-center justify-center gap-6 py-10 lg:py-14 px-6 relative overflow-hidden">
                <div className="relative w-[260px] h-[260px] md:w-[360px] md:h-[360px] flex items-center justify-center">
                  <motion.div
                    className="absolute w-full h-full rounded-full"
                    animate={{
                      scale: [1, 1.03, 1],
                      opacity: [0.12, 0.3, 0.12],
                      borderColor: ac.hex,
                    }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    style={{
                      border: '1px solid',
                      boxShadow: `0 0 60px ${ac.hex}40, inset 0 0 60px ${ac.hex}20`,
                      willChange: 'transform, opacity',
                    }}
                  />
                  <motion.div
                    className="absolute w-[85%] h-[85%] rounded-full"
                    animate={{
                      scale: [0.85, 0.95, 0.85],
                      opacity: [0.08, 0.18, 0.08],
                    }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
                    style={{
                      border: '1px solid',
                      borderColor: `${ac.hex}60`,
                      boxShadow: `0 0 40px ${ac.hex}30`,
                      willChange: 'transform, opacity',
                    }}
                  />
                  <motion.svg
                    className="absolute w-full h-full"
                    viewBox="0 0 200 200"
                    style={{ willChange: 'transform' }}
                  >
                    <motion.circle
                      cx="100"
                      cy="100"
                      r={85 + Math.min(weather.windSpeed * 2, 30)}
                      fill="none"
                      stroke={ac.hex}
                      strokeWidth="1.5"
                      strokeDasharray="8 12"
                      style={{
                        transformOrigin: '100px 100px',
                        filter: `drop-shadow(0 0 8px ${ac.hex})`,
                        willChange: 'transform',
                      }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    />
                    <motion.circle
                      cx="100"
                      cy="100"
                      r={72}
                      fill="none"
                      stroke={ac.hex}
                      strokeWidth="0.5"
                      strokeDasharray={weather.precipProb > 30 ? "4 8" : "0 100"}
                      style={{
                        opacity: weather.precipProb > 30 ? 0.6 : 0.15,
                        filter: `drop-shadow(0 0 4px ${ac.hex})`,
                        willChange: 'transform, opacity',
                      }}
                      animate={{ scale: weather.precipProb > 30 ? [1, 1.06, 1] : 1 }}
                      transition={{ duration: 2, repeat: weather.precipProb > 30 ? Infinity : 0, ease: "easeInOut" }}
                    />
                  </motion.svg>

                  <motion.div className="relative w-32 h-32 md:w-44 md:h-44" style={{ x: parallaxX, y: parallaxY }}>
                  <div className="absolute inset-0 rounded-full"
                    style={{ background: `radial-gradient(circle, ${ac.hex}30 0%, transparent 70%)`, filter: 'blur(25px)' }} />
                  {[1, 2, 3].map((_, i) => (
                    <div key={i} className="absolute inset-0 rounded-full border border-white/[0.04]" style={{
                      willChange: 'transform, opacity',
                      animation: `ping-pulse 3s cubic-bezier(0, 0, 0.2, 1) infinite`,
                      animationDelay: `${i * 0.7}s`,
                    }} />
                  ))}
                  <div className="relative z-10 w-full h-full rounded-full flex flex-col items-center justify-center"
                    style={{
                      background: `radial-gradient(circle at 35% 35%, ${ac.hex}18, ${ac.hex}06)`,
                      border: `1px solid ${ac.hex}25`,
                      boxShadow: `inset 0 0 60px ${ac.hex}08, 0 0 40px ${ac.hex}10`,
                    }}>
                    <motion.div key={ac.label} initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 150, damping: 12 }}>
                      <StatusIcon className="text-3xl md:text-4xl"
                        style={{ color: ac.hex, filter: `drop-shadow(0 0 15px ${ac.hex})` }} />
                    </motion.div>
                    <span className="text-2xl md:text-3xl font-light text-white leading-none mt-1 tabular-nums">
                      <AnimatedNumber value={weather.temp} />°C
                    </span>
                  </div>
                </motion.div>
                </div>

                <motion.div className={`inline-flex items-center gap-2.5 px-5 py-2 rounded-full border ${ac.border} ${ac.bg}`}
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ delay: 0.6, type: "spring", stiffness: 200 }}>
                  <StatusIcon className="text-base" style={{ color: ac.hex }} />
                  <span className={`font-mono text-[10px] tracking-[0.25em] uppercase ${ac.tw}`}>{ac.label}</span>
                </motion.div>

                <div className="w-full flex pt-5 border-t border-white/[0.04]">
                  {[
                    { l: "Riesgo",  v: `${isNaN(weather.windGusts/10) ? "—" : Math.ceil(weather.windGusts/10)}/10`, metric: true },
                    { l: "Lluvia",  v: `${fmt(weather.precipProb)}%`, metric: true },
                    { l: "Viento",  v: `${fmt(weather.windSpeed)} km/h`, metric: true },
                    { l: "Estado",  v: ac.risk, metric: false },
                  ].map(({ l, v, metric }, i) => (
                    <div key={l} className="flex-1 flex">
                      {i > 0 && <div className="w-px bg-white/[0.04] mx-2" />}
                      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 + i * 0.1 }}
                        className={`flex-1 text-center ${metric ? '' : 'relative'}`}>
                        <p className={`font-mono text-[7px] tracking-widest uppercase mb-1 ${metric ? 'opacity-50' : 'opacity-70'} ${metric ? '' : ac.tw}`}>{l}</p>
                        <motion.p key={v} initial={{ scale: 1.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.3 }}
                          className={`text-sm lg:text-base font-light tabular-nums ${metric ? 'text-white' : ac.tw}`}>{v}</motion.p>
                        {!metric && <div className="absolute -top-1 right-2 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ac.hex, boxShadow: `0 0 6px ${ac.hex}` }} />}
                      </motion.div>
                    </div>
                  ))}
                </div>
              </StatCard>
            </motion.div>
          </div>

          {/* ─── RIGHT ─── */}
          <div className="w-full lg:w-[27%] flex flex-col gap-4">
            <motion.div custom={2} variants={CARD_VARIANTS} initial="hidden" animate="visible"
              className="flex items-center justify-between flex-none">
              <span className="font-mono text-[10px] text-slate-500 tracking-[0.15em] uppercase relative">
                Métricas
                <motion.span className="absolute -bottom-px left-0 h-px"
                  animate={{ width: ["0%", "100%"], backgroundColor: ac.hex }}
                  transition={{ duration: 1, delay: 0.5 }} />
              </span>
            </motion.div>
            <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto pr-1">
              {metrics.map((m, i) => {
                const pct = Math.min(100, Math.max(0, ((m.value - (m.min || 0)) / (m.max - (m.min || 0))) * 100));
                const Icon = m.icon;
                return (
                  <motion.div key={m.id} custom={2.5 + i * 0.08} variants={CARD_VARIANTS} initial="hidden" animate="visible"
                    className="rounded-xl border border-white/[0.04] bg-white/[0.04] px-4 py-2.5 flex items-center gap-3
                      hover:border-white/[0.08] hover:bg-white/[0.03] transition-all duration-300 cursor-default group relative overflow-hidden"
                  >
                    <div className="absolute -top-4 -right-4 text-3xl text-white/[0.01] group-hover:text-white/[0.03] transition-all duration-500">
                      <Icon />
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-white/[0.03] flex items-center justify-center shrink-0
                      group-hover:bg-white/[0.06] transition-all duration-300"
                      style={{ border: `1px solid ${m.color}10` }}>
                      <Icon className="text-base" style={{ color: m.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-[8px] text-slate-500 tracking-widest">{m.id}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        <AnimatedNumber value={m.value > 100 ? Math.round(m.value) : m.value} decimals={m.value > 100 ? 0 : 1} />
                        {m.unit}
                      </p>
                    </div>
                    <div className="w-14 h-1.5 bg-white/[0.05] rounded-full overflow-hidden shrink-0" style={{ boxShadow: `0 0 4px ${m.color}30` }}>
                      <motion.div className="h-full rounded-full origin-left"
                        initial={{ scaleX: 0 }} animate={{ scaleX: (100 - pct) / 100 }}
                        transition={{ duration: 1.2, delay: 0.3 + i * 0.08, ease: "easeOut" }}
                        style={{ backgroundColor: m.color, boxShadow: `0 0 8px ${m.color}, 0 0 16px ${m.color}40` }} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Forecast ── */}
        <motion.div custom={4} variants={CARD_VARIANTS} initial="hidden" animate="visible"
          className="flex-none mt-4 pt-4 border-t border-white/[0.03]">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-[9px] text-slate-500 tracking-[0.15em] uppercase">Pronóstico por hora</span>
            <div className="flex items-center gap-1">
              <FiActivity size={10} className="text-slate-500" />
              <span className="font-mono text-[8px] text-slate-500">% lluvia</span>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
            {forecastData.map((item, i) => (
              <HourCell key={item.hour} hour={item.hour}
                prob={item.prob}
                temp={item.temp}
                delay={4.5 + i * 0.06} />
            ))}
          </div>
        </motion.div>
      </div>

      <style>{`
        @keyframes rain-drop {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes data-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes particle-float {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.12; }
          25% { transform: translateY(-15px) translateX(10px); opacity: 0.35; }
          50% { transform: translateY(-30px) translateX(5px); opacity: 0.2; }
          75% { transform: translateY(-15px) translateX(-5px); opacity: 0.35; }
        }
        @keyframes heat-wave {
          0% { transform: scale(0.5); opacity: 0.6; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes cloud-drift {
          0% { transform: translateX(-120px); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateX(calc(100vw + 120px)); opacity: 0; }
        }
        @keyframes wind-streak {
          0% { transform: translateX(0) scaleX(1); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateX(120vw) scaleX(0.5); opacity: 0; }
        }
        @keyframes ping-pulse {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  );
});
