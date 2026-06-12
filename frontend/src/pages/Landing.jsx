import React, { useLayoutEffect, useState, lazy, Suspense, memo } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import CustomCursor from './landing/components/CustomCursor.jsx';
import Navbar from './landing/components/Navbar.jsx';

const HeroSection = lazy(() => import('./landing/sections/HeroSection.jsx'));
const WeatherSection = lazy(() => import('./landing/sections/WeatherSection.jsx'));
const ReportsSection = lazy(() => import('./landing/sections/ReportsSection.jsx'));
const BackendSection = lazy(() => import('./landing/sections/BackendSection.jsx'));
const LayersSection = lazy(() => import('./landing/sections/LayersSection.jsx'));
const FinalCTA = lazy(() => import('./landing/sections/FinalCTA.jsx'));

const SECTIONS = [
  { id: 'hero', Component: HeroSection },
  { id: 'weather', Component: WeatherSection },
  { id: 'reports', Component: ReportsSection },
  { id: 'backend', Component: BackendSection },
  { id: 'layers', Component: LayersSection },
  { id: 'final', Component: FinalCTA },
];

gsap.registerPlugin(ScrollTrigger);

function SectionFallback() {
  return <div className="w-full h-full bg-[#041327]" />;
}

function useScrollSetup(reduceMotion) {
  useLayoutEffect(() => {
    if (reduceMotion) return;

    window.scrollTo(0, 0);
    document.documentElement.classList.add('page-landing-futuristic');

    const lenis = new Lenis({
      duration: 1.0,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      wheelMultiplier: 0.8,
      lerp: 0.06,
    });

    lenis.on('scroll', ScrollTrigger.update);

    const lenisRaf = (time) => lenis.raf(time * 1000);
    gsap.ticker.add(lenisRaf);

    const container = document.querySelector('.gsap-container');
    if (!container) return;

    const panels = Array.from(container.querySelectorAll('.gsap-panel'));

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: container,
        start: 'top top',
        end: `+=${panels.length * 100}%`,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        scrub: 0.5,
      },
    });

    panels.forEach((panel, i) => {
      gsap.set(panel, { zIndex: 100 - i });
      if (i === 0) return;
      gsap.set(panel, { opacity: 0, scale: 0.95 });
      tl.to(panels[i - 1], {
        opacity: 0, scale: 1.05, ease: 'power1.inOut',
        onStart: () => gsap.set(panels[i - 1], { willChange: 'transform, opacity' }),
        onComplete: () => gsap.set(panels[i - 1], { willChange: 'auto' }),
      }, i);
      tl.to(panel, {
        opacity: 1, scale: 1, ease: 'power1.inOut',
        onStart: () => gsap.set(panel, { willChange: 'transform, opacity' }),
        onComplete: () => gsap.set(panel, { willChange: 'auto' }),
      }, i);
    });

    tl.progress(0);
    ScrollTrigger.refresh(true);
    window.scrollTo(0, 0);

    const raf = requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      tl.progress(0);
    });

    return () => {
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove('page-landing-futuristic');
      ScrollTrigger.getAll().forEach(t => t.kill());
      lenis.destroy();
      gsap.ticker.remove(lenisRaf);
      panels.forEach(panel => gsap.set(panel, { willChange: 'auto' }));
    };
  }, [reduceMotion]);
}

const MemoizedNavbar = memo(Navbar);

export default function Landing() {
  const [reduceMotion] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  useScrollSetup(reduceMotion);

  return (
    <div className="bg-[#041327] text-white font-sans selection:bg-cyan-400 selection:text-black">
      <CustomCursor />
      <MemoizedNavbar />
      {reduceMotion ? (
        <div className="w-full">
          {SECTIONS.map(({ id, Component }) => (
            <div
              key={id}
              id={`section-${id}`}
              className="w-full h-screen"
            >
              <Suspense fallback={<SectionFallback />}>
                <Component />
              </Suspense>
            </div>
          ))}
        </div>
      ) : (
        <div className="gsap-container relative w-full h-screen overflow-hidden">
          {SECTIONS.map(({ id, Component }) => (
            <div
              key={id}
              id={`section-${id}`}
              className="gsap-panel absolute inset-0 w-full h-screen bg-[#041327]"
            >
              <Suspense fallback={<SectionFallback />}>
                <Component />
              </Suspense>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
