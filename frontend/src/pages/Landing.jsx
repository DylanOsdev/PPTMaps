import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const STATS = [
  { value: '16',   label: 'Comunas monitoreadas' },
  { value: '847',  label: 'Conductores GPS activos' },
  { value: '9',    label: 'Capas de datos activas' },
  { value: '<30s', label: 'Latencia de actualización' },
];

const FEATURES = [
  {
    icon: '⬡',
    title: 'Capas Geoespaciales',
    desc: 'Contorno de ciudad, polígonos de comunas y corregimientos del Valle de Aburrá con control granular de visibilidad.',
  },
  {
    icon: '⬡',
    title: 'Telemetría Vial',
    desc: 'Rastreo GPS de conductores en tiempo real y clusters de accidentes calculados con DBSCAN.',
  },
  {
    icon: '⬡',
    title: 'SIATA & Clima',
    desc: 'Alertas tempranas de inundación, riesgo de lluvia a 2 horas y estado de deprimidos viales críticos.',
  },
  {
    icon: '⬡',
    title: 'Reportes Ciudadanos',
    desc: 'Canal georeferenciado para reportar colisiones, obstáculos y obras sin señalización en segundos.',
  },
  {
    icon: '⬡',
    title: 'Rutas Seguras',
    desc: 'Rutas que evitan zonas de riesgo activo, lluvia inminente y vías bloqueadas, actualizadas cada 30 s.',
  },
  {
    icon: '⬡',
    title: 'API en Tiempo Real',
    desc: 'Endpoints REST sobre PostGIS y Redis con soporte GeoJSON, alta disponibilidad y baja latencia.',
  },
];

