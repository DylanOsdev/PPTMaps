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
      <div className="bg-gray-900 bg-opacity-95 rounded-lg shadow-xl border border-cyan-500/30 p-4 mb-4">
        <h3 className="text-sm font-bold text-cyan-400 mb-2 uppercase tracking-wider">🌬️ Calidad del Aire</h3>
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 bg-opacity-95 rounded-lg shadow-xl border border-red-500/30 p-4 mb-4">
        <h3 className="text-sm font-bold text-cyan-400 mb-2 uppercase tracking-wider">🌬️ Calidad del Aire</h3>
        <p className="text-xs text-red-400">Error: {error}</p>
      </div>
    );
  }

  const avgAQI = data && data.length > 0
    ? Math.round(data.reduce((sum, r) => sum + (r.aqi || 0), 0) / data.filter(r => r.aqi).length)
    : null;

  const { level, color, textColor } = getAQILevel(avgAQI);
  const recommendation = getHealthRecommendation(avgAQI);

  return (
    <div className="bg-gray-900 bg-opacity-95 rounded-lg shadow-xl border border-cyan-500/30 p-4 mb-4">
      <h3 className="text-sm font-bold text-cyan-400 mb-3 uppercase tracking-wider">🌬️ Calidad del Aire</h3>
      
      <div 
        className="rounded-lg p-4 mb-3 text-center border-2" 
        style={{ 
          backgroundColor: `${color}20`,
          borderColor: color,
          boxShadow: `0 0 15px ${color}40`
        }}
      >
        <div className="text-4xl font-bold" style={{ color }}>
          {avgAQI !== null ? avgAQI : '—'}
        </div>
        <div className="text-xs font-semibold mt-1 uppercase tracking-wide" style={{ color }}>
          AQI • {level}
        </div>
      </div>

      <p className="text-xs text-gray-300 leading-relaxed">
        {recommendation}
      </p>

      {data && data.length > 0 && (
        <div className="mt-3 pt-3 border-t border-cyan-500/20">
          <p className="text-xs text-cyan-400/70">
            {data.length} estaciones monitoreadas
          </p>
        </div>
      )}
    </div>
  );
};
