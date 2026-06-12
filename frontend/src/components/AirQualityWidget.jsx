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
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">🌬️ Calidad del Aire</h3>
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">🌬️ Calidad del Aire</h3>
        <p className="text-sm text-red-600">Error al cargar datos: {error}</p>
      </div>
    );
  }

  const avgAQI = data && data.length > 0
    ? Math.round(data.reduce((sum, r) => sum + (r.aqi || 0), 0) / data.filter(r => r.aqi).length)
    : null;

  const { level, color, textColor } = getAQILevel(avgAQI);
  const recommendation = getHealthRecommendation(avgAQI);

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">🌬️ Calidad del Aire</h3>
      
      <div 
        className="rounded-lg p-4 mb-3 text-center" 
        style={{ backgroundColor: color }}
      >
        <div className="text-3xl font-bold" style={{ color: textColor }}>
          {avgAQI !== null ? avgAQI : '—'}
        </div>
        <div className="text-sm font-medium mt-1" style={{ color: textColor }}>
          AQI • {level}
        </div>
      </div>

      <p className="text-xs text-gray-600 leading-relaxed">
        {recommendation}
      </p>

      {data && data.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            {data.length} estaciones monitoreadas
          </p>
        </div>
      )}
    </div>
  );
};
