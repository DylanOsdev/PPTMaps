import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useDevicePerformance } from '../../../hooks/useDevicePerformance';
import { seededRandom } from '../../../utils/random';

const NETWORK_CSS = `
@keyframes nodePulse {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.3); opacity: 1; }
}
@keyframes dataFlow {
  0% { stroke-dashoffset: 20; }
  100% { stroke-dashoffset: 0; }
}
@keyframes signalWave {
  0% { r: 4; opacity: 0.6; }
  100% { r: 20; opacity: 0; }
}
@keyframes statusBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
@keyframes latencyBar {
  0%, 100% { width: var(--latency-pct); }
  50% { width: calc(var(--latency-pct) + 5%); }
}
`;

const NODES = [
  { id: 'medellin', label: 'MEDELLÍN', x: 50, y: 42, type: 'hub', status: 'online', latency: 12 },
  { id: 'bello', label: 'BELLO', x: 48, y: 28, type: 'relay', status: 'online', latency: 8 },
  { id: 'copacabana', label: 'COPACABANA', x: 44, y: 20, type: 'relay', status: 'online', latency: 11 },
  { id: 'girardota', label: 'GIRARDOTA', x: 40, y: 14, type: 'endpoint', status: 'online', latency: 14 },
  { id: 'barbosa', label: 'BARBOSA', x: 36, y: 10, type: 'endpoint', status: 'warning', latency: 32 },
  { id: 'envigado', label: 'ENVIGADO', x: 55, y: 54, type: 'sensor', status: 'online', latency: 6 },
  { id: 'sabaneta', label: 'SABANETA', x: 52, y: 64, type: 'sensor', status: 'online', latency: 7 },
  { id: 'la_estrella', label: 'LA ESTRELLA', x: 46, y: 68, type: 'sensor', status: 'online', latency: 9 },
  { id: 'itagui', label: 'ITAGÜÍ', x: 40, y: 56, type: 'sensor', status: 'online', latency: 10 },
  { id: 'caldas', label: 'CALDAS', x: 34, y: 62, type: 'sensor', status: 'offline', latency: 0 },
];

const CONNECTIONS = [
  ['medellin', 'bello'], ['medellin', 'envigado'], ['medellin', 'itagui'],
  ['bello', 'copacabana'], ['copacabana', 'girardota'], ['girardota', 'barbosa'],
  ['envigado', 'sabaneta'], ['sabaneta', 'la_estrella'], ['itagui', 'caldas'],
  ['itagui', 'la_estrella'], ['bello', 'envigado'], ['medellin', 'sabaneta'],
];

const STATUS_COLORS = {
  online: { dot: '#22d3ee', ring: 'rgba(34,211,238,0.3)', text: 'text-cyan-400', label: 'ONLINE' },
  warning: { dot: '#eab308', ring: 'rgba(234,179,8,0.3)', text: 'text-yellow-400', label: 'DEGRADADO' },
  offline: { dot: '#ef4444', ring: 'rgba(239,68,68,0.3)', text: 'text-red-400', label: 'OFFLINE' },
};

const NODE_TYPES = {
  hub: { size: 10, icon: '◈', color: '#22d3ee' },
  relay: { size: 8, icon: '◆', color: '#67e8f9' },
  endpoint: { size: 7, icon: '●', color: '#a78bfa' },
  sensor: { size: 5, icon: '•', color: '#94a3b8' },
};

