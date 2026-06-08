import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const REPORT_TYPES = [
  { id: 'accidente',  label: 'Accidente de tránsito', desc: 'Choque, volcamiento o atropello' },
  { id: 'muerte',     label: 'Accidente fatal', desc: 'Incidente con víctimas mortales' },
  { id: 'inundacion', label: 'Inundación',  desc: 'Agua acumulada o desbordamiento' },
];

// Mapeo de IDs del formulario → ReportType del backend.
const TYPE_MAP = {
  accidente:  'accident',
  muerte:     'accident',  // Backend procesará por gravedad
  inundacion: 'flood',
};

const DEFAULT_LAT = 6.2442;
const DEFAULT_LNG = -75.5812;

export default function Report() {
  const navigate = useNavigate();
  const isMounted = useRef(true);
  const [selected, setSelected] = useState(null);
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [coords, setCoords] = useState(null);
  const [geoStatus, setGeoStatus] = useState('detecting'); // 'detecting' | 'granted' | 'denied'

  useEffect(() => {
    document.documentElement.classList.add('page-landing');
    return () => {
      document.documentElement.classList.remove('page-landing');
    };
  }, []);

  // Seguimiento en TIEMPO REAL de la ubicación (watchPosition).
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoStatus('denied');
      setError('Tu navegador no soporta geolocalización. No puedes crear reportes.');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!isMounted.current) return;
        
        const accuracy = pos.coords.accuracy;
        const isGPSDevice = accuracy < 100; // GPS real típicamente da <50m
        
        const newCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: accuracy,
          timestamp: pos.timestamp,
          speed: pos.coords.speed || 0,
          heading: pos.coords.heading || null,
          isGPS: isGPSDevice
        };
        
        setCoords(newCoords);
        setGeoStatus('granted');
        
        if (isGPSDevice) {
          console.log('[Report] 📡 GPS satelital:', {
            lat: newCoords.lat.toFixed(6),
            lng: newCoords.lng.toFixed(6),
            accuracy: '±' + accuracy.toFixed(0) + 'm',
            speed: newCoords.speed ? (newCoords.speed * 3.6).toFixed(1) + ' km/h' : '0 km/h'
          });
        } else {
          console.log('[Report] 📶 WiFi/Red (sin GPS):', {
            lat: newCoords.lat.toFixed(6),
            lng: newCoords.lng.toFixed(6),
            accuracy: '±' + (accuracy/1000).toFixed(1) + ' km'
          });
        }
      },
      (err) => {
        if (!isMounted.current) return;
        console.error('[Report] ❌ Error ubicación:', err);
        setGeoStatus('denied');
        
        let errorMsg = 'Error de ubicación: ';
        if (err.code === 1) errorMsg += 'Permiso denegado. Permite el acceso en tu navegador.';
        else if (err.code === 2) errorMsg += 'Posición no disponible. Verifica tu conexión.';
        else if (err.code === 3) errorMsg += 'Timeout. Verifica tu conexión GPS/WiFi.';
        else errorMsg += err.message;
        
        setError(errorMsg);
      },
      {
        enableHighAccuracy: true,  // Intenta usar GPS si está disponible
        timeout: 60000,            // 60s para ubicación inicial
        maximumAge: 0              // No usar caché
      }
    );

    // Cleanup: detener seguimiento al desmontar componente
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        console.log('[Report] 🛑 Seguimiento detenido');
      }
      isMounted.current = false;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selected || sending) return;
    
    // VALIDACIÓN OBLIGATORIA: debe haber coordenadas reales
    if (!coords || geoStatus !== 'granted') {
      setError('Debes permitir el acceso a tu ubicación para enviar el reporte.');
      return;
    }

    setSending(true);
    setError(null);

    const body = {
      report_type: TYPE_MAP[selected] || 'other',
      description: description.trim() || `Reporte: ${REPORT_TYPES.find(t => t.id === selected)?.label || selected}`,
      latitude: coords.lat,
      longitude: coords.lng,
    };

    console.log('[Report] Enviando reporte con coordenadas exactas:', body);

    try {
      const API_BASE = window.TPPMAPS_API || '/api/v1';
      const res = await fetch(`${API_BASE}/public/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSubmitted(true);
    } catch (err) {
      setError(`No se pudo enviar el reporte. ${err.message || 'Intenta de nuevo.'}`);
    } finally {
      setSending(false);
    }
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
            <button onClick={() => { setSubmitted(false); setSelected(null); setDescription(''); }} style={btnOutline}>
              Nuevo reporte
            </button>
            <button onClick={() => navigate(`/map?lat=${coords.lat}&lng=${coords.lng}&zoom=16`)} style={btnPrimary}>
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
          {/* Indicador de geolocalización EN TIEMPO REAL */}
          <div style={{ 
            marginTop: '1rem', 
            padding: '0.75rem', 
            borderRadius: '8px',
            backgroundColor: coords?.isGPS ? 'rgba(34,211,238,0.1)' : 'rgba(251,191,36,0.1)',
            border: `2px solid ${coords?.isGPS ? '#22d3ee' : '#fbbf24'}`
          }}>
            <p style={{ 
              color: coords?.isGPS ? '#22d3ee' : '#fbbf24',
              fontSize: '0.85rem', 
              fontWeight: 600,
              margin: 0
            }}>
              {geoStatus === 'detecting' && '⏳ Buscando ubicación...'}
              {geoStatus === 'granted' && coords && (
                <>
                  <span style={{ fontSize: '1.1rem' }}>
                    {coords.isGPS ? '📡 GPS Real' : '📶 WiFi/Red'} · {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                  </span>
                  <br />
                  <span style={{ fontSize: '0.7rem', color: coords.isGPS ? '#4ade80' : '#fb923c' }}>
                    Precisión: ±{coords.isGPS ? coords.accuracy.toFixed(0) + 'm' : (coords.accuracy/1000).toFixed(1) + 'km'}
                    {!coords.isGPS && ' Sin GPS (PC/laptop)'}
                    {coords.speed > 0 && ` • Velocidad: ${(coords.speed * 3.6).toFixed(1)} km/h`}
                    {' • '}
                    Actualizado: {new Date(coords.timestamp).toLocaleTimeString('es-CO')}
                  </span>
                  {!coords.isGPS && (
                    <>
                      <br />
                      <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontStyle: 'italic' }}>
                        💡 Para GPS real (±5-20m), usa celular/tablet
                      </span>
                    </>
                  )}
                </>
              )}
              {geoStatus === 'denied' && 'Ubicación bloqueada. Permite el acceso y recarga la página.'}
            </p>
          </div>
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

          {/* Error */}
          {error && (
            <div style={{
              padding: '0.75rem 1rem', marginBottom: '1.5rem',
              backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px', color: '#fca5a5', fontSize: '0.875rem',
            }}>
              ⚠ {error}
            </div>
          )}

          {/* Submit */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              type="submit"
              disabled={!selected || sending}
              style={{
                ...btnPrimary,
                opacity: (selected && !sending) ? 1 : 0.4,
                cursor: (selected && !sending) ? 'pointer' : 'not-allowed',
                padding: '0.875rem 2.5rem',
                fontSize: '1rem',
              }}
            >
              {sending ? 'Enviando…' : 'Enviar reporte'}
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
