import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadComunasData, updateMapStats } from '../static/js/map/map-service';
import { AppState } from '../static/js/core/state';

// Mock de fetch global
global.fetch = vi.fn();

// Mock de L (Leaflet)
global.L = {
  map: vi.fn(() => ({
    getCenter: vi.fn(() => ({ lat: 6.2518, lng: -75.5636 })),
    getZoom: vi.fn(() => 13),
    on: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    hasLayer: vi.fn(() => false),
  })),
  tileLayer: vi.fn(() => ({
    addTo: vi.fn(),
    setUrl: vi.fn(),
    on: vi.fn(),
  })),
};

describe('map/map-service.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    AppState.map = null;
    AppState.comunasData = null;
    document.body.innerHTML = `
      <div id="map"></div>
      <span id="statCoords"></span>
      <span id="statZoom"></span>
      <span id="statComuna"></span>
      <span id="statLocation"></span>
      <span id="statLayers"></span>
      <span id="layerFraction"></span>
    `;
  });

  describe('loadComunasData', () => {
    it('debe intentar cargar desde el backend primero', async () => {
      const mockComunas = { comunas: [{ name: 'LAURELES' }] };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockComunas,
      });

      const result = await loadComunasData();
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/public/comunas'),
        expect.any(Object)
      );
      expect(result).toEqual(mockComunas);
    });

    it('debe hacer fallback a JSON estático si backend falla', async () => {
      fetch
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ comunas: [{ name: 'BELÉN' }] }),
        });

      const result = await loadComunasData();
      
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(result.comunas).toBeDefined();
    });

    it('debe manejar timeout en la llamada al backend', async () => {
      fetch.mockRejectedValueOnce(new Error('Timeout'));
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ comunas: [] }),
      });

      const result = await loadComunasData();
      expect(result.comunas).toBeDefined();
    });
  });

  describe('updateMapStats', () => {
    it('debe actualizar coordenadas del centro del mapa', () => {
      const mockMap = {
        getCenter: () => ({ lat: 6.2518, lng: -75.5636 }),
        getZoom: () => 13,
      };
      AppState.map = mockMap;

      const isInsideCity = () => true;
      updateMapStats(isInsideCity);

      const coordsEl = document.getElementById('statCoords');
      expect(coordsEl.textContent).toBe('6.2518, -75.5636');
    });

    it('debe actualizar nivel de zoom', () => {
      const mockMap = {
        getCenter: () => ({ lat: 6.2518, lng: -75.5636 }),
        getZoom: () => 15,
      };
      AppState.map = mockMap;

      const isInsideCity = () => true;
      updateMapStats(isInsideCity);

      const zoomEl = document.getElementById('statZoom');
      expect(zoomEl.textContent).toBe('15.0');
    });

    it('debe mostrar "Fuera de comuna" cuando no está en ninguna comuna', () => {
      const mockMap = {
        getCenter: () => ({ lat: 0, lng: 0 }),
        getZoom: () => 10,
      };
      AppState.map = mockMap;

      const isInsideCity = () => false;
      updateMapStats(isInsideCity);

      const comunaEl = document.getElementById('statComuna');
      expect(comunaEl.textContent).toBe('Fuera de comuna (área metro)');
    });

    it('debe actualizar contador de capas activas', () => {
      document.body.innerHTML = `
        <div id="map"></div>
        <input type="checkbox" class="toggle" data-layer="layer1" checked />
        <input type="checkbox" class="toggle" data-layer="layer2" checked />
        <input type="checkbox" class="toggle" data-layer="layer3" />
        <span id="statLayers"></span>
        <span id="layerFraction"></span>
      `;

      const mockMap = {
        getCenter: () => ({ lat: 6.2518, lng: -75.5636 }),
        getZoom: () => 13,
      };
      AppState.map = mockMap;

      const isInsideCity = () => true;
      updateMapStats(isInsideCity);

      const layersEl = document.getElementById('statLayers');
      expect(layersEl.textContent).toBe('2');

      const fractionEl = document.getElementById('layerFraction');
      expect(fractionEl.textContent).toBe('2/3');
    });

    it('debe manejar la ausencia de mapa sin romper', () => {
      AppState.map = null;
      expect(() => updateMapStats(() => true)).not.toThrow();
    });

    it('debe manejar elementos DOM faltantes sin romper', () => {
      document.body.innerHTML = '<div id="map"></div>';
      
      const mockMap = {
        getCenter: () => ({ lat: 6.2518, lng: -75.5636 }),
        getZoom: () => 13,
      };
      AppState.map = mockMap;

      expect(() => updateMapStats(() => true)).not.toThrow();
    });
  });

  describe('toggleSatellite', () => {
    it('debe existir la función toggleSatellite (importada)', async () => {
      const { toggleSatellite } = await import('../static/js/map/map-service');
      expect(typeof toggleSatellite).toBe('function');
    });
  });

  describe('initMap', () => {
    it('debe existir la función initMap (importada)', async () => {
      const { initMap } = await import('../static/js/map/map-service');
      expect(typeof initMap).toBe('function');
    });
  });

  describe('setupMapLayers', () => {
    it('debe existir la función setupMapLayers (importada)', async () => {
      const { setupMapLayers } = await import('../static/js/map/map-service');
      expect(typeof setupMapLayers).toBe('function');
    });
  });
});
