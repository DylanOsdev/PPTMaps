import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

const randomBetween = (min, max) => Math.random() * (max - min) + min;

function Particle({ color, index }) {
  const p = useMemo(() => ({
    x: randomBetween(0, 100),
    y: randomBetween(0, 100),
    size: randomBetween(1.5, 4),
    duration: randomBetween(5, 12),
    delay: randomBetween(0, 5),
    driftX: randomBetween(-30, 30),
    driftY: randomBetween(-45, -10),
  }), []);

  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        left: `${p.x}%`, top: `${p.y}%`,
        width: p.size, height: p.size,
        backgroundColor: color,
        boxShadow: `0 0 ${p.size * 2}px ${color}40`,
      }}
      animate={{
        x: [0, p.driftX * 0.3, p.driftX * 0.8, p.driftX * 0.3, -p.driftX * 0.2, p.driftX * 0.5, 0],
        y: [0, p.driftY * 0.4, p.driftY * 0.7, p.driftY * 0.9, p.driftY * 0.5, p.driftY * 0.2, 0],
        opacity: [0.3, 0.6, 0.35, 0.7, 0.4, 0.55, 0.3],
      }}
      transition={{
        duration: p.duration,
        repeat: Infinity,
        delay: p.delay,
        ease: 'easeInOut',
      }}
    />
  );
}

export default React.memo(function Particles({ color = "#22D3EE", count = 25 }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: count }, (_, i) => (
        <Particle key={i} color={color} index={i} />
      ))}
    </div>
  );
});
