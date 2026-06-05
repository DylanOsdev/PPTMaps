import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';

const IS_TOUCH = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

export default function CustomCursor() {
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  const [isHovered, setIsHovered] = useState(false);

  const cursorXOuter = useTransform(cursorX, v => v - (isHovered ? 24 : 16));
  const cursorYOuter = useTransform(cursorY, v => v - (isHovered ? 24 : 16));
  const cursorXInner = useTransform(cursorX, v => v - 4);
  const cursorYInner = useTransform(cursorY, v => v - 4);

  useEffect(() => {
    if (IS_TOUCH) return;
    let rafId = null;
    let latestX = -100, latestY = -100;

    const update = (e) => {
      latestX = e.clientX;
      latestY = e.clientY;
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          cursorX.set(latestX);
          cursorY.set(latestY);
          rafId = null;
        });
      }
    };

    const checkHover = (e) => {
      const t = e.target;
      if (!t) return;
      setIsHovered(
        t.tagName?.toLowerCase() === 'button' ||
        !!t.closest?.('button') ||
        t.tagName?.toLowerCase() === 'a'
      );
    };

    window.addEventListener('mousemove', update, { passive: true });
    window.addEventListener('mouseover', checkHover, { passive: true });
    return () => {
      window.removeEventListener('mousemove', update);
      window.removeEventListener('mouseover', checkHover);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [cursorX, cursorY]);

  if (IS_TOUCH) return null;

  return (
    <>
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-[9999] rounded-full mix-blend-screen"
        style={{
          x: cursorXOuter,
          y: cursorYOuter,
          width: isHovered ? 48 : 32,
          height: isHovered ? 48 : 32,
          border: isHovered ? '2px solid #22D3EE' : '1px solid #22D3EE',
          backgroundColor: isHovered ? 'rgba(34,211,238,0.15)' : 'transparent',
          boxShadow: isHovered ? '0 0 25px rgba(34,211,238,0.5)' : '0 0 10px #22D3EE',
        }}
        transition={{ type: 'spring', stiffness: 150, damping: 15, mass: 0.5 }}
      />
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-[9999] rounded-full bg-cyan-400 shadow-[0_0_8px_#22D3EE]"
        style={{
          x: cursorXInner,
          y: cursorYInner,
          width: 8, height: 8,
          scale: isHovered ? 0 : 1,
        }}
      />
    </>
  );
}
