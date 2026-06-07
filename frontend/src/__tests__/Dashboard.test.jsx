import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
import * as useAccidentStatsModule from '../hooks/useAccidentStats';

const mockStats = {
  total: 702540,
  by_severity: [
    { key: 'MUERTO', count: 5234 },
    { key: 'HERIDO', count: 150000 },
    { key: 'SOLO DAÑOS', count: 547306 },
  ],
  by_year: [
    { key: '2008', count: 35000 },
    { key: '2009', count: 38000 },
    { key: '2010', count: 42000 },
  ],
  by_comuna: [
    { key: 'LAURELES', count: 45000 },
    { key: 'EL POBLADO', count: 42000 },
    { key: 'BELÉN', count: 38000 },
  ],
  by_class: [
    { key: 'CHOQUE', count: 350000 },
    { key: 'ATROPELLO', count: 120000 },
    { key: 'CAÍDA', count: 90000 },
  ],
};

describe('Dashboard.jsx - Dashboard Analítico', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe mostrar estado de carga mientras fetcha datos', () => {
    vi.spyOn(useAccidentStatsModule, 'useAccidentStats').mockReturnValue({
      stats: null,
      loading: true,
      error: null,
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(screen.getByText('CARGANDO ANALÍTICA…')).toBeInTheDocument();
  });

  it('debe mostrar error si falla el fetch de stats', () => {
    vi.spyOn(useAccidentStatsModule, 'useAccidentStats').mockReturnValue({
      stats: null,
      loading: false,
      error: 'HTTP 500',
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(screen.getByText('⚠ SIN DATOS ANALÍTICOS')).toBeInTheDocument();
    expect(screen.getByText('HTTP 500')).toBeInTheDocument();
  });

  it('debe renderizar KPIs correctamente con datos reales', async () => {
    vi.spyOn(useAccidentStatsModule, 'useAccidentStats').mockReturnValue({
      stats: mockStats,
      loading: false,
      error: null,
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('702.540')).toBeInTheDocument(); // Total formateado
      expect(screen.getByText('5.234')).toBeInTheDocument(); // Víctimas fatales
      expect(screen.getByText('LAURELES')).toBeInTheDocument(); // Comuna más crítica
      expect(screen.getByText('CHOQUE')).toBeInTheDocument(); // Clase más frecuente
    });
  });

  it('debe renderizar título del dashboard', () => {
    vi.spyOn(useAccidentStatsModule, 'useAccidentStats').mockReturnValue({
      stats: mockStats,
      loading: false,
      error: null,
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(screen.getByText('DASHBOARD ANALÍTICO')).toBeInTheDocument();
  });

  it('debe renderizar links de navegación (Inicio y Mapa)', () => {
    vi.spyOn(useAccidentStatsModule, 'useAccidentStats').mockReturnValue({
      stats: mockStats,
      loading: false,
      error: null,
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(screen.getByText('← Inicio')).toBeInTheDocument();
    expect(screen.getByText('🗺 Mapa')).toBeInTheDocument();
  });

  it('debe renderizar títulos de los 4 gráficos', () => {
    vi.spyOn(useAccidentStatsModule, 'useAccidentStats').mockReturnValue({
      stats: mockStats,
      loading: false,
      error: null,
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(screen.getByText('POR GRAVEDAD')).toBeInTheDocument();
    expect(screen.getByText('POR CLASE DE ACCIDENTE')).toBeInTheDocument();
    expect(screen.getByText('TOP 10 COMUNAS')).toBeInTheDocument();
    expect(screen.getByText('EVOLUCIÓN ANUAL')).toBeInTheDocument();
  });

  it('debe renderizar footer con fuente de datos', () => {
    vi.spyOn(useAccidentStatsModule, 'useAccidentStats').mockReturnValue({
      stats: mockStats,
      loading: false,
      error: null,
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(screen.getByText(/Secretaría de Movilidad de Medellín/i)).toBeInTheDocument();
  });

  it('debe manejar stats vacías sin romper', () => {
    vi.spyOn(useAccidentStatsModule, 'useAccidentStats').mockReturnValue({
      stats: {
        total: 0,
        by_severity: [],
        by_year: [],
        by_comuna: [],
        by_class: [],
      },
      loading: false,
      error: null,
    });

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(screen.getByText('DASHBOARD ANALÍTICO')).toBeInTheDocument();
    expect(screen.getByText('INCIDENTES TOTALES')).toBeInTheDocument();
  });
});
