import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';

const LAYER_DATA = [
  { id: 0, name: "VALLE DEL ABURRÁ", color: "#22D3EE", tag: "MAP", desc: "16 comunas, 9 municipios del área metropolitana con polígonos georreferenciados", icon: "🗺️", badge: "16", unit: "comunas" },
  { id: 1, name: "TELEMETRÍA VIAL", color: "#3B82F6", tag: "GPS", desc: "Posición de conductores en tiempo real + predicción de congestión por ML", icon: "📡", badge: "128", unit: "vehículos" },
  { id: 2, name: "ACCIDENTES Y FATALIDADES", color: "#EF4444", tag: "COL", desc: "Clusters DBSCAN de accidentes y reportes de fatalidades en vivo", icon: "⚠️", badge: "47", unit: "incidentes" },
  { id: 3, name: "SIATA Y CLIMA", color: "#F59E0B", tag: "ENV", desc: "Riesgo de lluvia a 2h, zonas inundables y alertas meteorológicas", icon: "🌧️", badge: "12", unit: "estaciones" },
  { id: 4, name: "REPORTES CIUDADANOS", color: "#8B5CF6", tag: "REP", desc: "Colisiones, inundaciones y obstáculos reportados por la comunidad", icon: "📢", badge: "89", unit: "reportes" },
  { id: 5, name: "RUTAS SEGURAS", color: "#10B981", tag: "SAFE", desc: "Rutas optimizadas evitando zonas de riesgo con datos de movilidad", icon: "🛣️", badge: "6", unit: "rutas" },
];

const STATS_DATA = [
  { label: "Capas totales", value: "6" },
  { label: "Fuentes de datos", value: "4" },
  { label: "Actualización", value: "30s" },
  { label: "Cobertura", value: "Valle Aburrá" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};

const childVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
};

