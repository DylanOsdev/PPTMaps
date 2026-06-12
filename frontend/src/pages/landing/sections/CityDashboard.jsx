import { useState, useEffect, useCallback, useMemo } from 'react';
import { useCountUp } from '../../../hooks/useCountUp';

function CircularGauge({ value, max, size = 32, stroke = 2.5, color }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - value / max);
  return (
    <svg width={size} height={size} className="shrink-0" viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(148,163,184,0.06)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }} />
    </svg>
  );
}

function Sparkline({ data, color, height = 18, width = 56 }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.08" />
    </svg>
  );
}

function LiveDot() {
  return (
    <span className="relative inline-flex items-center justify-center w-[10px] h-[10px]">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/50" style={{ animationDuration: '1.5s' }} />
      <span className="absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
      <span className="absolute inline-flex h-[5px] w-[5px] rounded-full bg-white/70" />
    </span>
  );
}

function MetricTile({ value, label, color, bg, sparkData, gaugeMax }) {
  const animated = useCountUp(value);
  return (
    <div className={`group relative overflow-hidden rounded-2xl ${bg} backdrop-blur-sm transition-all duration-500 hover:scale-[1.04] hover:shadow-xl cursor-default`}>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-br from-white/[0.04] to-transparent pointer-events-none" />
      {sparkData && (
        <div className="absolute bottom-0 left-0 right-0 h-4 opacity-15 group-hover:opacity-30 transition-opacity duration-500 pointer-events-none">
          <Sparkline data={sparkData} color={color === 'text-cyan-300' ? '#22d3ee' : color === 'text-red-400' ? '#f87171' : '#fbbf24'} />
        </div>
      )}
      <div className="relative z-10 p-3 sm:p-4">
        <div className="flex items-start justify-between">
          <div className={`text-3xl sm:text-4xl font-black tabular-nums tracking-tight ${color} drop-shadow-sm`}>
            {animated}
          </div>
          {gaugeMax && (
            <CircularGauge value={value} max={gaugeMax} color={color === 'text-cyan-300' ? '#22d3ee' : color === 'text-red-400' ? '#f87171' : '#fbbf24'} />
          )}
        </div>
        <div className="mt-1 text-[8px] font-bold uppercase tracking-[0.2em] text-slate-500 group-hover:text-slate-400 transition-colors duration-300">
          {label}
        </div>
      </div>
    </div>
  );
}

function MunicipalityChip({ name, active, index, reportCount }) {
  return (
    <span className={`inline-flex items-center gap-2.5 rounded-xl px-4 py-2 text-xs font-semibold tracking-wide transition-all duration-500 cursor-default
      ${active
        ? 'bg-gradient-to-r from-cyan-500/10 to-teal-500/10 text-cyan-200 ring-1 ring-cyan-400/15 shadow-[0_0_20px_rgba(34,211,238,0.04)]'
        : 'bg-slate-800/30 text-slate-500 ring-1 ring-slate-700/20 hover:bg-slate-700/40 hover:text-slate-300'
      }`}
      style={{ transitionDelay: `${index * 60}ms` }}>
      <span className="relative flex h-[7px] w-[7px]">
        {active && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400/40" style={{ animationDuration: '2s' }} />
        )}
        <span className={`relative inline-flex h-[7px] w-[7px] rounded-full ${active ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.4)]' : 'bg-slate-600'}`} />
      </span>
      <span>{name}</span>
      {reportCount !== undefined && (
        <span className={`text-[9px] font-mono tabular-nums ${active ? 'text-cyan-400/50' : 'text-slate-600'}`}>
          {reportCount}
        </span>
      )}
    </span>
  );
}

function useTimeAgo(timestamp) {
  const [label, setLabel] = useState('');
  const update = useCallback(() => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 5) setLabel('unos segundos');
    else if (diff < 60) setLabel(`${diff}s`);
    else {
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setLabel(`${mins}m ${secs}s`);
    }
  }, [timestamp]);
  useEffect(() => {
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [update]);
  return label;
}

function DigitalClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () => {
      const d = new Date();
      setTime(d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="tabular-nums text-slate-500 font-mono text-[10px]">{time}</span>;
}

/* ─── Voice Wave Title ─── */
function VoiceWave() {
  const bars = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 40; i++) {
      const center = 20;
      const dist = Math.abs(i - center);
      const height = Math.max(2, 14 - dist * 0.35 + (Math.random() * 4 - 2));
      arr.push({ height, delay: Math.random() * 0.8 });
    }
    return arr;
  }, []);

  return (
    <div className="flex items-center justify-center gap-[2px] h-8">
      {bars.map((b, i) => (
        <div
          key={i}
          className="w-[2.5px] rounded-full bg-gradient-to-t from-cyan-500/20 to-cyan-300/40"
          style={{
            height: `${b.height}px`,
            animation: `waveAnim 1.2s ease-in-out ${b.delay}s infinite alternate`,
          }}
        />
      ))}
      <style>{`
        @keyframes waveAnim {
          0% { transform: scaleY(0.3); opacity: 0.2; }
          50% { transform: scaleY(1); opacity: 0.6; }
          100% { transform: scaleY(0.3); opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}

function PulseRing() {
  return (
    <span className="absolute -top-8 left-1/2 -translate-x-1/2 w-32 h-32 pointer-events-none">
      <span className="absolute inset-0 rounded-full border border-cyan-400/10 animate-ping" style={{ animationDuration: '3s' }} />
      <span className="absolute inset-2 rounded-full border border-cyan-400/8 animate-ping" style={{ animationDuration: '3s', animationDelay: '0.5s' }} />
      <span className="absolute inset-4 rounded-full border border-teal-400/6 animate-ping" style={{ animationDuration: '3s', animationDelay: '1s' }} />
    </span>
  );
}

/* ─── Main Component ─── */
const sparklines = {
  reportes: [180, 195, 210, 205, 225, 218, 235, 240, 238, 245],
  alerta: [0, 1, 0, 2, 1, 0, 1, 2, 1, 2],
  sino: [0, 1, 0, 0, 1, 0, 1, 0, 0, 1],
};

const MOCK_DATA = {
  reportes: 245,
  alerta: 2,
  sino: 1,
  municipios: [
    { name: 'Itagüí', active: true, reports: 62 },
    { name: 'Envigado', active: true, reports: 45 },
    { name: 'Sabaneta', active: false, reports: 28 },
  ],
};

export default function CityDashboard() {
  const [data] = useState(MOCK_DATA);
  const [timestamp] = useState(Date.now() - 2500);
  const timeAgo = useTimeAgo(timestamp);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#071B35] p-4 sm:p-6 overflow-hidden font-sans">
      {/* Aurora */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-cyan-500/4 to-blue-500/2 blur-3xl animate-pulse" style={{ animationDuration: '7s' }} />
        <div className="absolute top-1/3 -right-20 w-[500px] h-[500px] rounded-full bg-gradient-to-bl from-teal-500/4 to-emerald-500/2 blur-3xl animate-pulse" style={{ animationDuration: '9s', animationDelay: '-3s' }} />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] rounded-full bg-blue-500/2 blur-3xl animate-pulse" style={{ animationDuration: '11s', animationDelay: '-6s' }} />
      </div>

      {/* Grid */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.02]"
        style={{ backgroundImage: 'linear-gradient(rgba(34,211,238,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.3) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="relative w-full max-w-md">
        {/* Outer glow */}
        <div className="absolute -inset-[3px] rounded-3xl bg-gradient-to-b from-cyan-400/10 via-teal-400/5 to-transparent opacity-50 blur-md" />

        {/* Card */}
        <div className="relative rounded-3xl bg-slate-900/80 shadow-[0_8px_40px_rgba(0,0,0,0.5)] ring-1 ring-white/[0.04] overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
          <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-cyan-500/4 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full bg-teal-500/3 blur-3xl pointer-events-none" />

          <div className="relative px-5 sm:px-7 py-6 sm:py-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <LiveDot />
                <span className="text-[8px] font-mono uppercase tracking-[0.25em] text-emerald-400/50 font-semibold">
                  En vivo
                </span>
              </div>
              <DigitalClock />
            </div>

            {/* Voice wave visual */}
            <div className="relative">
              <PulseRing />
              <VoiceWave />
            </div>

            {/* Title */}
            <h1 className="mt-3 text-center text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight">
              <span className="bg-gradient-to-r from-cyan-200 via-cyan-300 to-teal-300 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(34,211,238,0.15)]">
                La ciudad habla
              </span>
            </h1>

            {/* Subtitle */}
            <div className="mt-3 flex items-center justify-center gap-3">
              <span className="block w-[3px] h-5 rounded-full bg-gradient-to-b from-cyan-400 to-teal-400 shadow-[0_0_6px_rgba(34,211,238,0.2)]" />
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Valle de Aburrá — datos ahora
              </p>
            </div>

            {/* Metrics */}
            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
              <MetricTile value={data.reportes} label="Reportes" color="text-cyan-300"
                bg="bg-gradient-to-br from-cyan-500/8 to-cyan-500/3"
                sparkData={sparklines.reportes} gaugeMax={300} />
              <MetricTile value={data.alerta} label="Alertas" color="text-red-400"
                bg="bg-gradient-to-br from-red-500/8 to-red-500/3"
                sparkData={sparklines.alerta} gaugeMax={5} />
              <MetricTile value={data.sino} label="Sino" color="text-amber-400"
                bg="bg-gradient-to-br from-amber-500/8 to-amber-500/3"
                sparkData={sparklines.sino} gaugeMax={5} />
            </div>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />
              <span className="text-[8px] font-mono uppercase tracking-[0.25em] text-slate-600 font-semibold px-2">
                Municipios
              </span>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-slate-700/50 to-transparent" />
            </div>

            {/* Municipality chips */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {data.municipios.map((m, i) => (
                <MunicipalityChip key={m.name} name={m.name} active={m.active} index={i} reportCount={m.reports} />
              ))}
            </div>

            {/* Footer */}
            <div className="mt-5 pt-4 border-t border-slate-800/50 text-center">
              <p className="text-[9px] font-mono tracking-wide text-slate-600/70">
                <span className="text-slate-500/50 mr-1">↻</span>
                Actualizado hace{' '}
                <span className="text-slate-400 font-semibold tabular-nums">{timeAgo}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
