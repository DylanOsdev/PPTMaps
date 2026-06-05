import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import Particles from '../components/Particles.jsx';
import AnimatedText from '../components/AnimatedText.jsx';

const HERO_STATIC_NODES = [
  [150,300],[250,150],[400,200],[550,100],[700,250],[850,200],
  [800,450],[900,600],[750,700],[600,600],[500,800],[350,700],
  [200,800],[100,600],[250,500]
];

const FLOATING_DATA_POINTS = [
  { text: "6.2442° N, -75.5812° W", delay: 0,   top: "15%", left: "72%", repDelay: 2 },
  { text: "VALLE DE ABURRÁ",         delay: 1.5, top: "78%", left: "12%", repDelay: 3 },
  { text: "GPS ACTIVE: [NOMINAL]",   delay: 1,   top: "22%", left: "18%", repDelay: 1 },
  { text: "DATA STREAM // SYNCED",   delay: 2.5, top: "65%", left: "60%", repDelay: 4 },
  { text: "LATENCY: 28MS",           delay: 0.5, top: "42%", left: "82%", repDelay: 2 },
  { text: "TELEMETRY ON",            delay: 3,   top: "88%", left: "35%", repDelay: 3 },
];

const FloatingData = React.memo(() => (
  <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
    {FLOATING_DATA_POINTS.map((dp, i) => (
      <div
        key={i}
        className="absolute font-mono text-[9px] md:text-[10px] text-cyan-400/60 tracking-[0.2em] uppercase animate-float-up"
        style={{ top: dp.top, left: dp.left, animationDelay: `${dp.delay}s`, animationDuration: '4s' }}
      >
        {dp.text}
      </div>
    ))}
  </div>
));

const MiniStatusPanel = React.memo(() => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 2.5, duration: 1 }}
    className="flex flex-wrap items-center justify-center gap-3 md:gap-8 mt-10 py-3 px-6 md:px-10 backdrop-blur-md bg-slate-900/40 border border-cyan-400/30 rounded-full shadow-[0_0_25px_rgba(34,211,238,0.15)] relative overflow-hidden"
  >
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent animate-[shimmer_3s_infinite]" />
    
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22D3EE] animate-pulse" />
      <span className="font-mono text-[9px] md:text-xs text-cyan-400 tracking-widest font-bold">SISTEMA ONLINE</span>
    </div>
    
    <span className="text-slate-600 hidden md:block">|</span>
    <div className="font-mono text-[9px] md:text-xs text-slate-300 tracking-widest"><strong className="text-white">847</strong> GPS ACTIVOS</div>
    
    <span className="text-slate-600 hidden md:block">|</span>
    <div className="font-mono text-[9px] md:text-xs text-slate-300 tracking-widest"><strong className="text-white">16</strong> COMUNAS</div>
    
    <span className="text-slate-600 hidden md:block">|</span>
    <div className="font-mono text-[9px] md:text-xs text-slate-300 tracking-widest"><strong className="text-white">9</strong> CAPAS</div>
    
    <span className="text-slate-600 hidden md:block">|</span>
    <div className="font-mono text-[9px] md:text-xs text-slate-300 tracking-widest">LATENCIA: <strong className="text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]">28ms</strong></div>
  </motion.div>
));

