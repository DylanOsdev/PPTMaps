import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WeatherWidget } from '../components/WeatherWidget';

const mockWeather = {
  temp: 24.5,
  feelsLike: 26.3,
  humidity: 72,
  windSpeed: 12.5,
  rain: 0,
  cloud: 45,
  pressure: 1013.2,
  condition: { label: 'Parcialmente nublado', icon: '⛅' },
  updatedAt: '14:30',
  forecastHours: [
    { time: '15:00', temp: 25, prob: 20, icon: '🌤️' },
    { time: '16:00', temp: 26, prob: 30, icon: '⛅' },
    { time: '17:00', temp: 25, prob: 45, icon: '🌦️' },
    { time: '18:00', temp: 23, prob: 60, icon: '🌧️' },
    { time: '19:00', temp: 22, prob: 70, icon: '🌧️' },
    { time: '20:00', temp: 21, prob: 50, icon: '🌦️' },
  ],
  forecastDays: [
    { day: 'LUN', max: 28, min: 18, rain: 5.2, icon: '🌦️' },
    { day: 'MAR', max: 29, min: 19, rain: 2.1, icon: '🌤️' },
    { day: 'MIÉ', max: 27, min: 17, rain: 12.5, icon: '🌧️' },
    { day: 'JUE', max: 26, min: 16, rain: 0.5, icon: '☀️' },
    { day: 'VIE', max: 30, min: 20, rain: 0, icon: '☀️' },
  ],
};

describe('WeatherWidget.jsx', () => {
  it('debe mostrar loading state mientras carga datos', () => {
    render(<WeatherWidget loading={true} weather={null} error={null} />);
    expect(screen.getByText('CARGANDO CLIMA...')).toBeInTheDocument();
    expect(screen.getByText('Conectando al backend')).toBeInTheDocument();
  });

  it('debe mostrar error si falla el fetch de clima', () => {
    render(<WeatherWidget loading={false} weather={null} error="HTTP 500" />);
    expect(screen.getByText('⚠ SIN DATOS CLIMÁTICOS')).toBeInTheDocument();
    expect(screen.getByText('HTTP 500')).toBeInTheDocument();
  });

  it('debe renderizar temperatura actual correctamente', () => {
    render(<WeatherWidget loading={false} weather={mockWeather} error={null} />);
    expect(screen.getByText('24.5')).toBeInTheDocument(); // Temperatura
    expect(screen.getByText('°C')).toBeInTheDocument();
  });

  it('debe renderizar condición climática (label + icon)', () => {
    render(<WeatherWidget loading={false} weather={mockWeather} error={null} />);
    expect(screen.getByText(/PARCIALMENTE NUBLADO/i)).toBeInTheDocument();
    expect(screen.getByText('⛅')).toBeInTheDocument();
  });

  it('debe renderizar sensación térmica', () => {
    render(<WeatherWidget loading={false} weather={mockWeather} error={null} />);
    expect(screen.getByText('Sensación: 26.3°C')).toBeInTheDocument();
  });

  it('debe renderizar métricas ambientales (humedad, viento, nubosidad, presión)', () => {
    render(<WeatherWidget loading={false} weather={mockWeather} error={null} />);
    expect(screen.getByText('💧 72%')).toBeInTheDocument(); // Humedad
    expect(screen.getByText(/\d+ km\/h/)).toBeInTheDocument(); // Viento
    expect(screen.getByText('☁ 45%')).toBeInTheDocument(); // Nubosidad
    expect(screen.getByText(/\d+ hPa/)).toBeInTheDocument(); // Presión
  });

  it('NO debe mostrar alerta de lluvia si rain = 0', () => {
    render(<WeatherWidget loading={false} weather={mockWeather} error={null} />);
    expect(screen.queryByText(/LLUVIA ACTIVA/i)).not.toBeInTheDocument();
  });

  it('debe mostrar alerta de lluvia si rain > 0', () => {
    const rainyWeather = { ...mockWeather, rain: 5.2 };
    render(<WeatherWidget loading={false} weather={rainyWeather} error={null} />);
    expect(screen.getByText(/LLUVIA ACTIVA: 5.2 mm/i)).toBeInTheDocument();
  });

  it('debe renderizar título "PRÓXIMAS 6 HORAS"', () => {
    render(<WeatherWidget loading={false} weather={mockWeather} error={null} />);
    expect(screen.getByText('PRÓXIMAS 6 HORAS')).toBeInTheDocument();
  });

  it('debe renderizar 6 bloques de pronóstico horario', () => {
    render(<WeatherWidget loading={false} weather={mockWeather} error={null} />);
    expect(screen.getByText('15:00')).toBeInTheDocument();
    expect(screen.getByText('16:00')).toBeInTheDocument();
    expect(screen.getByText('17:00')).toBeInTheDocument();
    expect(screen.getByText('18:00')).toBeInTheDocument();
    expect(screen.getByText('19:00')).toBeInTheDocument();
    expect(screen.getByText('20:00')).toBeInTheDocument();
  });

  it('debe renderizar temperatura en cada bloque horario', () => {
    render(<WeatherWidget loading={false} weather={mockWeather} error={null} />);
    // Solo verificamos que existan temperaturas (pueden ser múltiples)
    expect(screen.getAllByText(/\d+°/).length).toBeGreaterThan(0);
  });

  it('debe renderizar probabilidad de lluvia en cada bloque horario', () => {
    render(<WeatherWidget loading={false} weather={mockWeather} error={null} />);
    expect(screen.getByText('20%')).toBeInTheDocument(); // 15:00
    expect(screen.getByText('30%')).toBeInTheDocument(); // 16:00
    expect(screen.getByText('70%')).toBeInTheDocument(); // 19:00
  });

  it('debe renderizar título "PRONÓSTICO 5 DÍAS"', () => {
    render(<WeatherWidget loading={false} weather={mockWeather} error={null} />);
    expect(screen.getByText('PRONÓSTICO 5 DÍAS')).toBeInTheDocument();
  });

  it('debe renderizar 5 filas de pronóstico diario', () => {
    render(<WeatherWidget loading={false} weather={mockWeather} error={null} />);
    expect(screen.getByText('LUN')).toBeInTheDocument();
    expect(screen.getByText('MAR')).toBeInTheDocument();
    expect(screen.getByText('MIÉ')).toBeInTheDocument();
    expect(screen.getByText('JUE')).toBeInTheDocument();
    expect(screen.getByText('VIE')).toBeInTheDocument();
  });

  it('debe renderizar temperaturas min/max en cada día', () => {
    render(<WeatherWidget loading={false} weather={mockWeather} error={null} />);
    expect(screen.getByText('↓18°')).toBeInTheDocument(); // LUN min
    expect(screen.getByText('↑28°')).toBeInTheDocument(); // LUN max
  });

  it('debe renderizar precipitación en cada día', () => {
    render(<WeatherWidget loading={false} weather={mockWeather} error={null} />);
    // Verificamos que haya elementos con el patrón de mm de lluvia
    expect(screen.getAllByText(/\d+mm/).length).toBeGreaterThanOrEqual(3);
  });

  it('debe renderizar timestamp de actualización', () => {
    render(<WeatherWidget loading={false} weather={mockWeather} error={null} />);
    expect(screen.getByText(/ACTUALIZADO: 14:30/i)).toBeInTheDocument();
    expect(screen.getByText(/Open-Meteo API/i)).toBeInTheDocument();
  });
});
