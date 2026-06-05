import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

const STARS = Array.from({ length: 250 }, (_, i) => ({
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: 0.5 + Math.random() * 2.5,
  delay: Math.random() * 5,
  duration: 2 + Math.random() * 4,
  opacity: 0.2 + Math.random() * 0.8,
}));

const SHOOTING_STARS = Array.from({ length: 3 }, (_, i) => ({
  top: 5 + Math.random() * 40,
  left: 50 + Math.random() * 40,
  delay: 3 + i * 5 + Math.random() * 4,
  duration: 1.5 + Math.random(),
}));

const TITLE = "PPTMAPS".split("");

const LETTER_VARIANTS = {
  initial: { y: 60, opacity: 0, scale: 0.5, filter: 'blur(8px)' },
  animate: (i) => ({
    y: 0,
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      delay: i * 0.12,
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
    },
  }),
};

export default React.memo(function FinalCTA() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative bg-black overflow-hidden">

      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 20% 30%, rgba(34,211,238,0.12) 0%, transparent 70%),
              radial-gradient(ellipse 60% 50% at 80% 70%, rgba(6,182,212,0.1) 0%, transparent 60%),
              radial-gradient(ellipse 50% 40% at 50% 50%, rgba(34,211,238,0.04) 0%, transparent 50%)
            `,
          }}
        />

        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,0.6), transparent),
              radial-gradient(1px 1px at 30% 50%, rgba(255,255,255,0.4), transparent),
              radial-gradient(1px 1px at 50% 10%, rgba(255,255,255,0.7), transparent),
              radial-gradient(1px 1px at 70% 80%, rgba(255,255,255,0.3), transparent),
              radial-gradient(1px 1px at 90% 40%, rgba(255,255,255,0.5), transparent)
            `,
            backgroundSize: '200px 200px',
            backgroundRepeat: 'repeat',
          }}
        />

        {STARS.map((star, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: star.size,
              height: star.size,
            }}
            animate={{
              opacity: [star.opacity * 0.3, star.opacity, star.opacity * 0.3],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: star.duration,
              repeat: Infinity,
              delay: star.delay,
              ease: 'easeInOut',
            }}
          />
        ))}

        {SHOOTING_STARS.map((s, i) => (
          <motion.div
            key={`shoot-${i}`}
            className="absolute h-[1px]"
            style={{
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: 80,
              background: 'linear-gradient(90deg, rgba(255,255,255,0.8), rgba(255,255,255,0))',
              rotate: '-25deg',
            }}
            initial={{ x: 0, opacity: 0 }}
            animate={{
              x: [0, -500],
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              duration: s.duration,
              repeat: Infinity,
              delay: s.delay,
              ease: 'linear',
              times: [0, 0.1, 0.3, 1],
            }}
          />
        ))}
      </div>

      <div className="z-10 text-center flex flex-col items-center pointer-events-none">
        <div className="flex items-center justify-center gap-1 md:gap-3">
          {TITLE.map((letter, i) => (
            <motion.span
              key={i}
              className="text-6xl sm:text-7xl md:text-[10rem] font-['Space_Grotesk'] font-bold tracking-[0.15em] inline-block"
              style={{
                color: '#fff',
                textShadow: '0 0 30px rgba(34,211,238,0.5), 0 0 60px rgba(34,211,238,0.25), 0 0 100px rgba(6,182,212,0.15)',
              }}
              variants={LETTER_VARIANTS}
              initial="initial"
              animate="animate"
              custom={i}
            >
              {letter}
            </motion.span>
          ))}
        </div>

        <div className="mt-4 md:mt-6 space-y-1">
          <p className="text-sm md:text-lg text-white/60 font-light tracking-[0.5em] uppercase"
             style={{ textShadow: '0 0 20px rgba(34,211,238,0.25)' }}>
            Explorando el valle de aburrá
          </p>
          <p className="text-[10px] md:text-xs text-white/30 font-mono tracking-[0.3em] uppercase">
            desde el espacio · sistema activo
          </p>
        </div>

        <motion.div
          className="mt-12 md:mt-16 w-40 h-[1px]"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.5), rgba(6,182,212,0.5), transparent)',
          }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 1, duration: 1.5, ease: 'easeOut' }}
        />

        <motion.p
          className="mt-6 font-mono text-[9px] text-white/20 tracking-[0.3em] uppercase"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 4, repeat: Infinity, delay: 1.5 }}
        >
          6.2442° N — 75.5812° W — 2026
        </motion.p>
      </div>
    </div>
  );
});
