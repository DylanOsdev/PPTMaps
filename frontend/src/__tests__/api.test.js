import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  pingHealth,
  fetchTelemetry,
  fetchAlerts,
  fetchAccidentsGeoJSON,
  fetchFatalities,
  fetchFloodZones,
  fetchRoute,
  fetchWeather,
  fetchRainRisk,
  fetchPublicReports,
  createPublicReport,
} from '../static/js/services/api.js';

// Mock de fetch global
global.fetch = vi.fn();

describe('services/api.js - Cliente HTTP', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('pingHealth', () => {
    it('debe retornar true si health check es exitoso', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok' }),
      });

      const result = await pingHealth();
      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith('/health', expect.any(Object));
    });

    it('debe retornar false si health check falla (HTTP error)', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await pingHealth();
      expect(result).toBe(false);
    });

    it('debe retornar false si health check falla (network error)', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await pingHealth();
      expect(result).toBe(false);
    });

    it('debe usar timeout de 5s en el fetch', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok' }),
      });

      await pingHealth();

      expect(fetch).toHaveBeenCalledWith(
        '/health',
        expect.objectContaining({
          signal: expect.any(Object),
        })
      );
    });
  });

  describe('fetchTelemetry', () => {
    it('debe fetchear telemetría del endpoint correcto', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ vehicle_id: 1, speed: 45 }),
      });

      const result = await fetchTelemetry();
      expect(result).toEqual({ vehicle_id: 1, speed: 45 });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/public/telemetry/latest'),
        expect.any(Object)
      );
    });

    it('debe lanzar error si fetch falla', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(fetchTelemetry()).rejects.toThrow('Error fetching telemetry');
    });
  });

  describe('fetchAlerts', () => {
    it('debe fetchear alertas con filtros correctos', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 1, message: 'Alerta test' }],
      });

      const result = await fetchAlerts();
      expect(result).toEqual([{ id: 1, message: 'Alerta test' }]);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/public/alerts?is_resolved=false&limit=20'),
        expect.any(Object)
      );
    });

    it('debe lanzar error si fetch falla', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(fetchAlerts()).rejects.toThrow('Error fetching alerts');
    });
  });

  describe('fetchAccidentsGeoJSON', () => {
    it('debe fetchear GeoJSON de accidentes', async () => {
      const mockGeoJSON = {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-75.5, 6.2] } }],
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGeoJSON,
      });

      const result = await fetchAccidentsGeoJSON();
      expect(result).toEqual(mockGeoJSON);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/public/accidents/geojson'),
        expect.any(Object)
      );
    });
  });

  describe('fetchFatalities', () => {
    it('debe fetchear víctimas fatales', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 1, gravedad: 'MUERTO' }],
      });

      const result = await fetchFatalities();
      expect(result).toEqual([{ id: 1, gravedad: 'MUERTO' }]);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/public/fatalities'),
        expect.any(Object)
      );
    });
  });

  describe('fetchFloodZones', () => {
    it('debe fetchear zonas de inundación', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 1, zone: 'Río Medellín' }],
      });

      const result = await fetchFloodZones();
      expect(result).toEqual([{ id: 1, zone: 'Río Medellín' }]);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/public/flood-zones'),
        expect.any(Object)
      );
    });
  });

  describe('fetchRoute', () => {
    it('debe fetchear ruta con destino solamente', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ route: [[6.2, -75.5], [6.3, -75.6]] }),
      });

      const result = await fetchRoute('6.2,-75.5');
      expect(result).toEqual({ route: [[6.2, -75.5], [6.3, -75.6]] });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/public/routes/safe-weather?origin_lat=6.2518&origin_lng=-75.5636&dest_lat=6.2&dest_lng=-75.5'),
        expect.any(Object)
      );
    });

    it('debe fetchear ruta con origen y destino', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ route: [[6.2, -75.5], [6.3, -75.6]] }),
      });

      await fetchRoute('6.2,-75.5', '6.3,-75.6');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('origin_lat=6.3&origin_lng=-75.6'),
        expect.any(Object)
      );
    });

    it('debe usar cache: no-store para evitar caché', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await fetchRoute('6.2,-75.5');
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          cache: 'no-store',
        })
      );
    });

    it('debe lanzar error si fetch falla', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(fetchRoute('6.2,-75.5')).rejects.toThrow('Route fetch failed');
    });
  });

  describe('fetchWeather', () => {
    it('debe fetchear clima del backend', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ temp: 24.5 }),
      });

      const result = await fetchWeather();
      expect(result).toEqual({ temp: 24.5 });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/public/weather'),
        expect.any(Object)
      );
    });
  });

  describe('fetchRainRisk', () => {
    it('debe fetchear riesgo de lluvia', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ risk: 'high' }),
      });

      const result = await fetchRainRisk();
      expect(result).toEqual({ risk: 'high' });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/public/rain-risk'),
        expect.any(Object)
      );
    });
  });

  describe('fetchPublicReports', () => {
    it('debe fetchear reportes ciudadanos públicos', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 1, description: 'Accidente' }],
      });

      const result = await fetchPublicReports();
      expect(result).toEqual([{ id: 1, description: 'Accidente' }]);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/public/reports'),
        expect.any(Object)
      );
    });
  });

  describe('createPublicReport', () => {
    it('debe enviar POST con datos del reporte', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, status: 'created' }),
      });

      const reportData = {
        report_type: 'colision',
        description: 'Accidente en Calle 10',
        latitude: 6.2518,
        longitude: -75.5636,
      };

      const result = await createPublicReport(reportData);
      expect(result).toEqual({ id: 1, status: 'created' });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/public/reports'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reportData),
        })
      );
    });

    it('debe lanzar error si POST falla', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      const reportData = {
        report_type: 'colision',
        description: 'Test',
        latitude: 6.2518,
        longitude: -75.5636,
      };

      await expect(createPublicReport(reportData)).rejects.toThrow('Error creating report');
    });
  });

});
