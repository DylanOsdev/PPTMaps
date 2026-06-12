import React, { useMemo, useCallback } from 'react';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { seededRandom } from '../../../utils/random';
import { useDevicePerformance } from '../../../hooks/useDevicePerformance';

const TITLE = "PPTMAPS".split("");

const LETTER_VARIANTS = {
  initial: { y: 80, opacity: 0, scale: 0.3, filter: 'blur(12px)' },
  animate: (i) => ({
    y: 0,
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      delay: i * 0.15,
      duration: 1,
      ease: [0.16, 1, 0.3, 1],
    },
  }),
};

const STYLES = `
@keyframes starAnim {
  0%, 100% { opacity: var(--star-min-o); transform: scale(0.8) translate(0, 0); }
  33% { opacity: var(--star-mid-o); transform: scale(1) translate(var(--flt-x1), var(--flt-y1)); }
  66% { opacity: var(--star-max-o); transform: scale(1.2) translate(var(--flt-x2), var(--flt-y2)); }
}
@keyframes conShimmer {
  0%, 100% { opacity: var(--con-min); }
  50% { opacity: var(--con-max); }
}
@keyframes titlePulse {
  0%, 100% { text-shadow: 0 0 30px rgba(34,211,238,0.4), 0 0 60px rgba(34,211,238,0.2), 0 0 100px rgba(6,182,212,0.12); }
  50% { text-shadow: 0 0 50px rgba(34,211,238,0.7), 0 0 100px rgba(34,211,238,0.35), 0 0 150px rgba(6,182,212,0.25), 0 0 200px rgba(34,211,238,0.1); }
}
@keyframes scanSweep {
  0% { top: -3%; opacity: 0; }
  8% { opacity: 0.7; }
  92% { opacity: 0.7; }
  100% { top: 100%; opacity: 0; }
}
@keyframes orbitSpin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes orbitSpinReverse {
  0% { transform: rotate(360deg); }
  100% { transform: rotate(0deg); }
}
@keyframes floatParticle {
  0%, 100% { transform: translate(0, 0); opacity: 0; }
  20% { opacity: var(--part-op); }
  50% { transform: translate(var(--part-x), var(--part-y)); opacity: var(--part-op); }
  80% { opacity: 0.1; }
}
@keyframes pulseRing {
  0%, 100% { transform: scale(0.8) translate(-50%, -50%); opacity: 0.12; }
  50% { transform: scale(1.3) translate(-38%, -38%); opacity: 0.03; }
}
.star-css {
  position: absolute;
  border-radius: 9999px;
  animation: starAnim var(--star-dur) ease-in-out var(--star-del) infinite;
}
.con-line {
  stroke-linecap: round;
  animation: conShimmer 5s ease-in-out var(--con-del) infinite;
}
`;

function generateStars(count) {
  const rng = seededRandom(42);
  const colors = ['#fff', '#e0e7ff', '#a7f3d0', '#67e8f9', '#fde68a', '#fca5a5', '#c4b5fd'];
  const floatVars = [
    ['-2.5px','1.5px','2px','-1.5px'],
    ['2px','-2px','-2px','2.5px'],
    ['2.5px','1.5px','-2.5px','-2px'],
    ['-2px','-2.5px','2px','2px'],
  ];
  return Array.from({ length: count }, () => {
    const color = colors[Math.floor(rng() * colors.length)];
    const fi = Math.floor(rng() * 4);
    const f = floatVars[fi];
    const minO = 0.08 + rng() * 0.2;
    const maxO = 0.45 + rng() * 0.55;
    return {
      x: rng() * 100,
      y: rng() * 100,
      size: 0.4 + rng() * 2.6,
      delay: rng() * 8,
      duration: 3 + rng() * 5,
      minO, maxO, midO: (minO + maxO) / 2,
      color,
      layer: Math.floor(rng() * 4),
      fltX1: f[0], fltY1: f[1],
      fltX2: f[2], fltY2: f[3],
    };
  });
}

function generateConstellations(stars) {
  const rng = seededRandom(77);
  const cons = [];
  const threshold = 8;
  for (let i = 0; i < stars.length; i++) {
    for (let j = i + 1; j < stars.length; j++) {
      const dx = stars[i].x - stars[j].x;
      const dy = stars[i].y - stars[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < threshold && stars[i].layer === stars[j].layer && rng() > 0.6) {
        cons.push({
          x1: stars[i].x, y1: stars[i].y,
          x2: stars[j].x, y2: stars[j].y,
          layer: stars[i].layer,
          minOp: 0.01 + rng() * 0.03,
          maxOp: 0.03 + rng() * 0.05,
          delay: rng() * 8,
        });
      }
    }
  }
  return cons;
}

