/**
 * Tests para el parser de direcciones colombianas
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { geocodeQuery, buildGeocodeIndex } from '../geocode.js';

// Mock de normalizeText
vi.mock('../../core/utils.js', () => ({
  normalizeText: (text) => text.toLowerCase().trim()
}));

// Mock de AppState
vi.mock('../../core/state.js', () => ({
  AppState: {}
}));

describe('Parser de direcciones colombianas', () => {
  let index;

  beforeEach(() => {
    // Setup básico del índice
    index = {
      'envigado': [6.169, -75.578],
      'bello': [6.337, -75.558]
    };
  });

  describe('Formato colombiano estándar', () => {
    it('debe parsear "calle 105 a # 39 a - 38"', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{
            lat: '6.2518',
            lon: '-75.5636'
          }]
        });

      const result = await geocodeQuery('calle 105 a # 39 a - 38', index);
      
      expect(result).toEqual([6.2518, -75.5636]);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('debe parsear "carrera 43 # 52 - 30"', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{
            lat: '6.2442',
            lon: '-75.5812'
          }]
        });

      const result = await geocodeQuery('carrera 43 # 52 - 30', index);
      
      expect(result).toEqual([6.2442, -75.5812]);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('debe parsear con abreviatura "cra 70 # 44 - 51"', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{
            lat: '6.25',
            lon: '-75.60'
          }]
        });

      const result = await geocodeQuery('cra 70 # 44 - 51', index);
      
      expect(result).toEqual([6.25, -75.60]);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('debe parsear con abreviatura "cll 10 # 30 - 15"', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{
            lat: '6.24',
            lon: '-75.57'
          }]
        });

      const result = await geocodeQuery('cll 10 # 30 - 15', index);
      
      expect(result).toEqual([6.24, -75.57]);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('debe parsear "avenida el poblado # 10 - 20"', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{
            lat: '6.20',
            lon: '-75.56'
          }]
        });

      const result = await geocodeQuery('avenida el poblado # 10 - 20', index);
      
      expect(result).toEqual([6.20, -75.56]);
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Fallback a Nominatim', () => {
    it('debe intentar 3 queries diferentes', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => [] })  // 1er intento
        .mockResolvedValueOnce({ ok: true, json: async () => [] })  // 2do intento
        .mockResolvedValueOnce({                                      // 3er intento
          ok: true,
          json: async () => [{
            lat: '6.25',
            lon: '-75.58'
          }]
        });

      const result = await geocodeQuery('calle 100 # 50 - 25', index);
      
      expect(result).toEqual([6.25, -75.58]);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('debe devolver null si todos los intentos fallan', async () => {
      global.fetch = vi.fn()
        .mockResolvedValue({ ok: true, json: async () => [] });

      const result = await geocodeQuery('dirección inexistente', index);
      
      expect(result).toBeNull();
    });

    it('debe manejar errores de red', async () => {
      global.fetch = vi.fn()
        .mockRejectedValue(new Error('Network error'));

      const result = await geocodeQuery('calle 1 # 2 - 3', index);
      
      expect(result).toBeNull();
    });
  });

  describe('Coordenadas directas', () => {
    it('debe reconocer "6.25, -75.57"', async () => {
      const result = await geocodeQuery('6.25, -75.57', index);
      
      expect(result).toEqual([6.25, -75.57]);
    });

    it('debe reconocer "6.25;-75.57" con punto y coma', async () => {
      const result = await geocodeQuery('6.25;-75.57', index);
      
      expect(result).toEqual([6.25, -75.57]);
    });

    it('debe reconocer con espacios "6.25 -75.57"', async () => {
      const result = await geocodeQuery('6.25 -75.57', index);
      
      expect(result).toEqual([6.25, -75.57]);
    });
  });

  describe('Aliases locales', () => {
    it('debe resolver "envigado" desde el índice', async () => {
      const result = await geocodeQuery('envigado', index);
      
      expect(result).toEqual([6.169, -75.578]);
    });

    it('debe resolver "bello" desde el índice', async () => {
      const result = await geocodeQuery('bello', index);
      
      expect(result).toEqual([6.337, -75.558]);
    });
  });

  describe('Headers de Nominatim', () => {
    it('debe incluir User-Agent y Accept-Language', async () => {
      global.fetch = vi.fn()
        .mockResolvedValue({
          ok: true,
          json: async () => [{
            lat: '6.25',
            lon: '-75.58'
          }]
        });

      await geocodeQuery('calle 10 # 20 - 30', index);
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'PPTMaps/1.0',
            'Accept-Language': 'es'
          })
        })
      );
    });
  });

  describe('buildGeocodeIndex', () => {
    it('debe construir índice con comunas y aliases', () => {
      const comunasData = {
        comunas: [
          {
            slug: 'el-poblado',
            name: 'El Poblado',
            number: 14,
            center: [6.20, -75.56],
            aliases: ['Poblado']
          },
          {
            slug: 'laureles',
            name: 'Laureles',
            number: 11,
            center: [6.25, -75.60],
            aliases: []
          }
        ]
      };

      const result = buildGeocodeIndex(comunasData);
      
      expect(result['el-poblado']).toEqual([6.20, -75.56]);
      expect(result['el poblado']).toEqual([6.20, -75.56]);
      expect(result['comuna 14']).toEqual([6.20, -75.56]);
      expect(result['c14']).toEqual([6.20, -75.56]);
      expect(result['poblado']).toEqual([6.20, -75.56]);
      expect(result['laureles']).toEqual([6.25, -75.60]);
      expect(result['comuna 11']).toEqual([6.25, -75.60]);
    });
  });
});
