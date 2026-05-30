import React from 'react';

// Colores del pronóstico de lluvia
function rainColor(prob) {
  if (prob >= 70) return '#f87171'; // rojo — alta
  if (prob >= 40) return '#fbbf24'; // dorado — media
  return '#4ade80';                 // verde — baja
}

export const WeatherWidget = React.memo(function WeatherWidget({ weather, loading, error }) {

  const panelStyle = {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '10px',
    color: '#94a3b8',
  };

  if (loading) return (
    <div style={{ ...panelStyle, padding: '16px', textAlign: 'center' }}>
      <div style={{ color: '#67e8f9', marginBottom: '6px', letterSpacing: '0.1em' }}>CARGANDO CLIMA...</div>
      <div style={{ opacity: 0.4 }}>Conectando al backend</div>
    </div>
  );

  if (error || !weather) return (
    <div style={{ ...panelStyle, padding: '16px', textAlign: 'center', color: '#f87171' }}>
      <div>⚠ SIN DATOS CLIMÁTICOS</div>
      <div style={{ opacity: 0.6, marginTop: '4px', fontSize: '9px' }}>{error}</div>
    </div>
  );

  return (
    <div style={panelStyle}>

      {/* ── Temperatura actual ── */}
      <div style={{
        padding: '14px 16px 10px',
        borderBottom: '1px solid rgba(56, 189, 248, 0.12)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '8px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{
              fontFamily: '"Orbitron", sans-serif',
              fontSize: '36px',
              fontWeight: 700,
              color: '#e2e8f0',
              lineHeight: 1,
              textShadow: '0 0 20px rgba(56, 189, 248, 0.3)',
            }}>
              {weather.temp.toFixed(1)}
            </span>
            <span style={{ fontSize: '16px', color: '#67e8f9', fontWeight: 600 }}>°C</span>
          </div>
          <div style={{ marginTop: '4px', color: '#67e8f9', letterSpacing: '0.08em', fontSize: '9px' }}>
            {weather.condition.icon} {weather.condition.label.toUpperCase()}
          </div>
          <div style={{ marginTop: '2px', opacity: 0.5, fontSize: '9px' }}>
            Sensación: {weather.feelsLike.toFixed(1)}°C
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '9px', lineHeight: 1.8 }}>
          <div>💧 {weather.humidity}%</div>
          <div>💨 {weather.windSpeed.toFixed(0)} km/h</div>
          <div>☁ {weather.cloud}%</div>
          <div>🌡 {weather.pressure.toFixed(0)} hPa</div>
        </div>
      </div>

      {/* ── Lluvia actual ── */}
      {weather.rain > 0 && (
        <div style={{
          padding: '6px 16px',
          background: 'rgba(248, 113, 113, 0.08)',
          borderBottom: '1px solid rgba(248, 113, 113, 0.2)',
          color: '#f87171',
          letterSpacing: '0.08em',
          fontSize: '9px',
        }}>
          🌧 LLUVIA ACTIVA: {weather.rain.toFixed(1)} mm
        </div>
      )}

      {/* ── Pronóstico próximas 6 horas ── */}
      <div style={{ padding: '10px 16px 6px', borderBottom: '1px solid rgba(56, 189, 248, 0.1)' }}>
        <div style={{
          fontSize: '8px', letterSpacing: '0.15em', color: '#67e8f9',
          marginBottom: '8px', fontWeight: 600,
        }}>
          PRÓXIMAS 6 HORAS
        </div>
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'space-between' }}>
          {weather.forecastHours.map((h, i) => (
            <div key={i} style={{
              flex: 1,
              textAlign: 'center',
              padding: '6px 2px',
              background: 'rgba(8, 12, 18, 0.6)',
              border: '1px solid rgba(56, 189, 248, 0.12)',
              borderRadius: '4px',
            }}>
              <div style={{ fontSize: '8px', opacity: 0.6, marginBottom: '3px' }}>{h.time}</div>
              <div style={{ fontSize: '14px', lineHeight: 1 }}>{h.icon}</div>
              <div style={{ fontSize: '9px', color: '#e2e8f0', marginTop: '3px', fontWeight: 600 }}>{h.temp}°</div>
              <div style={{ fontSize: '8px', color: rainColor(h.prob), marginTop: '2px' }}>
                {h.prob}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Pronóstico 5 días ── */}
      <div style={{ padding: '10px 16px' }}>
        <div style={{
          fontSize: '8px', letterSpacing: '0.15em', color: '#67e8f9',
          marginBottom: '8px', fontWeight: 600,
        }}>
          PRONÓSTICO 5 DÍAS
        </div>
        {weather.forecastDays.map((d, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 0',
            borderBottom: i < weather.forecastDays.length - 1 ? '1px solid rgba(56, 189, 248, 0.07)' : 'none',
          }}>
            <span style={{ width: '32px', opacity: 0.6, fontSize: '9px' }}>{d.day}</span>
            <span style={{ fontSize: '14px' }}>{d.icon}</span>
            <span style={{ color: '#f87171', fontSize: '9px' }}>↓{d.min.toFixed(0)}°</span>
            <span style={{ color: '#fbbf24', fontSize: '9px' }}>↑{d.max.toFixed(0)}°</span>
            <span style={{ color: '#67e8f9', fontSize: '8px' }}>💧{d.rain.toFixed(0)}mm</span>
          </div>
        ))}
      </div>

      {/* ── Timestamp ── */}
      <div style={{
        padding: '6px 16px',
        borderTop: '1px solid rgba(56, 189, 248, 0.1)',
        fontSize: '8px',
        opacity: 0.4,
        textAlign: 'right',
        letterSpacing: '0.08em',
      }}>
        ACTUALIZADO: {weather.updatedAt} · Open-Meteo API
      </div>

    </div>
  );
});