function generateParticles(count) {
  const rng = seededRandom(200);
  return Array.from({ length: count }, () => ({
    x: (rng() - 0.5) * 350,
    y: (rng() - 0.5) * 150,
    tx: (rng() - 0.5) * 70,
    ty: (rng() - 0.5) * 60,
    size: 2 + rng() * 3,
    delay: rng() * 4,
    duration: 5 + rng() * 5,
    opacity: 0.15 + rng() * 0.3,
  }));
}

const layers = [0, 1, 2, 3];

const ConstellationLines = React.memo(function ConstellationLines({ connections }) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-[1]" viewBox="0 0 100 100" preserveAspectRatio="none">
      {layers.map(layer => (
        <g key={layer}>
          {connections.filter(c => c.layer === layer).map((c, i) => (
            <line key={`cl-${layer}-${i}`}
              x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="0.06"
              className="con-line"
              style={{ '--con-min': c.minOp, '--con-max': c.maxOp, '--con-del': `${c.delay}s` }}
            />
          ))}
        </g>
      ))}
    </svg>
  );
});

const AuroraBackground = React.memo(function AuroraBackground() {
  const common = { filter: 'blur(40px)', willChange: 'transform' };
  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      <motion.div className="absolute top-[10%] left-0 w-[200%] h-[25%]"
        style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(34,211,238,0.04) 20%, rgba(6,182,212,0.06) 40%, transparent 80%)', ...common }}
        animate={{ x: ['-20%', '10%', '-5%', '-20%'] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="absolute top-[45%] left-[-10%] w-[180%] h-[20%]"
        style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(20,184,166,0.03) 30%, rgba(34,211,238,0.05) 50%, transparent 70%)', filter: 'blur(50px)', willChange: 'transform' }}
        animate={{ x: ['10%', '-15%', '5%', '10%'] }}
        transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.div className="absolute top-[70%] left-[20%] w-[150%] h-[18%]"
        style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(14,165,233,0.03) 25%, rgba(34,211,238,0.04) 50%, transparent 75%)', filter: 'blur(45px)', willChange: 'transform' }}
        animate={{ x: ['-5%', '20%', '-10%', '-5%'] }}
        transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut' }} />
    </div>
  );
});

const ScanLine = React.memo(function ScanLine() {
  return (
    <div className="absolute inset-0 pointer-events-none z-[3] overflow-hidden">
      <motion.div className="absolute left-0 right-0 h-[80px]"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, rgba(34,211,238,0.03) 30%, rgba(34,211,238,0.08) 50%, rgba(34,211,238,0.03) 70%, transparent 100%)',
          filter: 'blur(10px)',
          boxShadow: '0 0 30px rgba(34,211,238,0.05)',
          top: 0,
        }}
        animate={{ y: ['-100vh', '100vh'] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
});

const OrbitalRings = React.memo(function OrbitalRings() {
  const ringAngles = [0, 45, 90, 135, 180, 225, 270, 315];
  const dotAngles = [0, 72, 144, 216, 288];
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[5]">
      <div className="relative w-[500px] h-[500px] md:w-[700px] md:h-[700px]">
        <div className="absolute inset-[10%] rounded-full border border-cyan-400/5"
          style={{ animation: 'orbitSpin 40s linear infinite' }} />
        <div className="absolute inset-[22%] rounded-full border border-cyan-400/3 border-dashed"
          style={{ animation: 'orbitSpinReverse 30s linear infinite' }} />
        <div className="absolute inset-[35%] rounded-full border border-teal-400/3"
          style={{ animation: 'orbitSpin 50s linear infinite' }} />
        <div className="absolute inset-[0%] rounded-full border border-cyan-400/2"
          style={{ animation: 'orbitSpin 60s linear infinite' }} />
        <motion.div className="absolute top-1/2 left-1/2 w-[60%] h-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(34,211,238,0.06) 0%, transparent 60%)',
            animation: 'pulseRing 6s ease-in-out infinite',
          }} />
        {ringAngles.map((angle, i) => (
          <div key={i}
            className="absolute"
            style={{
              top: '50%', left: '50%', width: 0, height: 0,
              animation: `orbitSpin ${i % 2 === 0 ? '35' : '45'}s linear infinite`,
              animationDelay: `-${angle * 0.5}s`,
            }}>
            <div className="absolute w-2 h-2 rounded-full"
              style={{
                transform: 'translateY(-180px)',
                background: i % 2 === 0 ? 'rgba(34,211,238,0.25)' : 'rgba(6,182,212,0.2)',
                boxShadow: '0 0 8px rgba(34,211,238,0.2)',
              }} />
          </div>
        ))}
        {dotAngles.map((angle, i) => (
          <div key={`dot-${i}`}
            className="absolute"
            style={{
              top: '50%', left: '50%', width: 0, height: 0,
              animation: 'orbitSpinReverse 25s linear infinite',
              animationDelay: `-${angle * 0.3}s`,
            }}>
            <div className="absolute w-1 h-1 rounded-full bg-cyan-300/15"
              style={{ transform: 'translateY(-130px)' }} />
          </div>
        ))}
      </div>
    </div>
  );
});