const CardDecorSVG = React.memo(({ color, isActive, index }) => {
  const pts = index % 2 === 0
    ? "20,20 40,50 80,30 60,80 20,20"
    : "10,50 30,20 50,50 70,30 90,50";
  const dots = index % 2 === 0
    ? [[20,20],[40,50],[80,30],[60,80],[30,70],[70,60]]
    : [[10,50],[30,20],[50,50],[70,30],[90,50]];
  return (
    <svg viewBox="0 0 100 100" className="w-3/4 h-3/4"
      style={{ opacity: isActive ? 0.7 : 0.35, transition: 'opacity 0.3s' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1" />
      {dots.map((pt, i) => (
        <circle key={i} cx={pt[0]} cy={pt[1]} r={isActive ? 2.2 : 1.5} fill={color} />
      ))}
    </svg>
  );
});

const LayerBadge = React.memo(({ layer, isActive }) => (
  <motion.div
    className="absolute top-2 right-2 flex flex-col items-center pointer-events-none z-10"
    animate={{ opacity: isActive ? 1 : 0.45, scale: isActive ? 1 : 0.9 }}
    transition={{ duration: 0.2 }}
  >
    <span className="font-mono text-base md:text-lg font-black leading-none text-white"
      style={{ textShadow: `0 0 10px ${layer.color}` }}>
      {layer.badge}
    </span>
    <span className="font-mono text-[6px] uppercase tracking-wider text-slate-500">{layer.unit}</span>
  </motion.div>
));

const LayerLabel = React.memo(({ layer, isActive }) => (
  <motion.div
    className="absolute -bottom-7 left-0 right-0 flex items-center justify-center pointer-events-none"
    animate={{ opacity: isActive ? 1 : 0.5, y: isActive ? 0 : 4 }}
    transition={{ duration: 0.25 }}
  >
    <span className="font-mono text-[10px] md:text-[11px] font-bold tracking-widest whitespace-nowrap"
      style={{ color: layer.color }}>
      {layer.name}
    </span>
  </motion.div>
));

function LayerCard({ layer, index, isActive, zOffset, isAnyActive, isOpen, onHover, onLeave, onClick }) {
  const mid = 2.5;
  const fanSpread = isOpen ? (index - mid) * 40 : 0;
  const fanRotate = isOpen ? (index - mid) * 5 : 0;
  const fanY = isOpen ? (index - mid) * -18 : 0;
  const lift = isActive ? 80 : 0;
  const dim = isAnyActive && !isActive;
  return (
    <motion.div
      className="absolute w-full h-full"
      style={{ transformStyle: 'preserve-3d', cursor: 'pointer' }}
      onHoverStart={onHover}
      onHoverEnd={onLeave}
      onTap={onClick}
      animate={{
        x: fanSpread,
        y: fanY,
        z: zOffset + lift,
        rotateZ: fanRotate,
        scale: isActive ? 1.12 : 1,
      }}
      transition={{ type: 'spring', stiffness: 180, damping: 22, mass: 0.6, delay: index * 0.02 }}
    >
      <div
        className="w-full h-full rounded-lg border-2 relative overflow-hidden"
        style={{
          backgroundColor: isActive ? `${layer.color}50` : `${layer.color}06`,
          borderColor: isActive ? layer.color : `${layer.color}30`,
          boxShadow: isActive
            ? `0 0 70px ${layer.color}60, 0 0 140px ${layer.color}25, inset 0 0 60px ${layer.color}18`
            : dim ? 'none' : `0 0 8px ${layer.color}06`,
          filter: dim ? 'brightness(0.45) saturate(0.25)' : 'none',
          transition: 'background-color 0.3s, border-color 0.3s, box-shadow 0.3s, filter 0.3s',
        }}
      >
        <div className="absolute inset-0 pointer-events-none rounded-lg"
          style={{
            opacity: 0.4,
            backgroundImage: `linear-gradient(${layer.color}25 1px, transparent 1px), linear-gradient(90deg, ${layer.color}25 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
        <LayerBadge layer={layer} isActive={isActive} />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-xl">
          <CardDecorSVG color={layer.color} isActive={isActive} index={index} />
        </div>
        <div className="absolute inset-0 pointer-events-none rounded-xl"
          style={{
            background: isActive
              ? `radial-gradient(circle at center, ${layer.color}35 0%, transparent 70%)`
              : 'none',
            animation: isActive ? 'glow-pulse 2s ease-in-out infinite' : 'none',
          }}
        />
      </div>
      <LayerLabel layer={layer} isActive={isActive} />
    </motion.div>
  );
}

function InfoPanel({ layer, isLocked }) {
  return (
    <motion.div
      className="p-3.5 rounded-lg border max-w-xs mx-auto md:mx-0"
      style={{ borderColor: `${layer.color}40`, background: `${layer.color}08` }}
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center gap-2.5 mb-1.5">
        <span className="text-lg">{layer.icon}</span>
        <span className="font-mono text-[11px] font-bold tracking-wide" style={{ color: layer.color }}>
          {layer.name}
        </span>
        {isLocked && (
          <span className="ml-auto text-[9px] text-slate-500 font-mono">🔒</span>
        )}
      </div>
      <p className="font-mono text-[9px] text-slate-400 leading-relaxed">{layer.desc}</p>
      <div className="flex gap-3 mt-2 pt-2" style={{ borderTop: `1px solid ${layer.color}15` }}>
        <span className="font-mono text-[8px] text-slate-500">
          <strong style={{ color: layer.color }}>{layer.badge}</strong> {layer.unit}
        </span>
        <span className="font-mono text-[8px] text-slate-500">
          Tag: <strong style={{ color: layer.color }}>{layer.tag}</strong>
        </span>
      </div>
    </motion.div>
  );
}

export default React.memo(function LayersSection() {
  const [hoveredLayer, setHoveredLayer] = useState(null);
  const [lockedLayer, setLockedLayer] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  const activeLayer = lockedLayer !== null ? lockedLayer : hoveredLayer;

  const handleCardHover = useCallback((i) => { if (lockedLayer === null) setHoveredLayer(i); }, [lockedLayer]);
  const handleCardLeave = useCallback(() => { if (lockedLayer === null) setHoveredLayer(null); }, [lockedLayer]);
  const handleCardClick = useCallback((i) => {
    setLockedLayer((prev) => (prev === i ? null : i));
  }, []);

  const activeColor = activeLayer !== null ? LAYER_DATA[activeLayer].color : null;
  return (
    <section ref={sectionRef}
      className="w-full min-h-screen flex flex-col md:flex-row items-center justify-center overflow-hidden px-6 md:px-12 relative py-16 md:py-0"
      style={{ backgroundColor: '#041327', transition: 'background-color 0.8s ease' }}
    >
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: activeColor
            ? `radial-gradient(ellipse 80% 60% at 60% 50%, ${activeColor}18 0%, transparent 70%)`
            : 'none',
          transition: 'background 0.8s ease',
        }}
      />

      <motion.div
        className="w-full md:w-[38%] mb-10 md:mb-0 z-20 text-center md:text-left flex-shrink-0 md:pl-8"
        variants={containerVariants}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
      >
        <motion.p variants={childVariants}
          className="font-mono text-base md:text-lg text-cyan-400 tracking-[0.2em] font-bold uppercase mb-3">
          Sistema de Capas
        </motion.p>

        <motion.h2 variants={childVariants}
          className="text-[3rem] sm:text-[4.5rem] md:text-[6.5rem] lg:text-[8rem] font-black mb-8 leading-[1.0] text-white tracking-tight"
          style={{ fontFamily: "'Space Grotesk', sans-serif", textShadow: '0 0 40px rgba(34,211,238,0.1)' }}>
          CAPAS<br className="hidden sm:block" />
          <span className="bg-gradient-to-r from-cyan-200 via-cyan-300 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(34,211,238,0.3)]">
            DINÁMICAS
          </span>
        </motion.h2>

        <motion.p variants={childVariants}
          className="text-base md:text-lg text-slate-400 max-w-lg mx-auto md:mx-0 font-light leading-relaxed">
          Datos geoespaciales multicapa del Valle de Aburrá integrados en un tablero de comando con actualización en tiempo real.
        </motion.p>

        <motion.div variants={childVariants} className="grid grid-cols-2 gap-3 mt-8 max-w-sm mx-auto md:mx-0">
          {STATS_DATA.map((s, i) => (
            <div key={i} className="border rounded-lg px-4 py-3" style={{ borderColor: 'rgba(56,189,248,0.18)', background: 'rgba(8,21,37,0.5)' }}>
              <div className="font-mono text-sm md:text-base font-bold" style={{ color: '#67e8f9' }}>{s.value}</div>
              <div className="font-mono text-[9px] text-slate-500 tracking-wider uppercase mt-0.5">{s.label}</div>
            </div>
          ))}
        </motion.div>

        <AnimatePresence mode="wait">
          {activeLayer !== null && (
            <InfoPanel
              key={lockedLayer !== null ? `locked-${activeLayer}` : activeLayer}
              layer={LAYER_DATA[activeLayer]}
              isLocked={lockedLayer !== null}
            />
          )}
        </AnimatePresence>
      </motion.div>

      <motion.div
        className="w-full md:w-[62%] h-[500px] md:h-[580px] relative flex items-center justify-center mt-4 md:mt-0"
        style={{ perspective: '1000px' }}
        initial={{ opacity: 0, x: 40 }}
        animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 }}
        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 }}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0"
          style={{
            width: '320px', height: '320px',
            background: 'radial-gradient(circle, rgba(34,211,238,0.08) 0%, transparent 70%)',
            animation: 'glow-pulse 4s ease-in-out infinite',
          }}
        />

        <motion.div
          className="relative w-[280px] h-[280px] md:w-[400px] md:h-[400px] z-10"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.35 }}
        >
          <motion.div className="relative w-full h-full"
            style={{ transformStyle: 'preserve-3d' }}
            animate={isOpen ? {
              rotateX: 56, rotateZ: -30, y: 30, rotateY: 0,
            } : {
              rotateX: 56, rotateZ: -30, y: 30,
              rotateY: [-1.5, 1.5, -1.5],
            }}
            transition={isOpen ? { duration: 0.5 } : { repeat: Infinity, duration: 8, ease: 'easeInOut' }}
          >
            {LAYER_DATA.map((layer, i) => (
              <LayerCard
                key={layer.id}
                layer={layer}
                index={i}
                isActive={activeLayer === i}
                zOffset={i * -60}
                isOpen={isOpen}
                isAnyActive={activeLayer !== null}
                onHover={() => handleCardHover(i)}
                onLeave={handleCardLeave}
                onClick={() => handleCardClick(i)}
              />
            ))}
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
});
