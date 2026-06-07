import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAccidentStats } from '../hooks/useAccidentStats';

// Mock de fetch global
global.fetch = vi.fn();

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
  ],
  by_class: [
    { key: 'CHOQUE', count: 350000 },
    { key: 'ATROPELLO', count: 120000 },
  ],
};

describe('useAccidentStats hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe iniciar con loading=true y stats=null', () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    });

    const { result } = renderHook(() => useAccidentStats());
    
    expect(result.current.loading).toBe(true);
    expect(result.current.stats).toBe(null);
    expect(result.current.error).toBe(null);
  });

  it('debe fetchear stats desde el endpoint correcto', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    });

    renderHook(() => useAccidentStats());

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/v1/public/accidents/stats');
    });
  });

  it('debe setear stats correctamente al recibir respuesta exitosa', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    });

    const { result } = renderHook(() => useAccidentStats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stats).toEqual(mockStats);
    expect(result.current.error).toBe(null);
  });

  it('debe parsear total de incidentes correctamente', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    });

    const { result } = renderHook(() => useAccidentStats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stats.total).toBe(702540);
  });

  it('debe parsear by_severity correctamente', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    });

    const { result } = renderHook(() => useAccidentStats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stats.by_severity).toHaveLength(3);
    expect(result.current.stats.by_severity[0].key).toBe('MUERTO');
    expect(result.current.stats.by_severity[0].count).toBe(5234);
  });

  it('debe parsear by_year correctamente', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    });

    const { result } = renderHook(() => useAccidentStats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stats.by_year).toHaveLength(3);
    expect(result.current.stats.by_year[0].key).toBe('2008');
  });

  it('debe parsear by_comuna correctamente', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    });

    const { result } = renderHook(() => useAccidentStats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stats.by_comuna).toHaveLength(2);
    expect(result.current.stats.by_comuna[0].key).toBe('LAURELES');
  });

  it('debe parsear by_class correctamente', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    });

    const { result } = renderHook(() => useAccidentStats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stats.by_class).toHaveLength(2);
    expect(result.current.stats.by_class[0].key).toBe('CHOQUE');
  });

  it('debe manejar errores HTTP y setear error state', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useAccidentStats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('HTTP 500');
    expect(result.current.stats).toBe(null);
  });

  it('debe manejar errores de red (fetch failure)', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useAccidentStats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.stats).toBe(null);
  });

  it('debe limpiar el efecto al desmontar el componente', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    });

    const { unmount } = renderHook(() => useAccidentStats());

    // Desmontar inmediatamente
    unmount();

    // No debe lanzar errores
    expect(() => unmount()).not.toThrow();
  });

  it('debe hacer solo un fetch al montar', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStats,
    });

    renderHook(() => useAccidentStats());

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
});