const FloatingParticles = React.memo(function FloatingParticles({ particles }) {
  const colors = ['rgba(34,211,238,0.3)', 'rgba(6,182,212,0.25)', 'rgba(14,165,233,0.2)'];
  const shadows = ['rgba(34,211,238,0.15)', 'rgba(6,182,212,0.12)', 'rgba(14,165,233,0.1)'];
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[6]">
      {particles.map((p, i) => (
        <div key={i} className="absolute rounded-full"
          style={{
            width: p.size, height: p.size,
            background: colors[i % 3],
            '--part-x': `${p.tx}px`, '--part-y': `${p.ty}px`,
            '--part-op': p.opacity,
            animation: `floatParticle ${p.duration}s ease-in-out ${p.delay}s infinite`,
            boxShadow: `0 0 ${p.size * 4}px ${shadows[i % 3]}`,
          }} />
      ))}
    </div>
  );
});

const StarLayer = React.memo(function StarLayer({ stars, parallaxX, parallaxY, index }) {
  if (index === 3) {
    return (
      <motion.div className="absolute inset-0 pointer-events-none"
        animate={{ y: [0, -4, 0, 3, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}>
        {stars.map((star, i) => (
          <div key={i} className="star-css"
            style={{
              left: `${star.x}%`, top: `${star.y}%`,
              width: star.size, height: star.size,
              background: star.color,
              '--star-min-o': star.minO, '--star-mid-o': star.midO, '--star-max-o': star.maxO,
              '--star-dur': `${star.duration}s`, '--star-del': `${star.delay}s`,
              '--flt-x1': star.fltX1, '--flt-y1': star.fltY1,
              '--flt-x2': star.fltX2, '--flt-y2': star.fltY2,
              boxShadow: star.size > 1.5 ? `0 0 ${star.size * 3}px ${star.color}50` : star.size > 0.8 ? `0 0 ${star.size * 2}px ${star.color}30` : 'none',
            }} />
        ))}
      </motion.div>
    );
  }
  return (
    <motion.div className="absolute inset-0 pointer-events-none" style={{ x: parallaxX, y: parallaxY }}>
      {stars.map((star, i) => (
        <div key={i} className="star-css"
          style={{
            left: `${star.x}%`, top: `${star.y}%`,
            width: star.size, height: star.size,
            background: star.color,
            '--star-min-o': star.minO, '--star-mid-o': star.midO, '--star-max-o': star.maxO,
            '--star-dur': `${star.duration}s`, '--star-del': `${star.delay}s`,
            '--flt-x1': star.fltX1, '--flt-y1': star.fltY1,
            '--flt-x2': star.fltX2, '--flt-y2': star.fltY2,
            boxShadow: star.size > 1.5 ? `0 0 ${star.size * 3}px ${star.color}50` : star.size > 0.8 ? `0 0 ${star.size * 2}px ${star.color}30` : 'none',
          }} />
      ))}
    </motion.div>
  );
});

export default React.memo(function FinalCTA() {
  const { tier } = useDevicePerformance();
  const starCount = tier === 'HIGH' ? 250 : tier === 'MEDIUM' ? 120 : 60;
  const stars = useMemo(() => generateStars(starCount), [starCount]);
  const connections = useMemo(() => generateConstellations(stars), [stars]);
  const particles = useMemo(() => generateParticles(tier === 'HIGH' ? 20 : 8), [tier]);
  const starLayers = useMemo(() => layers.map(l => stars.filter(s => s.layer === l)), [stars]);

  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const springX = useSpring(mouseX, { stiffness: 20, damping: 40 });
  const springY = useSpring(mouseY, { stiffness: 20, damping: 40 });

  const pX = useCallback(v => (v - 0.5) * 2, []);
  const pY = useCallback(v => (v - 0.5) * 2, []);
  const nx = useTransform(springX, pX);
  const ny = useTransform(springY, pY);

  const l0x = useTransform(nx, v => v * -5);
  const l0y = useTransform(ny, v => v * -5);
  const l1x = useTransform(nx, v => v * -12);
  const l1y = useTransform(ny, v => v * -12);
  const l2x = useTransform(nx, v => v * -22);
  const l2y = useTransform(ny, v => v * -22);
  const titleX = useTransform(nx, v => v * -3);
  const titleY = useTransform(ny, v => v * -3);

  const handleMouseMove = useCallback((e) => {
    mouseX.set(e.clientX / window.innerWidth);
    mouseY.set(e.clientY / window.innerHeight);
  }, [mouseX, mouseY]);

  return (
    <div onMouseMove={handleMouseMove} className="w-full h-full flex flex-col items-center justify-center relative bg-black overflow-hidden selection:bg-cyan-400/30 contain-[layout_style_paint]"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 100vh' }}>
      <style>{STYLES}</style>

      <AuroraBackground />

      <div className="absolute inset-0 opacity-20 pointer-events-none z-[1]"
        style={{
          backgroundImage: 'linear-gradient(rgba(34,211,238,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.025) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }} />

      <ScanLine />

      {starLayers.map((layerStars, i) => (
        <StarLayer key={i} stars={layerStars} index={i}
          parallaxX={i === 0 ? l0x : i === 1 ? l1x : i === 2 ? l2x : undefined}
          parallaxY={i === 0 ? l0y : i === 1 ? l1y : i === 2 ? l2y : undefined} />
      ))}

      <ConstellationLines connections={connections} />

      <div className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(34,211,238,0.03) 0%, transparent 60%), radial-gradient(ellipse 50% 35% at 30% 40%, rgba(6,182,212,0.02) 0%, transparent 50%)',
        }} />

      <OrbitalRings />
      <FloatingParticles particles={particles} />

      <motion.div className="z-10 text-center flex flex-col items-center pointer-events-none"
        style={{ x: titleX, y: titleY }}>
        <div className="flex items-center justify-center gap-1 md:gap-3">
          {TITLE.map((letter, i) => (
            <motion.span key={i}
              className="text-6xl sm:text-7xl md:text-[10rem] font-['Space_Grotesk'] font-bold tracking-[0.15em] inline-block"
              style={{ color: '#fff', animation: 'titlePulse 4s ease-in-out infinite', animationDelay: `${i * 0.3}s` }}
              variants={LETTER_VARIANTS}
              initial="initial"
              animate="animate"
              custom={i}>
              {letter}
            </motion.span>
          ))}
        </div>

        <motion.div className="mt-6 md:mt-8 space-y-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.8, duration: 0.8 }}>
          <p className="text-sm md:text-lg text-white/60 font-light tracking-[0.5em] uppercase"
             style={{ textShadow: '0 0 30px rgba(34,211,238,0.2)' }}>
            Explorando el valle de aburrá
          </p>
          <p className="text-[10px] md:text-xs text-white/30 font-mono tracking-[0.3em] uppercase">
            desde el espacio · sistema activo
          </p>
        </motion.div>

        <motion.div className="mt-12 md:mt-16 w-56 h-[1px]"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(34,211,238,0.5) 15%, rgba(6,182,212,0.4) 40%, rgba(34,211,238,0.5) 70%, transparent 100%)',
            boxShadow: '0 0 10px rgba(34,211,238,0.15), 0 0 30px rgba(34,211,238,0.08)',
          }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 2, duration: 1.5, ease: 'easeOut' }} />

        <motion.p className="mt-6 font-mono text-[9px] text-white/20 tracking-[0.3em] uppercase"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.1, 0.35, 0.1] }}
          transition={{ duration: 5, repeat: Infinity, delay: 2.5 }}>
          6.2442° N — 75.5812° W — 2026
        </motion.p>
      </motion.div>

      <motion.div className="absolute bottom-0 left-0 right-0 h-[1px] pointer-events-none z-10"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(34,211,238,0.12) 20%, rgba(34,211,238,0.2) 50%, rgba(34,211,238,0.12) 80%, transparent 100%)',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1.5 }} />
    </div>
  );
});
