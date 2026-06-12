import React from 'react';
import { useAirQuality } from '../hooks/useAirQuality';

const getAQILevel = (aqi) => {
  if (aqi === null || aqi === undefined) return { level: 'Sin datos', color: '#9CA3AF', textColor: '#374151' };
  if (aqi <= 50) return { level: 'Buena', color: '#10B981', textColor: '#FFFFFF' };
  if (aqi <= 100) return { level: 'Moderada', color: '#FBBF24', textColor: '#111827' };
  if (aqi <= 150) return { level: 'Mala', color: '#F97316', textColor: '#FFFFFF' };
  return { level: 'Muy Mala', color: '#DC2626', textColor: '#FFFFFF' };
};

const getHealthRecommendation = (aqi) => {
  if (aqi === null || aqi === undefined) return 'Esperando datos...';
  if (aqi <= 50) return 'Calidad del aire excelente para actividades al aire libre.';
  if (aqi <= 100) return 'Aceptable para la mayoría. Sensibles deben considerar reducir actividad prolongada.';
  if (aqi <= 150) return 'Grupos sensibles (niños, adultos mayores, asmáticos) deben evitar actividades al aire libre.';
  return 'Peligroso para todos. Evitar salir. Usar mascarilla si es necesario.';
};

export const AirQualityWidget = () => {
  const { data, loading, error } = useAirQuality();

  if (loading) {
    return (
      <div style={{ padding: '12px' }}>
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '12px' }}>
        <p className="text-xs text-red-400">Error: {error}</p>
      </div>
    );
  }

  const avgAQI = data && data.length > 0
    ? Math.round(data.reduce((sum, r) => sum + (r.aqi || 0), 0) / data.filter(r => r.aqi).length)
    : null;

  const { level, color } = getAQILevel(avgAQI);
  const recommendation = getHealthRecommendation(avgAQI);

  return (
    <>
      <div 
        className="rounded-lg p-3 mb-3 text-center" 
        style={{ 
          backgroundColor: `${color}15`,
          border: `1px solid ${color}50`,
          transition: 'all 0.3s'
        }}
      >
        <div className="text-3xl font-bold" style={{ color, fontFamily: '"Orbitron", sans-serif' }}>
          {avgAQI !== null ? avgAQI : '—'}
        </div>
        <div className="text-xs font-semibold mt-1 uppercase tracking-wide" style={{ color, fontFamily: '"JetBrains Mono", monospace', fontSize: '9px', letterSpacing: '0.08em' }}>
          AQI • {level}
        </div>
      </div>

      <p className="text-xs leading-relaxed" style={{ color: '#cbd5e1', fontSize: '10px', lineHeight: '1.4' }}>
        {recommendation}
      </p>

      {data && data.length > 0 && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(56, 189, 248, 0.15)' }}>
          <p className="text-xs" style={{ color: '#67e8f9', opacity: 0.7, fontSize: '9px', fontFamily: '"JetBrains Mono", monospace' }}>
            {data.length} estaciones monitoreadas
          </p>
        </div>
      )}
    </>
  );
};
