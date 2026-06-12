import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initSearch } from '../static/js/ui/search.js';
import { AppState } from '../static/js/core/state.js';
import * as geocodeModule from '../static/js/services/geocode.js';
import * as apiModule from '../static/js/services/api.js';

describe('search.js - Búsqueda con geocoder y routing', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = `
      <input id="wazeSearch" />
      <input id="geoQuery" />
      <input id="cmdSearch" />
      <button id="btnScan"></button>
      <div id="scanFeedback"></div>
    `;

    // Reset AppState
    AppState.comunasData = [
      { name: 'Belén', lat: 6.2442, lng: -75.5812 },
      { name: 'Poblado', lat: 6.2088, lng: -75.5673 },
    ];
    AppState.map = {
      flyTo: vi.fn(),
      removeLayer: vi.fn(),
      hasLayer: vi.fn(() => false),
      addLayer: vi.fn(),
      fitBounds: vi.fn(),
    };
    AppState.layerGroups = {};
    AppState.userLocation = null;

    // Mock Leaflet global
    global.L = {
      popup: () => ({
        setLatLng: vi.fn().mockReturnThis(),
        setContent: vi.fn().mockReturnThis(),
        openOn: vi.fn().mockReturnThis(),
      }),
      polyline: vi.fn(() => ({
        getBounds: vi.fn(() => 'mockBounds'),
        addTo: vi.fn(),
      })),
    };

    vi.clearAllMocks();
  });

  it('debe integrar geocoder correctamente y volar al resultado', async () => {
    // Mock geocodeQuery para retornar coordenadas de "Belén"
    vi.spyOn(geocodeModule, 'buildGeocodeIndex').mockReturnValue('mockIndex');
    vi.spyOn(geocodeModule, 'geocodeQuery').mockResolvedValue([6.2442, -75.5812]);
    vi.spyOn(apiModule, 'fetchRoute').mockResolvedValue({ coordinates: [] });

    initSearch();

    document.getElementById('wazeSearch').value = 'Belén';
    document.getElementById('btnScan').click();

    // Esperar a que se resuelva geocodeQuery
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(geocodeModule.geocodeQuery).toHaveBeenCalledWith('Belén', 'mockIndex');
    expect(AppState.map.flyTo).toHaveBeenCalledWith([6.2442, -75.5812], 14, { duration: 1.2 });
  });

  it('debe hacer routing con origen GPS cuando userLocation está disponible', async () => {
    vi.spyOn(geocodeModule, 'buildGeocodeIndex').mockReturnValue('mockIndex');
    vi.spyOn(geocodeModule, 'geocodeQuery').mockResolvedValue([6.2088, -75.5673]); // Poblado
    vi.spyOn(apiModule, 'fetchRoute').mockResolvedValue({
      coordinates: [
        [6.2442, -75.5812],
        [6.2265, -75.5742],
        [6.2088, -75.5673],
      ],
    });

    // Simular ubicación GPS del usuario
    AppState.userLocation = { lat: 6.2442, lng: -75.5812 };

    initSearch();

    document.getElementById('geoQuery').value = 'Poblado';
    document.getElementById('btnScan').click();

    await new Promise(resolve => setTimeout(resolve, 50));

    // Verificar que fetchRoute se llamó con origen = userLocation
    expect(apiModule.fetchRoute).toHaveBeenCalledWith(
      '6.2088,-75.5673', // destino
      '6.2442,-75.5812'  // origen GPS
    );

    // Verificar que se dibujó la ruta
    expect(global.L.polyline).toHaveBeenCalledWith(
      [[6.2442, -75.5812], [6.2265, -75.5742], [6.2088, -75.5673]],
      { color: '#4ade80', weight: 5 }
    );
  });

  it('debe manejar resultados no encontrados mostrando feedback', async () => {
    vi.spyOn(geocodeModule, 'buildGeocodeIndex').mockReturnValue('mockIndex');
    vi.spyOn(geocodeModule, 'geocodeQuery').mockResolvedValue(null); // No encontrado

    initSearch();

    document.getElementById('cmdSearch').value = 'XYZ123InvalidQuery';
    document.getElementById('btnScan').click();

    await new Promise(resolve => setTimeout(resolve, 50));

    const feedback = document.getElementById('scanFeedback');
    expect(feedback.style.display).toBe('block');
    expect(feedback.textContent).toContain('No encontrado');
  });

  it('debe redirigir al mapa cuando se presiona Enter en geoQuery', async () => {
    vi.spyOn(geocodeModule, 'buildGeocodeIndex').mockReturnValue('mockIndex');
    vi.spyOn(geocodeModule, 'geocodeQuery').mockResolvedValue([6.2442, -75.5812]);
    vi.spyOn(apiModule, 'fetchRoute').mockResolvedValue({ coordinates: [] });

    initSearch();

    const input = document.getElementById('geoQuery');
    input.value = 'Belén';

    // Simular Enter
    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    input.dispatchEvent(event);

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(AppState.map.flyTo).toHaveBeenCalledWith([6.2442, -75.5812], 14, { duration: 1.2 });
  });
});
