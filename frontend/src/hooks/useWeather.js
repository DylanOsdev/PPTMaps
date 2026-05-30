/**
 * useWeather — Datos meteorológicos en tiempo real para Medellín
 * API: Open-Meteo (gratuita, sin key, alta precisión para Colombia)
 * Lat: 6.2518, Lon: -75.5636 → Centro de Medellín (Parque Berrío)
 */
import { useState, useEffect, useRef } from 'react';

const MED_LAT = 6.2518;
const MED_LON = -75.5636;
const REFRESH_MS = 10 * 60 * 1000; // refrescar cada 10 min

const WMO_CODES = {
  0:  { label: 'Despejado',       icon: '☀️' },
  1:  { label: 'Mayorm. despejado',icon: '🌤️' },
  2:  { label: 'Parcial. nublado', icon: '⛅' },
  3:  { label: 'Nublado',          icon: '☁️' },
  45: { label: 'Niebla',           icon: '🌫️' },
  48: { label: 'Niebla con escarcha',icon:'🌫️' },
  51: { label: 'Llovizna leve',    icon: '🌦️' },
  53: { label: 'Llovizna',         icon: '🌦️' },
  55: { label: 'Llovizna intensa', icon: '🌧️' },
  61: { label: 'Lluvia leve',      icon: '🌧️' },
  63: { label: 'Lluvia',           icon: '🌧️' },
  65: { label: 'Lluvia intensa',   icon: '🌧️' },
  80: { label: 'Chubascos',        icon: '🌩️' },
  81: { label: 'Chubascos fuertes',icon: '⛈️' },
  82: { label: 'Chubascos violentos',icon:'⛈️'},
  95: { label: 'Tormenta',         icon: '⛈️' },
  99: { label: 'Tormenta con granizo',icon:'⛈️'},
};

function getCondition(code) {
  return WMO_CODES[code] || { label: 'Sin datos', icon: '❓' };
}

export function useWeather() {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const timerRef = useRef(null);

  async function fetchWeather() {
    try {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude',  MED_LAT);
      url.searchParams.set('longitude', MED_LON);
      url.searchParams.set('current', [
        'temperature_2m',
        'apparent_temperature',
        'relative_humidity_2m',
        'weather_code',
        'wind_speed_10m',
        'precipitation',
        'cloud_cover',
        'surface_pressure',
      ].join(','));
      url.searchParams.set('hourly', [
        'temperature_2m',
        'precipitation_probability',
        'weather_code',
      ].join(','));
      url.searchParams.set('daily', [
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_sum',
        'weather_code',
      ].join(','));
      url.searchParams.set('timezone',       'America/Bogota');
      url.searchParams.set('forecast_days',  '5');
      url.searchParams.set('wind_speed_unit','kmh');

      const res  = await fetch(url.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const cur = data.current;
      const cond = getCondition(cur.weather_code);

      // Próximas 6 horas
      const now      = new Date();
      const hourlyTimes = data.hourly.time.map(t => new Date(t));
      const curIdx   = hourlyTimes.findIndex(t => t >= now);
      const forecastHours = Array.from({ length: 6 }, (_, i) => {
        const idx = curIdx + i;
        return {
          time:    data.hourly.time[idx]?.slice(11, 16) ?? '--',
          temp:    data.hourly.temperature_2m[idx] ?? '--',
          prob:    data.hourly.precipitation_probability[idx] ?? 0,
          code:    data.hourly.weather_code[idx] ?? 0,
          icon:    getCondition(data.hourly.weather_code[idx] ?? 0).icon,
        };
      });

      // Próximos 5 días
      const forecastDays = data.daily.time.map((day, i) => ({
        day:    new Date(day + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short' }).toUpperCase(),
        max:    data.daily.temperature_2m_max[i],
        min:    data.daily.temperature_2m_min[i],
        rain:   data.daily.precipitation_sum[i],
        code:   data.daily.weather_code[i],
        icon:   getCondition(data.daily.weather_code[i]).icon,
      }));

      setWeather({
        temp:       cur.temperature_2m,
        feelsLike:  cur.apparent_temperature,
        humidity:   cur.relative_humidity_2m,
        windSpeed:  cur.wind_speed_10m,
        rain:       cur.precipitation,
        cloud:      cur.cloud_cover,
        pressure:   cur.surface_pressure,
        condition:  cond,
        updatedAt:  new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        forecastHours,
        forecastDays,
      });
      setLoading(false);
      setError(null);
    } catch (err) {
      console.warn('[useWeather]', err.message);
      setError(err.message);
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWeather();
    timerRef.current = setInterval(fetchWeather, REFRESH_MS);
    return () => clearInterval(timerRef.current);
  }, []);

  return { weather, loading, error, refresh: fetchWeather };
}
