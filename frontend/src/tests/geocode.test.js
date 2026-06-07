import { describe, it, expect, vi } from 'vitest';
import { buildGeocodeIndex, geocodeQuery } from '../static/js/services/geocode.js';

// Mock normalizeText (asumiendo que es un lowercase + trim básico)
vi.mock('../static/js/core/utils.js', () => ({
  normalizeText: (text) => text.toLowerCase().trim()
}));

// Mock AppState
vi.mock('../static/js/core/state.js', () => ({
  AppState: {
    comunasData: null
  }
}));

describe('buildGeocodeIndex', () => {
  it('construye índice con aliases de metro', () => {
    const comunasData = { comunas: [] };
    const index = buildGeocodeIndex(comunasData);
    
    expect(index.envigado).toEqual([6.169, -75.578]);
    expect(index.itagui).toEqual([6.171, -75.614]);
    expect(index.bello).toEqual([6.337, -75.558]);
  });

  it('agrega comunas con múltiples claves', () => {
    const comunasData = {
      comunas: [{
        slug: 'poblado',
        name: 'El Poblado',
        number: 14,
        center: [6.2, -75.57],
        aliases: ['pob', 'zona rosa']
      }]
    };
    
    const index = buildGeocodeIndex(comunasData);
    
    expect(index.poblado).toEqual([6.2, -75.57]);
    expect(index['el poblado']).toEqual([6.2, -75.57]);
    expect(index['comuna 14']).toEqual([6.2, -75.57]);
    expect(index['c14']).toEqual([6.2, -75.57]);
    expect(index['pob']).toEqual([6.2, -75.57]);
  });
});

describe('geocodeQuery - local index', () => {
  const testIndex = {
    'poblado': [6.2, -75.57],
    'envigado': [6.169, -75.578],
  };

  it('encuentra coincidencias exactas en el índice', async () => {
    const result = await geocodeQuery('poblado', testIndex);
    expect(result).toEqual([6.2, -75.57]);
  });

  it('encuentra coincidencias parciales', async () => {
    const result = await geocodeQuery('el poblado', testIndex);
    expect(result).toEqual([6.2, -75.57]);
  });
});

describe('geocodeQuery - coordenadas directas', () => {
  it('parsea coordenadas separadas por coma', async () => {
    const result = await geocodeQuery('6.2, -75.57', {});
    expect(result).toEqual([6.2, -75.57]);
  });

  it('parsea coordenadas separadas por espacio', async () => {
    const result = await geocodeQuery('6.2 -75.57', {});
    expect(result).toEqual([6.2, -75.57]);
  });

  it('parsea coordenadas con punto y coma', async () => {
    const result = await geocodeQuery('6.2;-75.57', {});
    expect(result).toEqual([6.2, -75.57]);
  });
});

describe('geocodeQuery - parser de direcciones colombianas', () => {
  // Mockear fetch para evitar llamadas reales a Nominatim
  global.fetch = vi.fn();

  it('parsea formato "Calle X # Y - Z" y llama Nominatim', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ lat: '6.25', lon: '-75.57' }]
    });

    const result = await geocodeQuery('Calle 105 # 39 - 38', {});
    
    expect(result).toEqual([6.25, -75.57]);
    expect(global.fetch).toHaveBeenCalled();
  });

  it('parsea formato "Calle X A # Y A - Z" con letras', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ lat: '6.26', lon: '-75.56' }]
    });

    const result = await geocodeQuery('calle 105 a # 39 a - 38', {});
    
    expect(result).toEqual([6.26, -75.56]);
    expect(global.fetch).toHaveBeenCalled();
  });

  it('parsea formato con barrio', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ lat: '6.27', lon: '-75.58' }]
    });

    const result = await geocodeQuery('Calle 10 # 50 - 20 - Laureles', {});
    
    expect(result).toEqual([6.27, -75.58]);
    expect(global.fetch).toHaveBeenCalled();
  });

  it('normaliza "Cra" a "Carrera"', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ lat: '6.24', lon: '-75.59' }]
    });

    const result = await geocodeQuery('Cra 43A # 1 - 50', {});
    
    expect(result).toEqual([6.24, -75.59]);
    expect(global.fetch).toHaveBeenCalled();
  });

  it('normaliza "Cll" a "Calle"', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ lat: '6.23', lon: '-75.60' }]
    });

    const result = await geocodeQuery('Cll 50 # 43 - 80', {});
    
    expect(result).toEqual([6.23, -75.60]);
    expect(global.fetch).toHaveBeenCalled();
  });

  it('retorna null si Nominatim no encuentra resultados', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => []
    });

    const result = await geocodeQuery('Dirección inexistente 999', {});
    expect(result).toBeNull();
  });

  it('retorna null si fetch falla', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));

    const result = await geocodeQuery('Calle 123 # 45 - 67', {});
    expect(result).toBeNull();
  });
});
