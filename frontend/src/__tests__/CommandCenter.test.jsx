import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import CommandCenter from '../pages/CommandCenter.jsx';
import { AppState } from '../static/js/core/state.js';

// Mock todos los módulos de mapa e inicialización
vi.mock('../static/js/map/map-service.js', () => ({
  initMap: vi.fn(),
  setupMapLayers: vi.fn(async () => ({ isInsideCity: vi.fn(() => true) })),
  updateMapStats: vi.fn(),
  stopFatalitiesPolling: vi.fn(),
  stopReportsPolling: vi.fn(),
}));

vi.mock('../static/js/services/api.js', () => ({
  pingHealth: vi.fn(async () => true),
  connectWebSocket: vi.fn(),
  disconnectWebSocket: vi.fn(),
  onWsEvent: vi.fn(),
  offWsEvent: vi.fn(),
}));

vi.mock('../static/js/ui/alerts.js', () => ({ initAlerts: vi.fn() }));
vi.mock('../static/js/ui/clock.js', () => ({
  initClock: vi.fn(),
  initTicker: vi.fn(),
  initThroughput: vi.fn(),
}));
vi.mock('../static/js/ui/layers-panel.js', () => ({
  applySavedLayerState: vi.fn(),
  initLayersPanel: vi.fn(),
}));
vi.mock('../static/js/ui/responsive.js', () => ({ initResponsive: vi.fn() }));
vi.mock('../static/js/ui/search.js', () => ({ initSearch: vi.fn() }));

describe('CommandCenter.jsx - Redirección con searchParams', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset AppState y DOM
    document.body.innerHTML = '<div id="map"></div>';
    AppState.map = {
      flyTo: vi.fn(),
      off: vi.fn(),
      remove: vi.fn(),
    };
    AppState.layerGroups = {};
    AppState.comunasData = [{ name: 'Test', lat: 6.24, lng: -75.58 }];

    // Mock Leaflet global
    global.L = {
      popup: () => ({
        setLatLng: vi.fn().mockReturnThis(),
        setContent: vi.fn().mockReturnThis(),
        openOn: vi.fn().mockReturnThis(),
        className: 'popup-dark',
      }),
    };
  });

  it('debe leer searchParams (lat, lng, zoom) y hacer flyTo', async () => {
    render(
      <MemoryRouter initialEntries={['/map?lat=6.2518&lng=-75.5696&zoom=16']}>
        <CommandCenter />
      </MemoryRouter>
    );

    // Esperar a que se complete el boot asíncrono
    await waitFor(() => {
      expect(AppState.map.flyTo).toHaveBeenCalledWith(
        [6.2518, -75.5696],
        16,
        { duration: 1.5 }
      );
    }, { timeout: 2000 });
  });

  it('debe abrir popup automáticamente en las coordenadas de URL', async () => {
    const mockPopup = {
      setLatLng: vi.fn().mockReturnThis(),
      setContent: vi.fn().mockReturnThis(),
      openOn: vi.fn().mockReturnThis(),
    };

    global.L.popup = vi.fn(() => mockPopup);

    render(
      <MemoryRouter initialEntries={['/map?lat=6.1698&lng=-75.5821']}>
        <CommandCenter />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockPopup.setLatLng).toHaveBeenCalledWith([6.1698, -75.5821]);
      expect(mockPopup.setContent).toHaveBeenCalled();
      expect(mockPopup.openOn).toHaveBeenCalledWith(AppState.map);
    }, { timeout: 2000 });
  });

  it('debe usar zoom por defecto de 16 si no se especifica en URL', async () => {
    render(
      <MemoryRouter initialEntries={['/map?lat=6.2442&lng=-75.5812']}>
        <CommandCenter />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(AppState.map.flyTo).toHaveBeenCalledWith(
        [6.2442, -75.5812],
        16, // zoom por defecto
        { duration: 1.5 }
      );
    }, { timeout: 2000 });
  });
});