export default function Landing() {
  const navigate = useNavigate();

  // Habilita scroll en la landing y lo restaura al salir
  useEffect(() => {
    document.documentElement.classList.add('page-landing');
    return () => document.documentElement.classList.remove('page-landing');
  }, []);

  return (
    <div style={{
      backgroundColor: '#0f172a',
      minHeight: '100vh',
      color: '#e2e8f0',
      fontFamily: "'Inter', system-ui, sans-serif",
      fontSize: '16px',
      lineHeight: '1.6',
    }}>

      {/* ── NAV ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        backgroundColor: 'rgba(15,23,42,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(56,189,248,0.15)',
        padding: '0 3rem',
        height: '68px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#22d3ee', letterSpacing: '0.05em' }}>
          TPPMAPS
        </span>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <a href="#funciones" style={{ fontSize: '0.9rem', color: '#94a3b8', textDecoration: 'none' }}
             onMouseEnter={e => e.target.style.color = '#e2e8f0'}
             onMouseLeave={e => e.target.style.color = '#94a3b8'}>Funciones</a>
          <a href="#stats" style={{ fontSize: '0.9rem', color: '#94a3b8', textDecoration: 'none' }}
             onMouseEnter={e => e.target.style.color = '#e2e8f0'}
             onMouseLeave={e => e.target.style.color = '#94a3b8'}>Estadísticas</a>
          <a href="#" style={{ fontSize: '0.9rem', color: '#94a3b8', textDecoration: 'none' }}
             onMouseEnter={e => e.target.style.color = '#e2e8f0'}
             onMouseLeave={e => e.target.style.color = '#94a3b8'}>Documentación</a>
          <button
            onClick={() => navigate('/map')}
            style={{
              fontSize: '0.875rem', fontWeight: 600,
              backgroundColor: '#22d3ee', color: '#0f172a',
              border: 'none', borderRadius: '8px',
              padding: '0.5rem 1.25rem', cursor: 'pointer',
            }}
          >
            Abrir Mapa
          </button>
        </nav>
      </header>

      {/* ── HERO ── */}
      <section style={{
        maxWidth: '860px',
        margin: '0 auto',
        padding: '6rem 2rem 5rem',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.35rem 1rem', marginBottom: '2rem',
          borderRadius: '999px',
          border: '1px solid rgba(34,211,238,0.3)',
          backgroundColor: 'rgba(34,211,238,0.07)',
          fontSize: '0.8rem', color: '#67e8f9',
        }}>
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%',
            backgroundColor: '#22d3ee',
            display: 'inline-block',
          }} />
          Sistema activo · Medellín, Antioquia
        </div>

        <h1 style={{
          fontSize: 'clamp(2.5rem, 5.5vw, 4rem)',
          fontWeight: 800,
          lineHeight: 1.1,
          color: '#ffffff',
          marginBottom: '1.25rem',
          letterSpacing: '-0.025em',
        }}>
          Inteligencia urbana{' '}
          <span style={{ color: '#22d3ee' }}>en tiempo real</span>
        </h1>

        <p style={{
          fontSize: '1.1rem',
          color: '#94a3b8',
          lineHeight: 1.75,
          maxWidth: '560px',
          margin: '0 auto 2.5rem',
        }}>
          Plataforma de comando geoespacial para monitorear el tráfico, clima y
          alertas de las 16 comunas del Valle de Aburrá, sincronizado con SIATA y GPS en vivo.
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/map')}
            style={{
              fontSize: '1rem', fontWeight: 700,
              backgroundColor: '#22d3ee', color: '#0f172a',
              border: 'none', borderRadius: '10px',
              padding: '0.85rem 2.25rem', cursor: 'pointer',
              boxShadow: '0 0 28px rgba(34,211,238,0.25)',
            }}
          >
            Abrir Consola de Comando
          </button>
          <button
            onClick={() => navigate('/report')}
            style={{
              fontSize: '1rem', fontWeight: 600,
              backgroundColor: 'transparent', color: '#e2e8f0',
              border: '1px solid rgba(148,163,184,0.35)',
              borderRadius: '10px',
              padding: '0.85rem 2.25rem', cursor: 'pointer',
            }}
          >
            Reportar Incidente
          </button>
        </div>
      </section>

      {/* ── STATS ── */}
      <section id="stats" style={{
        borderTop: '1px solid rgba(56,189,248,0.12)',
        borderBottom: '1px solid rgba(56,189,248,0.12)',
        backgroundColor: 'rgba(255,255,255,0.02)',
      }}>
        <div style={{
          maxWidth: '1000px', margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        }}>
          {STATS.map((s, i) => (
            <div key={s.label} style={{
              textAlign: 'center',
              padding: '3rem 1.5rem',
              borderRight: i < 3 ? '1px solid rgba(56,189,248,0.12)' : 'none',
            }}>
              <p style={{ fontSize: '2.75rem', fontWeight: 800, color: '#22d3ee', margin: 0, lineHeight: 1 }}>
                {s.value}
              </p>
              <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.5rem', margin: '0.5rem 0 0' }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="funciones" style={{ maxWidth: '1100px', margin: '0 auto', padding: '6rem 2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.75rem' }}>
            Todo lo que necesitas
          </h2>
          <p style={{ fontSize: '1rem', color: '#64748b', maxWidth: '480px', margin: '0 auto' }}>
            Un ecosistema completo de datos urbanos para tomar decisiones informadas en tiempo real.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1.25rem',
        }}>
          {FEATURES.map((f) => (
            <div
              key={f.title}
              style={{
                backgroundColor: '#1e293b',
                border: '1px solid rgba(56,189,248,0.1)',
                borderRadius: '12px',
                padding: '1.75rem',
                cursor: 'default',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(34,211,238,0.35)';
                e.currentTarget.style.boxShadow = '0 4px 24px rgba(34,211,238,0.07)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(56,189,248,0.1)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{
                width: '40px', height: '40px',
                backgroundColor: 'rgba(34,211,238,0.1)',
                borderRadius: '8px',
                marginBottom: '1rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
                </svg>
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '0.5rem' }}>
                {f.title}
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.65, margin: 0 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{
        borderTop: '1px solid rgba(56,189,248,0.12)',
        backgroundColor: 'rgba(34,211,238,0.02)',
        padding: '6rem 2rem',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.75rem' }}>
            Explora el mapa ahora
          </h2>
          <p style={{ fontSize: '1rem', color: '#64748b', marginBottom: '2rem' }}>
            Accede a todas las capas, alertas y telemetría del Valle de Aburrá.
          </p>
          <button
            onClick={() => navigate('/map')}
            style={{
              fontSize: '1rem', fontWeight: 700,
              backgroundColor: '#22d3ee', color: '#0f172a',
              border: 'none', borderRadius: '10px',
              padding: '0.9rem 2.75rem', cursor: 'pointer',
              boxShadow: '0 0 24px rgba(34,211,238,0.28)',
            }}
          >
            Abrir TPPMAPS
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: '1px solid rgba(56,189,248,0.1)',
        backgroundColor: '#0a1120',
        padding: '1.5rem 3rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}>
        <span style={{ fontWeight: 700, color: '#22d3ee', fontSize: '1rem' }}>TPPMAPS</span>
        <p style={{ fontSize: '0.8rem', color: '#475569', margin: 0 }}>
          Sistema demo · Medellín, Antioquia · Colombia
        </p>
        <p style={{ fontSize: '0.8rem', color: '#334155', margin: 0 }}>
          PostGIS + Redis conectado · API v2.1
        </p>
      </footer>

    </div>
  );
}
