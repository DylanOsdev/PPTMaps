import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWeather } from '../hooks/useWeather';

// Mock de fetch global
global.fetch = vi.fn();

const mockOpenMeteoResponse = {
  current: {
    temperature_2m: 24.5,
    apparent_temperature: 26.3,
    relative_humidity_2m: 72,
    wind_speed_10m: 12.5,
    precipitation: 0,
    cloud_cover: 45,
    surface_pressure: 1013.2,
    weather_code: 2, // Parcialmente nublado
  },
  hourly: {
    time: [
      '2026-06-06T13:00:00',
      '2026-06-06T14:00:00',
      '2026-06-06T15:00:00',
      '2026-06-06T16:00:00',
      '2026-06-06T17:00:00',
      '2026-06-06T18:00:00',
      '2026-06-06T19:00:00',
      '2026-06-06T20:00:00',
    ],
    temperature_2m: [23, 24, 25, 26, 25, 23, 22, 21],
    precipitation_probability: [5, 10, 20, 30, 45, 60, 70, 50],
    weather_code: [0, 1, 1, 2, 51, 61, 63, 51],
  },
  daily: {
    time: ['2026-06-07', '2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11'],
    temperature_2m_max: [28, 29, 27, 26, 30],
    temperature_2m_min: [18, 19, 17, 16, 20],
    precipitation_sum: [5.2, 2.1, 12.5, 0.5, 0],
    weather_code: [51, 1, 61, 0, 0],
  },
};

describe('useWeather hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe iniciar con loading=true', () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockOpenMeteoResponse,
    });

    const { result } = renderHook(() => useWeather());
    expect(result.current.loading).toBe(true);
    expect(result.current.weather).toBe(null);
  });

  it('debe fetchear datos de clima desde el backend al montarse', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockOpenMeteoResponse,
    });

    renderHook(() => useWeather());

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/v1/public/weather/forecast');
    });
  });

  it('debe parsear datos de clima correctamente', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockOpenMeteoResponse,
    });

    const { result } = renderHook(() => useWeather());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.weather).toBeDefined();
    expect(result.current.weather.temp).toBe(24.5);
    expect(result.current.weather.feelsLike).toBe(26.3);
    expect(result.current.weather.humidity).toBe(72);
    expect(result.current.weather.windSpeed).toBe(12.5);
    expect(result.current.weather.rain).toBe(0);
    expect(result.current.weather.cloud).toBe(45);
    expect(result.current.weather.pressure).toBe(1013.2);
  });

  it('debe parsear condición climática (WMO code)', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockOpenMeteoResponse,
    });

    const { result } = renderHook(() => useWeather());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.weather.condition.label).toBe('Parcial. nublado');
    expect(result.current.weather.condition.icon).toBe('⛅');
  });

  it('debe parsear próximas 6 horas de pronóstico', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockOpenMeteoResponse,
    });

    const { result } = renderHook(() => useWeather());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.weather.forecastHours).toHaveLength(6);
    // Solo verificamos que tenga la estructura correcta
    expect(result.current.weather.forecastHours[0]).toHaveProperty('time');
    expect(result.current.weather.forecastHours[0]).toHaveProperty('temp');
    expect(result.current.weather.forecastHours[0]).toHaveProperty('prob');
  });

  it('debe parsear próximos 5 días de pronóstico', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockOpenMeteoResponse,
    });

    const { result } = renderHook(() => useWeather());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.weather.forecastDays).toHaveLength(5);
    expect(result.current.weather.forecastDays[0].max).toBe(28);
    expect(result.current.weather.forecastDays[0].min).toBe(18);
    expect(result.current.weather.forecastDays[0].rain).toBe(5.2);
  });

  it('debe manejar errores HTTP y setear error state', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useWeather());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('HTTP 500');
    expect(result.current.weather).toBe(null);
  });

  it('debe manejar errores de red (fetch failure)', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useWeather());

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { timeout: 10000 }
    );

    expect(result.current.error).toBe('Network error');
    expect(result.current.weather).toBe(null);
  });

  it('debe tener función refresh para actualizar datos manualmente', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockOpenMeteoResponse,
    });

    const { result } = renderHook(() => useWeather());

    await waitFor(
      () => {
        expect(result.current.weather).not.toBeNull();
      },
      { timeout: 10000 }
    );

    expect(result.current.refresh).toBeDefined();
    expect(typeof result.current.refresh).toBe('function');
  });
});
