import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaMapMarkedAlt, FaCloudSunRain, FaCarCrash, FaMobileAlt, FaRoute, FaDatabase } from 'react-icons/fa';
import gsap from 'gsap';

const stats = [
  { val: '16', label: 'COMUNAS' },
  { val: '847', label: 'GPS ACTIVOS' },
  { val: '0K', label: 'DEPRIMIDOS' },
  { val: '7', label: 'ALERTAS HOY' },
];

const features = [
  {
    icon: <FaMapMarkedAlt style={{ color: '#67e8f9', fontSize: '32px', marginBottom: '16px' }} />,
    name: 'CAPAS DE DATOS',
    desc: 'Contorno ciudad, polígonos comunas, telemetría GPS y clusters de accidentes configurables en tiempo real.',
  },
  {
    icon: <FaCloudSunRain style={{ color: '#67e8f9', fontSize: '32px', marginBottom: '16px' }} />,
    name: 'SIATA Y CLIMA',
    desc: 'Integración directa con el Sistema de Alertas Tempranas. Deprimidos inundables y riesgo de lluvia a 2 horas.',
  },
  {
    icon: <FaCarCrash style={{ color: '#67e8f9', fontSize: '32px', marginBottom: '16px' }} />,
    name: 'TELEMETRÍA VIAL',
    desc: 'Rastreo GPS en tiempo real, mapas predictivos de congestión y clusters de accidentes via DBSCAN.',
  },
  {
    icon: <FaMobileAlt style={{ color: '#67e8f9', fontSize: '32px', marginBottom: '16px' }} />,
    name: 'REPORTES CIUDADANOS',
    desc: 'Canal georeferenciado de reportes. Obstáculos, obras sin señalización e incidentes procesados en segundos.',
  },
  {
    icon: <FaRoute style={{ color: '#67e8f9', fontSize: '32px', marginBottom: '16px' }} />,
    name: 'RUTAS SEGURAS',
    desc: 'Cálculo de rutas evitando zonas de riesgo activo, lluvia inminente y vías bloqueadas.',
  },
  {
    icon: <FaDatabase style={{ color: '#67e8f9', fontSize: '32px', marginBottom: '16px' }} />,
    name: 'API PÚBLICA',
    desc: 'REST endpoints para todos los datos geoespaciales. PostGIS, Redis y soporte GeoJSON de alta velocidad.',
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const containerRef = useRef(null);

  useEffect(() => {
    document.documentElement.style.overflow = 'auto';
    document.documentElement.style.height = 'auto';
    document.body.style.overflow = 'auto'; 
    document.body.style.height = 'auto'; 
    return () => { 
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
      document.body.style.overflow = ''; 
      document.body.style.height = ''; 
    };
  }, []);

  useEffect(() => {
    let ctx = gsap.context(() => {
      // 1. Animación de fondos flotantes (movimiento sutil y continuo)
      gsap.to(".bg-blob-1", {
        x: 120, y: 80, scale: 1.1, rotation: 5, duration: 15, repeat: -1, yoyo: true, ease: "sine.inOut"
      });
      gsap.to(".bg-blob-2", {
        x: -100, y: -60, scale: 1.15, rotation: -5, duration: 18, repeat: -1, yoyo: true, ease: "sine.inOut"
      });

      // 2. Línea de tiempo de entrada para el Hero Section
      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
      
      tl.from(".navbar", { y: -100, opacity: 0, duration: 1, delay: 0.1 })
        .from(".hero-badge", { y: 20, opacity: 0, duration: 0.8 }, "-=0.6")
        .from(".hero-title-line", { y: 40, opacity: 0, duration: 1, stagger: 0.15 }, "-=0.6")
        .from(".hero-desc", { y: 20, opacity: 0, duration: 0.8 }, "-=0.6")
        .from(".hero-btns", { y: 20, opacity: 0, duration: 0.8 }, "-=0.6");

      // 3. Animación manual con IntersectionObserver para Estadísticas y Funcionalidades
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            if (entry.target.id === 'stats-trigger') {
              gsap.fromTo(".stat-card", 
                { y: 40, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.8, stagger: 0.15, ease: "back.out(1.5)" }
              );
            }
            if (entry.target.id === 'features-trigger') {
              gsap.fromTo(".feature-card",
                { y: 50, opacity: 0, rotationX: -10 },
                { y: 0, opacity: 1, rotationX: 0, duration: 0.8, stagger: 0.1, ease: "power3.out", transformOrigin: "center bottom" }
              );
            }
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.2 });

      const statsEl = document.getElementById('stats-trigger');
      const featEl = document.getElementById('features-trigger');
      if (statsEl) observer.observe(statsEl);
      if (featEl) observer.observe(featEl);
      
    }, containerRef);

    return () => ctx.revert(); // Limpieza para React 18 Strict Mode
  }, []);

  return (
    <div ref={containerRef} style={{ background: '#050608', color: '#e2e8f0', minHeight: '100vh', fontFamily: '"JetBrains Mono", monospace' }}>
      
      {/* ════════════ NAVBAR ════════════ */}
      <nav className="navbar" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        padding: '16px 32px', borderBottom: '1px solid rgba(56, 189, 248, 0.35)',
        background: 'linear-gradient(180deg, rgba(5, 8, 12, 0.97) 0%, rgba(5, 8, 12, 0.85) 100%)',
        position: 'fixed', width: '100%', top: 0, zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            fontFamily: '"Orbitron", sans-serif', fontSize: '24px', fontWeight: 700,
            letterSpacing: '0.12em', color: '#67e8f9', textShadow: '0 0 12px rgba(56, 189, 248, 0.25)'
          }}>
            TPPMAPS
          </span>
          <span style={{ fontSize: '10px', letterSpacing: '0.08em', color: '#94a3b8', marginTop: '4px' }}>
            // COMANDO GEOESPACIAL
          </span>
        </div>

        <div style={{ display: 'flex', gap: '32px', fontSize: '12px', fontWeight: 600, letterSpacing: '0.1em' }}>
          <a href="#features" style={{ color: '#94a3b8', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={e=>e.target.style.color='#67e8f9'} onMouseOut={e=>e.target.style.color='#94a3b8'}>PLATAFORMA</a>
          <a href="#stats" style={{ color: '#94a3b8', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={e=>e.target.style.color='#67e8f9'} onMouseOut={e=>e.target.style.color='#94a3b8'}>IMPACTO</a>
          <a href="#" style={{ color: '#94a3b8', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={e=>e.target.style.color='#67e8f9'} onMouseOut={e=>e.target.style.color='#94a3b8'}>API</a>
        </div>

        <div>
          <button
            onClick={() => navigate('/map')}
            style={{
              padding: '10px 24px', fontFamily: '"JetBrains Mono", monospace', fontSize: '12px',
              fontWeight: 600, letterSpacing: '0.06em', color: '#fbbf24', background: 'transparent',
              border: '1px solid #fbbf24', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s'
            }}
            onMouseOver={e => { e.target.style.background = 'rgba(251, 191, 36, 0.12)'; e.target.style.boxShadow = '0 0 14px rgba(251, 191, 36, 0.2)'; }}
            onMouseOut={e => { e.target.style.background = 'transparent'; e.target.style.boxShadow = 'none'; }}
          >
            ACCEDER AL COMANDO →
          </button>
        </div>
      </nav>

      {/* ════════════ HERO SECTION ════════════ */}
      <main style={{ paddingTop: '80px' }}>
        <section style={{
          position: 'relative', width: '100%', minHeight: '80vh',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
        }}>
          {/* Background decoration with GSAP classes */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <div className="bg-blob-1" style={{
              position: 'absolute', top: '30%', left: '30%', transform: 'translate(-50%, -50%)',
              width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(56,189,248,0.08) 0%, transparent 60%)'
            }} />
            <div className="bg-blob-2" style={{
              position: 'absolute', bottom: '10%', right: '10%', transform: 'translate(50%, 50%)',
              width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(74,222,128,0.05) 0%, transparent 60%)'
            }} />
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'linear-gradient(rgba(56, 189, 248, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.04) 1px, transparent 1px)',
              backgroundSize: '32px 32px'
            }} />
          </div>

          <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', maxWidth: '900px', padding: '0 24px' }}>
            <div className="hero-badge" style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px',
              border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '4px',
              background: 'rgba(8, 12, 18, 0.88)', color: '#67e8f9', fontSize: '10px',
              letterSpacing: '0.1em', marginBottom: '32px', boxShadow: '0 0 12px rgba(56, 189, 248, 0.25)'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80' }} />
              SISTEMA ACTIVO EN MEDELLÍN
            </div>
            
            <h1 style={{
              fontFamily: '"Orbitron", sans-serif', fontSize: '64px', fontWeight: 700,
              letterSpacing: '0.05em', color: '#e2e8f0', marginBottom: '24px', lineHeight: 1.1,
              textShadow: '0 0 20px rgba(255,255,255,0.1)'
            }}>
              <div className="hero-title-line">COMANDO GEOESPACIAL</div>
              <div className="hero-title-line" style={{ color: '#67e8f9', textShadow: '0 0 12px rgba(56, 189, 248, 0.4)' }}>
                EN TIEMPO REAL
              </div>
            </h1>
            
            <p className="hero-desc" style={{
              fontSize: '16px', color: '#94a3b8', lineHeight: 1.6, maxWidth: '700px', margin: '0 auto 48px',
              letterSpacing: '0.02em'
            }}>
              Plataforma de inteligencia urbana para el Valle del Aburrá. Monitoreo de tráfico, alertas SIATA, telemetría vial y reportes ciudadanos sincronizados al instante en las 16 comunas.
            </p>
            
            <div className="hero-btns" style={{ display: 'flex', gap: '24px', justifyContent: 'center' }}>
              <button
                onClick={() => navigate('/map')}
                style={{
                  padding: '16px 32px', fontFamily: '"Orbitron", sans-serif', fontSize: '14px',
                  fontWeight: 600, letterSpacing: '0.1em', color: '#050608', background: '#67e8f9',
                  border: 'none', borderRadius: '4px', cursor: 'pointer',
                  boxShadow: '0 0 20px rgba(56, 189, 248, 0.4)', transition: 'all 0.2s'
                }}
                onMouseOver={e => e.target.style.filter = 'brightness(1.2)'}
                onMouseOut={e => e.target.style.filter = 'none'}
              >
                INICIAR COMANDO
              </button>
              <button
                onClick={() => navigate('/navigate')}
                style={{
                  padding: '16px 32px', fontFamily: '"Orbitron", sans-serif', fontSize: '14px',
                  fontWeight: 600, letterSpacing: '0.1em', color: '#94a3b8', background: 'rgba(8, 12, 18, 0.88)',
                  border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s'
                }}
                onMouseOver={e => { e.target.style.color = '#e2e8f0'; e.target.style.borderColor = '#e2e8f0'; }}
                onMouseOut={e => { e.target.style.color = '#94a3b8'; e.target.style.borderColor = 'rgba(148, 163, 184, 0.3)'; }}
              >
                VISTA MÓVIL
              </button>
            </div>
          </div>
        </section>

        {/* ════════════ STATS SECTION ════════════ */}
        <section id="stats-trigger" style={{
          padding: '64px 24px', background: 'rgba(5, 8, 14, 0.95)', borderTop: '1px solid rgba(56, 189, 248, 0.15)',
          borderBottom: '1px solid rgba(56, 189, 248, 0.15)', position: 'relative', zIndex: 10
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
            {stats.map((s, idx) => (
              <div key={idx} className="stat-card" style={{
                textAlign: 'center', padding: '32px 16px', background: 'rgba(8, 12, 18, 0.88)',
                border: '1px solid rgba(56, 189, 248, 0.15)', borderRadius: '6px',
                boxShadow: '0 0 12px rgba(56, 189, 248, 0.05)'
              }}>
                <div style={{
                  fontFamily: '"Orbitron", sans-serif', fontSize: '48px', fontWeight: 700,
                  color: '#fbbf24', textShadow: '0 0 12px rgba(251, 191, 36, 0.4)', marginBottom: '12px'
                }}>
                  {s.val}
                </div>
                <div style={{ fontSize: '12px', letterSpacing: '0.2em', color: '#94a3b8', fontWeight: 600 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ════════════ FEATURES SECTION ════════════ */}
        <section id="features-trigger" style={{ padding: '96px 24px', maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <h2 style={{
              fontFamily: '"Orbitron", sans-serif', fontSize: '32px', fontWeight: 700,
              color: '#67e8f9', letterSpacing: '0.1em', marginBottom: '16px'
            }}>
              CAPACIDADES DEL SISTEMA
            </h2>
            <p style={{ fontSize: '14px', color: '#94a3b8', maxWidth: '600px', margin: '0 auto' }}>
              Nuestra arquitectura modular permite integrar múltiples fuentes de datos de la ciudad en una única vista operativa.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            {features.map((f, idx) => (
              <div key={idx} className="feature-card" style={{
                padding: '32px', background: 'rgba(8, 12, 18, 0.88)', border: '1px solid rgba(56, 189, 248, 0.2)',
                borderRadius: '6px', transition: 'all 0.2s', perspective: '1000px'
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = '#67e8f9'; e.currentTarget.style.boxShadow = '0 0 20px rgba(56,189,248,0.15)'; e.currentTarget.style.transform = 'translateY(-5px)'; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.2)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                {f.icon}
                <h3 style={{
                  fontFamily: '"Orbitron", sans-serif', fontSize: '16px', fontWeight: 700,
                  color: '#e2e8f0', letterSpacing: '0.05em', marginBottom: '12px'
                }}>{f.name}</h3>
                <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* ════════════ FOOTER ════════════ */}
      <footer style={{
        padding: '32px 24px', background: 'rgba(5, 8, 12, 0.95)', borderTop: '1px solid rgba(56, 189, 248, 0.35)',
        textAlign: 'center', color: '#94a3b8', fontSize: '12px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <FaMapMarkedAlt style={{ fontSize: '16px', color: '#67e8f9' }} />
          <span style={{ fontFamily: '"Orbitron", sans-serif', fontWeight: 700, letterSpacing: '0.1em', color: '#67e8f9' }}>
            TPPMAPS
          </span>
        </div>
        <p style={{ marginBottom: '8px' }}>© 2026 Inteligencia Urbana Medellín. Todos los derechos reservados.</p>
        <div style={{ fontSize: '10px', opacity: 0.5 }}>PostGIS + Redis + React</div>
      </footer>
    </div>
  );
}
