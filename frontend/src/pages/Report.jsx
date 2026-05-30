import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const REPORT_TYPES = [
  { id: 'accidente',  label: 'Accidente de tránsito', desc: 'Choque, volcamiento o atropello' },
  { id: 'via_cerrada', label: 'Vía cerrada', desc: 'Cierre total o parcial de la calzada' },
  { id: 'inundacion', label: 'Inundación',  desc: 'Agua acumulada o desbordamiento' },
  { id: 'hueco',      label: 'Hueco o bache', desc: 'Hundimiento o daño en el pavimento' },
  { id: 'semaforo',   label: 'Semáforo dañado', desc: 'Apagado, intermitente o fuera de ciclo' },
  { id: 'otro',       label: 'Otra novedad', desc: 'Cualquier incidente no listado' },
];

export default function Report() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('page-landing');
    return () => document.documentElement.classList.remove('page-landing');
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selected) return;
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div style={{
        backgroundColor: '#0f172a', minHeight: '100vh',
        fontFamily: "'Inter', system-ui, sans-serif",
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '16px',
      }}>
        <div style={{
          textAlign: 'center', maxWidth: '480px', padding: '2rem',
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            backgroundColor: 'rgba(34,211,238,0.1)',
            border: '2px solid #22d3ee',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.5rem',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.75rem' }}>
            Reporte enviado
          </h2>
          <p style={{ color: '#64748b', marginBottom: '2rem' }}>
            Tu reporte fue registrado y será procesado en tiempo real.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button onClick={() => setSubmitted(false)} style={btnOutline}>
              Nuevo reporte
            </button>
            <button onClick={() => navigate('/map')} style={btnPrimary}>
              Ver en el mapa
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: '#0f172a', minHeight: '100vh',
      fontFamily: "'Inter', system-ui, sans-serif",
      color: '#e2e8f0', fontSize: '16px', lineHeight: '1.6',
    }}>

      {/* NAV */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        backgroundColor: 'rgba(15,23,42,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(56,189,248,0.15)',
        padding: '0 3rem', height: '68px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#94a3b8', fontSize: '0.9rem',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Volver al inicio
        </button>
        <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#22d3ee', letterSpacing: '0.05em' }}>
          TPPMAPS
        </span>
        <button onClick={() => navigate('/map')} style={btnPrimary}>
          Abrir Mapa
        </button>
      </header>

      {/* CONTENT */}
      <main style={{ maxWidth: '760px', margin: '0 auto', padding: '4rem 2rem' }}>
        <div style={{ marginBottom: '2.5rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.5rem' }}>
            Reportar un incidente
          </h1>
          <p style={{ color: '#64748b', fontSize: '1rem' }}>
            Selecciona el tipo de incidente y añade una descripción. El reporte se georeferenciará automáticamente.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Tipo de incidente */}
          <fieldset style={{ border: 'none', padding: 0, marginBottom: '2rem' }}>
            <legend style={{
              fontSize: '0.875rem', fontWeight: 600,
              color: '#94a3b8', marginBottom: '1rem',
              letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>
              Tipo de incidente
            </legend>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem',
            }}>
              {REPORT_TYPES.map(t => {
                const isSelected = selected === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelected(t.id)}
                    style={{
                      padding: '1.1rem',
                      textAlign: 'left',
                      backgroundColor: isSelected ? 'rgba(34,211,238,0.08)' : '#1e293b',
                      border: `1px solid ${isSelected ? '#22d3ee' : 'rgba(56,189,248,0.12)'}`,
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <p style={{ fontSize: '0.9rem', fontWeight: 600, color: isSelected ? '#22d3ee' : '#f1f5f9', marginBottom: '0.25rem' }}>
                      {t.label}
                    </p>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                      {t.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Descripción */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{
              display: 'block', fontSize: '0.875rem', fontWeight: 600,
              color: '#94a3b8', marginBottom: '0.5rem',
              letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>
              Descripción (opcional)
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe brevemente lo que observaste..."
              rows={4}
              style={{
                width: '100%', padding: '0.875rem 1rem',
                backgroundColor: '#1e293b',
                border: '1px solid rgba(56,189,248,0.15)',
                borderRadius: '10px', outline: 'none',
                color: '#e2e8f0', fontSize: '0.95rem',
                fontFamily: 'inherit', resize: 'vertical',
                boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderColor = '#22d3ee'}
              onBlur={e => e.target.style.borderColor = 'rgba(56,189,248,0.15)'}
            />
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              type="submit"
              disabled={!selected}
              style={{
                ...btnPrimary,
                opacity: selected ? 1 : 0.4,
                cursor: selected ? 'pointer' : 'not-allowed',
                padding: '0.875rem 2.5rem',
                fontSize: '1rem',
              }}
            >
              Enviar reporte
            </button>
            <button type="button" onClick={() => navigate('/map')} style={{ ...btnOutline, padding: '0.875rem 1.75rem', fontSize: '1rem' }}>
              Ver mapa
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

/* ── Estilos de botón compartidos ── */
const btnPrimary = {
  fontSize: '0.875rem', fontWeight: 600,
  backgroundColor: '#22d3ee', color: '#0f172a',
  border: 'none', borderRadius: '8px',
  padding: '0.5rem 1.25rem', cursor: 'pointer',
};

const btnOutline = {
  fontSize: '0.875rem', fontWeight: 600,
  backgroundColor: 'transparent', color: '#e2e8f0',
  border: '1px solid rgba(148,163,184,0.35)', borderRadius: '8px',
  padding: '0.5rem 1.25rem', cursor: 'pointer',
};
