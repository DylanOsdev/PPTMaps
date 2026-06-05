import React, { useEffect, useRef } from 'react';

import CustomCursor from './landing/components/CustomCursor.jsx';
import Navbar from './landing/components/Navbar.jsx';
import HeroSection from './landing/sections/HeroSection.jsx';
import TelemetrySection from './landing/sections/TelemetrySection.jsx';
import WeatherSection from './landing/sections/WeatherSection.jsx';
import ReportsSection from './landing/sections/ReportsSection.jsx';
import BackendSection from './landing/sections/BackendSection.jsx';
import LayersSection from './landing/sections/LayersSection.jsx';
import FinalCTA from './landing/sections/FinalCTA.jsx';

const SECTIONS = [
  { id: 'hero', Component: HeroSection },
  { id: 'telemetry', Component: TelemetrySection },
  { id: 'weather', Component: WeatherSection },
  { id: 'reports', Component: ReportsSection },
  { id: 'backend', Component: BackendSection },
  { id: 'layers', Component: LayersSection },
  { id: 'final', Component: FinalCTA },
];

export default function Landing() {
  const containerRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.add('page-landing-futuristic');

    let gsap, ScrollTrigger, Lenis, cleanup;

    import('gsap').then(g => {
      gsap = g.default;
      return import('gsap/ScrollTrigger');
    }).then(st => {
      ScrollTrigger = st.ScrollTrigger;
      gsap.registerPlugin(ScrollTrigger);
      return import('lenis');
    }).then(l => {
      Lenis = l.default;

      const lenis = new Lenis({
        duration: 1.0,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smooth: true,
        smoothTouch: false,
        normalizeWheel: true,
        wheelMultiplier: 0.8,
        lerp: 0.06,
      });

      lenis.on('scroll', ScrollTrigger.update);

      const lenisRaf = (time) => lenis.raf(time * 1000);
      gsap.ticker.add(lenisRaf);

      const ctx = gsap.context(() => {
        if (!containerRef.current) return;
        const panels = Array.from(containerRef.current.querySelectorAll('.gsap-panel'));

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top top",
            end: `+=${panels.length * 100}%`,
            pin: true,
            pinSpacing: true,
            anticipatePin: 1,
            scrub: 0.5,
          }
        });

        panels.forEach((panel, i) => {
          gsap.set(panel, { zIndex: 100 - i, willChange: 'transform, opacity' });
          if (i === 0) return;
          gsap.set(panel, { opacity: 0, scale: 0.95 });
          tl.to(panels[i - 1], { opacity: 0, scale: 1.05, ease: "power1.inOut" }, i);
          tl.to(panel, { opacity: 1, scale: 1, ease: "power1.inOut" }, i);
        });
      }, containerRef);

      cleanup = () => {
        gsap.ticker.remove(lenisRaf);
        lenis.destroy();
        ctx.revert();
        ScrollTrigger.getAll().forEach(t => t.kill());
      };
    });

    return () => {
      document.documentElement.classList.remove('page-landing-futuristic');
      if (cleanup) cleanup();
    };
  }, []);

  return (
    <div className="bg-[#041327] text-white font-sans selection:bg-cyan-400 selection:text-black">
      <CustomCursor />
      <Navbar />

      <div ref={containerRef} className="relative w-full h-screen overflow-hidden">
        {SECTIONS.map(({ id, Component }) => (
          <div
            key={id}
            id={`section-${id}`}
            className="gsap-panel absolute inset-0 w-full h-screen bg-[#041327]"
          >
            <Component />
          </div>
        ))}
      </div>
    </div>
  );
}