function HeroCTA() {
  const navigate = useNavigate();
  const [isExpanding, setIsExpanding] = useState(false);
  const navTimerRef = useRef(null);

  const handleClick = () => {
    setIsExpanding(true);
    navTimerRef.current = setTimeout(() => navigate('/map'), 1200);
  };

  useEffect(() => {
    return () => clearTimeout(navTimerRef.current);
  }, []);

  return (
    <>
      <button
        onClick={handleClick}
        className="relative px-12 py-4 rounded-full bg-cyan-500/10 border border-cyan-400 text-cyan-400 font-bold text-sm md:text-base tracking-[0.25em] uppercase overflow-hidden group shadow-[0_0_20px_rgba(34,211,238,0.2)] hover:shadow-[0_0_40px_rgba(34,211,238,0.6)] transition-all duration-300 btn-holographic"
      >
        <span className="relative z-10 group-hover:text-black transition-colors duration-300">          Abrir Panel de Control</span>
        <div className="absolute inset-0 bg-cyan-400 -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out z-0" />
      </button>

      <AnimatePresence>
        {isExpanding && (
          <motion.div 
            className="fixed z-[100] bg-cyan-400 rounded-full pointer-events-none"
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 5, opacity: 1 }}
            transition={{ duration: 1.2, ease: "circIn" }}
            style={{ top: '50%', left: '50%', width: '100vmax', height: '100vmax', x: '-50%', y: '-50%' }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default React.memo(function HeroSection() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const layer1X = useTransform(mouseX, v => v * -10);
  const layer1Y = useTransform(mouseY, v => v * -10);
  const layer2X = useTransform(mouseX, v => v * -20);
  const layer2Y = useTransform(mouseY, v => v * -20);
  const layer3X = useTransform(mouseX, v => v * -40);
  const layer3Y = useTransform(mouseY, v => v * -40);
  const layer4X = useTransform(mouseX, v => v * -15);
  const layer4Y = useTransform(mouseY, v => v * -15);
  const layer5X = useTransform(mouseX, v => v * -5);
  const layer5Y = useTransform(mouseY, v => v * -5);

  const handleMouseMove = useCallback((e) => {
    const { innerWidth, innerHeight } = window;
    mouseX.set((e.clientX / innerWidth - 0.5) * 2);
    mouseY.set((e.clientY / innerHeight - 0.5) * 2);
  }, [mouseX, mouseY]);

  return (
    <div onMouseMove={handleMouseMove} className="w-full h-full flex flex-col items-center justify-center relative bg-[#041327] overflow-hidden">
      
      <div className="absolute inset-0 cartographic-grid opacity-50 pointer-events-none" />

      <motion.div className="absolute inset-0 z-0 pointer-events-none" style={{ x: layer1X, y: layer1Y }}>
        <Particles color="#0B2447" />
        <Particles color="#22D3EE" />
      </motion.div>

      <motion.div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center opacity-80" style={{ x: layer2X, y: layer2Y }}>
        <div className="w-[80vw] h-[80vw] md:w-[900px] md:h-[900px] radar-ring" />
        <div className="w-[50vw] h-[50vw] md:w-[600px] md:h-[600px] radar-ring" />
        <div className="w-[25vw] h-[25vw] md:w-[300px] md:h-[300px] radar-ring border-cyan-400/20" />
      </motion.div>

      <motion.div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center opacity-80" style={{ x: layer3X, y: layer3Y }}>
        <motion.div
          className="absolute rounded-full"
          style={{
            width: '900px', height: '900px',
            background: 'conic-gradient(from 0deg, transparent 70%, rgba(34,211,238,0.05) 90%, rgba(34,211,238,0.25) 100%)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        />
        <svg viewBox="0 0 1000 1000" className="w-[90vw] h-[90vw] md:w-[900px] md:h-[900px] opacity-90">
          <path d="M150,300 L250,150 L400,200 L550,100 L700,250 L850,200 L800,450 L900,600 L750,700 L600,600 L500,800 L350,700 L200,800 L100,600 L250,500 Z M250,150 L250,500 M400,200 L600,600 M700,250 L500,800 M800,450 L350,700 M100,600 L550,100 M250,500 L750,700"
            fill="none" stroke="rgba(34,211,238,0.15)" strokeWidth="1" />
          <path
            d="M150,300 L250,150 L400,200 L550,100 L700,250 L850,200 L800,450 L900,600 L750,700 L600,600 L500,800 L350,700 L200,800 L100,600 L250,500 Z"
            fill="none" stroke="#22D3EE" strokeWidth="1.5" strokeDasharray="10 40 5 20 2 60"
            style={{ animation: "data-flow 30s linear infinite" }}
          />
          {HERO_STATIC_NODES.map(([cx,cy],i) => (
            <g key={i}>
              <circle cx={cx} cy={cy} r="5" fill="none" stroke="rgba(34,211,238,0.4)" strokeWidth="1" />
              <circle cx={cx} cy={cy} r="2.5" fill="#22D3EE" opacity="0.8" />
            </g>
          ))}
        </svg>
      </motion.div>

      <motion.div className="absolute inset-0 z-10 pointer-events-none" style={{ x: layer4X, y: layer4Y }}>
        <FloatingData />
      </motion.div>

      <motion.div className="relative z-20 flex flex-col items-center" style={{ x: layer5X, y: layer5Y }}>
        <motion.div initial={{ opacity: 0, filter: "blur(20px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ duration: 1.5, ease: "easeOut" }} className="mb-8 logo-shimmer">
          <h2 className="text-3xl md:text-4xl font-['Space_Grotesk'] font-bold tracking-[0.5em] text-cyan-400 drop-shadow-[0_0_25px_rgba(34,211,238,0.8)]">PPTMAPS</h2>
        </motion.div>

        <div className="text-center mb-4 px-4">
          <h1 className="text-5xl md:text-8xl font-['Space_Grotesk'] font-bold leading-tight">
            <AnimatedText text="Inteligencia urbana" delay={0.5} />
            <br />
            <AnimatedText text="en tiempo real" className="text-cyan-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.6)]" delay={1.2} />
          </h1>
        </div>

        <MiniStatusPanel />
        
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3, duration: 1 }} className="mt-16">
          <HeroCTA />
        </motion.div>
      </motion.div>
    </div>
  );
});
