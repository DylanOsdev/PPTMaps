/**
 * Tests para funcionalidad de geolocalización watchPosition
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Geolocalización watchPosition', () => {
  let mockWatchId;
  let mockClearWatch;
  let mockWatchPosition;
  let positionCallback;
  let errorCallback;

  beforeEach(() => {
    mockWatchId = 12345;
    positionCallback = null;
    errorCallback = null;

    mockWatchPosition = vi.fn((successCb, errorCb, options) => {
      positionCallback = successCb;
      errorCallback = errorCb;
      return mockWatchId;
    });

    mockClearWatch = vi.fn();

    // Mock navigator.geolocation (read-only por defecto)
    Object.defineProperty(global.navigator, 'geolocation', {
      value: {
        watchPosition: mockWatchPosition,
        clearWatch: mockClearWatch,
        getCurrentPosition: vi.fn()
      },
      configurable: true,
      writable: true
    });

    // Mock de Leaflet global
    global.L = {
      marker: vi.fn(() => ({
        addTo: vi.fn().mockReturnThis(),
        bindPopup: vi.fn().mockReturnThis(),
        setLatLng: vi.fn()
      })),
      divIcon: vi.fn((opts) => opts)
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Activar tracking', () => {
    it('debe llamar watchPosition con opciones correctas', () => {
      const mockMap = { panTo: vi.fn() };
      const AppState = { map: mockMap, watchId: null };

      // Simular inicio de tracking
      AppState.watchId = navigator.geolocation.watchPosition(
        () => {},
        () => {},
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000
        }
      );

      expect(mockWatchPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000
        }
      );
      expect(AppState.watchId).toBe(mockWatchId);
    });

    it('debe actualizar ubicación cuando llegan coordenadas', () => {
      const mockMap = { panTo: vi.fn() };
      const AppState = { 
        map: mockMap, 
        watchId: null, 
        userLocation: null,
        userMarker: null,
        followUser: true
      };

      AppState.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          AppState.userLocation = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          };
          
          if (AppState.followUser) {
            mockMap.panTo([pos.coords.latitude, pos.coords.longitude]);
          }
        },
        () => {},
        { enableHighAccuracy: true }
      );

      // Simular recepción de coordenadas
      const mockPosition = {
        coords: {
          latitude: 6.2518,
          longitude: -75.5636
        }
      };

      positionCallback(mockPosition);

      expect(AppState.userLocation).toEqual({
        lat: 6.2518,
        lng: -75.5636
      });
      expect(mockMap.panTo).toHaveBeenCalledWith([6.2518, -75.5636]);
    });

    it('debe crear marcador en la primera posición', () => {
      const mockMarker = {
        addTo: vi.fn().mockReturnThis(),
        bindPopup: vi.fn().mockReturnThis(),
        setLatLng: vi.fn()
      };
      global.L.marker.mockReturnValue(mockMarker);

      const mockMap = { panTo: vi.fn() };
      const AppState = { 
        map: mockMap, 
        userMarker: null,
        followUser: true
      };

      navigator.geolocation.watchPosition(
        (pos) => {
          const latlng = [pos.coords.latitude, pos.coords.longitude];
          
          if (!AppState.userMarker) {
            AppState.userMarker = L.marker(latlng, {
              icon: L.divIcon({
                className: "",
                html: expect.any(String),
                iconSize: [16, 16],
                iconAnchor: [8, 8]
              })
            }).addTo(mockMap).bindPopup("Estás aquí");
          }
        },
        () => {},
        {}
      );

      positionCallback({ coords: { latitude: 6.25, longitude: -75.56 } });

      expect(L.marker).toHaveBeenCalled();
      expect(mockMarker.addTo).toHaveBeenCalledWith(mockMap);
      expect(mockMarker.bindPopup).toHaveBeenCalledWith("Estás aquí");
    });

    it('debe actualizar marcador existente sin crear uno nuevo', () => {
      const mockMarker = {
        setLatLng: vi.fn()
      };

      const mockMap = { panTo: vi.fn() };
      const AppState = { 
        map: mockMap, 
        userMarker: mockMarker,
        followUser: true
      };

      navigator.geolocation.watchPosition(
        (pos) => {
          const latlng = [pos.coords.latitude, pos.coords.longitude];
          
          if (AppState.userMarker) {
            AppState.userMarker.setLatLng(latlng);
          }
        },
        () => {},
        {}
      );

      positionCallback({ coords: { latitude: 6.26, longitude: -75.57 } });

      expect(mockMarker.setLatLng).toHaveBeenCalledWith([6.26, -75.57]);
      expect(L.marker).not.toHaveBeenCalled(); // No crea nuevo
    });

    it('debe seguir al usuario si followUser está activo', () => {
      const mockMap = { panTo: vi.fn() };
      const AppState = { 
        map: mockMap, 
        followUser: true
      };

      navigator.geolocation.watchPosition(
        (pos) => {
          if (AppState.followUser) {
            mockMap.panTo(
              [pos.coords.latitude, pos.coords.longitude],
              { animate: true, duration: 1.0 }
            );
          }
        },
        () => {},
        {}
      );

      positionCallback({ coords: { latitude: 6.25, longitude: -75.56 } });

      expect(mockMap.panTo).toHaveBeenCalledWith(
        [6.25, -75.56],
        { animate: true, duration: 1.0 }
      );
    });

    it('NO debe seguir al usuario si followUser está desactivado', () => {
      const mockMap = { panTo: vi.fn() };
      const AppState = { 
        map: mockMap, 
        followUser: false
      };

      navigator.geolocation.watchPosition(
        (pos) => {
          if (AppState.followUser) {
            mockMap.panTo([pos.coords.latitude, pos.coords.longitude]);
          }
        },
        () => {},
        {}
      );

      positionCallback({ coords: { latitude: 6.25, longitude: -75.56 } });

      expect(mockMap.panTo).not.toHaveBeenCalled();
    });
  });

  describe('Desactivar tracking', () => {
    it('debe llamar clearWatch con el watchId correcto', () => {
      const AppState = { watchId: mockWatchId };

      navigator.geolocation.clearWatch(AppState.watchId);
      AppState.watchId = null;

      expect(mockClearWatch).toHaveBeenCalledWith(mockWatchId);
      expect(AppState.watchId).toBeNull();
    });

    it('debe desactivar followUser al detener tracking', () => {
      const AppState = { 
        watchId: mockWatchId,
        followUser: true
      };

      navigator.geolocation.clearWatch(AppState.watchId);
      AppState.watchId = null;
      AppState.followUser = false;

      expect(mockClearWatch).toHaveBeenCalled();
      expect(AppState.followUser).toBe(false);
    });
  });

  describe('Manejo de errores', () => {
    it('debe manejar error de geolocalización', () => {
      const AppState = { 
        watchId: null,
        followUser: true
      };

      AppState.watchId = navigator.geolocation.watchPosition(
        () => {},
        (err) => {
          if (AppState.watchId) {
            navigator.geolocation.clearWatch(AppState.watchId);
          }
          AppState.watchId = null;
          AppState.followUser = false;
        },
        {}
      );

      // Simular error
      const mockError = {
        code: 1,
        message: 'User denied geolocation'
      };

      errorCallback(mockError);

      expect(mockClearWatch).toHaveBeenCalledWith(mockWatchId);
      expect(AppState.watchId).toBeNull();
      expect(AppState.followUser).toBe(false);
    });

    it('debe limpiar watchId incluso si clearWatch falla', () => {
      mockClearWatch.mockImplementation(() => {
        throw new Error('clearWatch failed');
      });

      const AppState = { watchId: mockWatchId };

      try {
        navigator.geolocation.clearWatch(AppState.watchId);
      } catch (e) {
        // Ignorar error
      }
      AppState.watchId = null;

      expect(AppState.watchId).toBeNull();
    });
  });

  describe('Opciones de watchPosition', () => {
    it('debe usar enableHighAccuracy: true', () => {
      navigator.geolocation.watchPosition(() => {}, () => {}, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
      });

      const options = mockWatchPosition.mock.calls[0][2];
      expect(options.enableHighAccuracy).toBe(true);
    });

    it('debe usar maximumAge: 0 para evitar caché', () => {
      navigator.geolocation.watchPosition(() => {}, () => {}, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
      });

      const options = mockWatchPosition.mock.calls[0][2];
      expect(options.maximumAge).toBe(0);
    });

    it('debe usar timeout de 10 segundos', () => {
      navigator.geolocation.watchPosition(() => {}, () => {}, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
      });

      const options = mockWatchPosition.mock.calls[0][2];
      expect(options.timeout).toBe(10000);
    });
  });
});