function NetworkTopology({ nodes, connections, elapsed }) {
  const nodeMap = useMemo(() => {
    const map = {};
    nodes.forEach(n => { map[n.id] = n; });
    return map;
  }, [nodes]);

  return (
    <svg viewBox="0 0 100 80" className="w-full h-full" style={{ filter: 'drop-shadow(0 0 20px rgba(34,211,238,0.1))' }}>
      <defs>
        <radialGradient id="topoGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <filter id="nodeGlow">
          <feGaussianBlur stdDeviation="0.8" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <circle cx="50" cy="40" r="35" fill="url(#topoGlow)" />

      {/* Grid rings */}
      {[12, 22, 32].map((r, i) => (
        <circle key={`ring-${i}`} cx="50" cy="40" r={r} fill="none"
          stroke="rgba(34,211,238,0.03)" strokeWidth="0.15"
          strokeDasharray={i % 2 === 0 ? '1 3' : 'none'} />
      ))}

      {/* Connections */}
      {connections.map(([fromId, toId], i) => {
        const from = nodeMap[fromId];
        const to = nodeMap[toId];
        if (!from || !to) return null;
        const fromStatus = STATUS_COLORS[from.status];
        const toStatus = STATUS_COLORS[to.status];
        const bothOnline = from.status === 'online' && to.status === 'online';
        const opacity = bothOnline ? 0.15 : 0.05;
        const dashArray = bothOnline ? '2 4' : '1 6';

        return (
          <g key={`conn-${i}`}>
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={bothOnline ? '#22d3ee' : '#64748b'}
              strokeWidth="0.2" strokeDasharray={dashArray} opacity={opacity}>
              {bothOnline && (
                <animate attributeName="stroke-dashoffset" from="20" to="0"
                  dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
              )}
            </line>
            {bothOnline && (
              <circle r="0.6" fill="#22d3ee" opacity="0.4">
                <animateMotion dur={`${3 + i * 0.5}s`} repeatCount="indefinite"
                  path={`M${from.x},${from.y} L${to.x},${to.y}`} />
              </circle>
            )}
          </g>
        );
      })}

      {/* Nodes */}
      {nodes.map((node, i) => {
        const typeInfo = NODE_TYPES[node.type];
        const statusInfo = STATUS_COLORS[node.status];
        const pulse = Math.sin(elapsed * 0.003 + i * 1.2) * 0.5 + 0.5;

        return (
          <g key={node.id}>
            {/* Signal ring */}
            {node.status === 'online' && (
              <circle cx={node.x} cy={node.y} r={typeInfo.size * 0.4}
                fill="none" stroke={statusInfo.dot} strokeWidth="0.15" opacity={0.2 + pulse * 0.3}>
                <animate attributeName="r" values={`${typeInfo.size * 0.4};${typeInfo.size * 0.8};${typeInfo.size * 0.4}`}
                  dur="3s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.3;0;0.3" dur="3s"
                  begin={`${i * 0.4}s`} repeatCount="indefinite" />
              </circle>
            )}

            {/* Node core */}
            <circle cx={node.x} cy={node.y} r={typeInfo.size * 0.35}
              fill={statusInfo.dot} filter="url(#nodeGlow)"
              opacity={node.status === 'offline' ? 0.3 : 0.8 + pulse * 0.2} />

            {/* Node label */}
            <text x={node.x} y={node.y + typeInfo.size * 0.5 + 2.5}
              textAnchor="middle" fill="rgba(148,163,184,0.5)"
              fontSize="1.8" fontFamily="monospace" letterSpacing="0.5">
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LatencyChart({ nodes }) {
  const onlineNodes = nodes.filter(n => n.status !== 'offline');
  const maxLatency = Math.max(...onlineNodes.map(n => n.latency), 1);

  return (
    <div className="space-y-2">
      {onlineNodes.slice(0, 6).map((node, i) => {
        const pct = (node.latency / maxLatency) * 100;
        const color = node.latency < 15 ? '#22d3ee' : node.latency < 30 ? '#a78bfa' : '#eab308';
        return (
          <div key={node.id} className="flex items-center gap-3">
            <span className="font-mono text-[9px] text-slate-500 w-20 truncate">{node.label}</span>
            <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
              <motion.div className="h-full rounded-full origin-left"
                initial={{ scaleX: 0 }} animate={{ scaleX: pct / 100 }}
                transition={{ duration: 1.2, delay: 0.3 + i * 0.1, ease: 'easeOut' }}
                style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}60` }} />
            </div>
            <span className="font-mono text-[10px] tabular-nums w-10 text-right" style={{ color }}>
              {node.latency}ms
            </span>
          </div>
        );
      })}
    </div>
  );
}

function NetworkStats({ nodes }) {
  const online = nodes.filter(n => n.status === 'online').length;
  const warning = nodes.filter(n => n.status === 'warning').length;
  const offline = nodes.filter(n => n.status === 'offline').length;
  const avgLatency = Math.round(nodes.filter(n => n.status !== 'offline').reduce((a, n) => a + n.latency, 0) / (online + warning) || 0);
  const uptime = ((online / nodes.length) * 100).toFixed(1);

  const stats = [
    { label: 'NODOS', value: nodes.length, color: '#22d3ee' },
    { label: 'ONLINE', value: online, color: '#22d3ee' },
    { label: 'DEGRADADOS', value: warning, color: '#eab308' },
    { label: 'OFFLINE', value: offline, color: '#ef4444' },
    { label: 'LATENCIA', value: `${avgLatency}ms`, color: '#a78bfa' },
    { label: 'UPTIME', value: `${uptime}%`, color: '#22d3ee' },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((stat, i) => (
        <motion.div key={stat.label}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 + i * 0.08, duration: 0.5 }}
          className="bg-white/[0.02] border border-white/[0.04] rounded-xl px-3 py-2.5 text-center">
          <div className="font-mono text-xl font-bold tabular-nums" style={{ color: stat.color }}>
            {stat.value}
          </div>
          <div className="font-mono text-[7px] text-slate-500 tracking-[0.2em] mt-0.5">
            {stat.label}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function DataFlowStream() {
  const messages = useMemo(() => [
    '[SAT] GPS-24 Signal: -120 dBm · SNR 42dB',
    '[NET] Mesh topology: 8/10 nodes active',
    '[REL] Bogotá relay: 18ms latency · 99.97% uptime',
    '[SNS] Envigado sensor batch: 1,247 readings/s',
    '[LAT] Cali-Cartagena link: 22ms · 0 packet loss',
    '[HUB] Medellín hub: processing 2.4K events/min',
    '[WRN] Cartagena: signal degradation · switching to backup',
    '[OFF] Sabaneta: last heartbeat 47s ago · initiating reconnect',
  ], []);

  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let timeoutId;
    const interval = setInterval(() => {
      setVisible(false);
      timeoutId = setTimeout(() => {
        setIndex(prev => (prev + 1) % messages.length);
        setVisible(true);
      }, 300);
    }, 4000);
    return () => { clearInterval(interval); clearTimeout(timeoutId); };
  }, [messages.length]);

  return (
    <div className="bg-[#041327]/60 border border-cyan-400/10 rounded-xl px-4 py-3 overflow-hidden">
      <div className="flex items-center gap-2 mb-2">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-400" />
        </span>
        <span className="font-mono text-[8px] text-cyan-400/40 tracking-[0.25em] uppercase">Network Stream</span>
      </div>
      <div className="font-mono text-[10px] text-cyan-300/70 tracking-wide h-4">
        {visible && (
          <motion.div key={index}
            initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.2 }}>
            {messages[index]}
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default React.memo(function SatelliteNetwork() {
  const { config, tier } = useDevicePerformance();
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    startRef.current = performance.now();
    let raf;
    const step = (now) => {
      setElapsed(now - startRef.current);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const nodeCount = tier === 'HIGH' ? NODES.length : tier === 'MEDIUM' ? 7 : 5;
  const visibleNodes = useMemo(() => NODES.slice(0, nodeCount), [nodeCount]);
  const visibleConnections = useMemo(() =>
    CONNECTIONS.filter(([a, b]) => visibleNodes.some(n => n.id === a) && visibleNodes.some(n => n.id === b)),
    [visibleNodes]
  );

  return (
    <div className="w-full h-full relative flex items-center justify-center overflow-hidden bg-[#041327]">
      <style>{NETWORK_CSS}</style>

      {/* Background grid */}
      <div className="absolute inset-0 cartographic-grid opacity-[0.04] pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(34,211,238,0.03) 0%, transparent 60%)' }} />

      <div className="absolute inset-0 flex flex-col px-6 md:px-12 lg:px-20 pt-20 pb-8 z-10">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex items-center justify-between mb-6 pb-4 border-b border-white/[0.03] flex-none">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-cyan-400 animate-ping opacity-50" />
            </div>
            <div>
              <h2 className="font-['Space_Grotesk'] text-2xl md:text-3xl font-bold text-white tracking-tight">
                Red Satelital
              </h2>
              <p className="font-mono text-[9px] text-cyan-400/40 tracking-[0.2em] uppercase mt-0.5">
                Conectividad de red en tiempo real
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <span className="font-mono text-[9px] text-slate-500">MESH TOPOLOGY</span>
            <span className="w-px h-3 bg-white/[0.06]" />
            <span className="font-mono text-[9px] text-cyan-400/60 tabular-nums">
              {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </motion.div>

        <div className="flex-1 flex flex-col lg:flex-row gap-5 min-h-0">
          {/* LEFT: Topology */}
          <div className="w-full lg:w-[60%] flex flex-col">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="flex-1 bg-white/[0.02] border border-white/[0.04] rounded-2xl p-4 relative overflow-hidden">
              <div className="absolute top-3 left-4 font-mono text-[8px] text-cyan-400/30 tracking-[0.2em] uppercase">
                Topología de Red
              </div>
              <div className="w-full h-full pt-6">
                <NetworkTopology nodes={visibleNodes} connections={visibleConnections} elapsed={elapsed} />
              </div>
            </motion.div>
          </div>

          {/* RIGHT: Stats + Latency */}
          <div className="w-full lg:w-[40%] flex flex-col gap-4">
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}>
              <NetworkStats nodes={visibleNodes} />
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-4 flex-1">
              <div className="font-mono text-[8px] text-cyan-400/30 tracking-[0.2em] uppercase mb-3">
                Latencia por Nodo
              </div>
              <LatencyChart nodes={visibleNodes} />
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7, duration: 0.6 }}>
              <DataFlowStream />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
});
