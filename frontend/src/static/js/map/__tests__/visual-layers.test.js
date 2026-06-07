/**
 * Tests para features visuales de Leaflet: clustering, heatmap, polylines
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDemoLayers } from '../demo-layers.js';
import { AppState } from '../../core/state.js';

// Mock de dependencias
vi.mock('../../core/utils.js', () => ({
  escapeHtml: (text) => text
}));

describe('Features Visuales Leaflet', () => {
  let mockMap;
  let mockMarkerClusterGroup;
  let mockLayerGroup;
  let mockHeatLayer;
  let mockPolyline;

  beforeEach(() => {
    // Reset AppState
    AppState.layerGroups = {};

    // Mock de Leaflet global
    mockMarkerClusterGroup = {
      addLayer: vi.fn(),
      clearLayers: vi.fn()
    };

    mockLayerGroup = {
      addLayer: vi.fn(),
      clearLayers: vi.fn()
    };

    mockHeatLayer = {
      addTo: vi.fn()
    };

    mockPolyline = {
      bindPopup: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis()
    };

    global.L = {
      markerClusterGroup: vi.fn((options) => ({
        ...mockMarkerClusterGroup,
        options
      })),
      layerGroup: vi.fn(() => mockLayerGroup),
      heatLayer: vi.fn((points, options) => ({
        ...mockHeatLayer,
        points,
        options
      })),
      polyline: vi.fn((coords, options) => ({
        ...mockPolyline,
        coords,
        options
      })),
      marker: vi.fn(() => ({
        addTo: vi.fn().mockReturnThis(),
        bindPopup: vi.fn().mockReturnThis()
      })),
      divIcon: vi.fn((opts) => opts)
    };

    mockMap = {
      addLayer: vi.fn(),
      removeLayer: vi.fn()
    };
  });

  describe('Clustering de marcadores', () => {
    it('debe crear MarkerClusterGroup para accidentes con opciones correctas', () => {
      createDemoLayers(mockMap);

      expect(L.markerClusterGroup).toHaveBeenCalled();
      
      // Verificar que se creó el grupo de accident-clusters
      const accidentCluster = AppState.layerGroups['accident-clusters'];
      expect(accidentCluster).toBeDefined();
      expect(accidentCluster.options).toBeDefined();
    });

    it('debe configurar disableClusteringAtZoom: 16', () => {
      createDemoLayers(mockMap);

      const accidentCluster = AppState.layerGroups['accident-clusters'];
      expect(accidentCluster.options.disableClusteringAtZoom).toBe(16);
    });

    it('debe configurar maxClusterRadius: 60 para accidentes', () => {
      createDemoLayers(mockMap);

      const accidentCluster = AppState.layerGroups['accident-clusters'];
      expect(accidentCluster.options.maxClusterRadius).toBe(60);
    });

    it('debe configurar spiderfyOnMaxZoom: true', () => {
      createDemoLayers(mockMap);

      const accidentCluster = AppState.layerGroups['accident-clusters'];
      expect(accidentCluster.options.spiderfyOnMaxZoom).toBe(true);
    });

    it('debe crear MarkerClusterGroup para reportes de colisión', () => {
      createDemoLayers(mockMap);

      const collisionCluster = AppState.layerGroups['reports-collision'];
      expect(collisionCluster).toBeDefined();
      expect(collisionCluster.options.disableClusteringAtZoom).toBe(16);
      expect(collisionCluster.options.maxClusterRadius).toBe(50);
    });

    it('debe crear MarkerClusterGroup para reportes de inundación', () => {
      createDemoLayers(mockMap);

      const floodCluster = AppState.layerGroups['reports-flood'];
      expect(floodCluster).toBeDefined();
      expect(floodCluster.options.maxClusterRadius).toBe(50);
    });

    it('debe crear MarkerClusterGroup para reportes de obstáculos', () => {
      createDemoLayers(mockMap);

      const obstacleCluster = AppState.layerGroups['reports-obstacle'];
      expect(obstacleCluster).toBeDefined();
      expect(obstacleCluster.options.disableClusteringAtZoom).toBe(16);
    });

    it('debe crear 4 grupos con clustering', () => {
      createDemoLayers(mockMap);

      // accident-clusters, reports-collision, reports-flood, reports-obstacle
      const clusterCalls = L.markerClusterGroup.mock.calls;
      expect(clusterCalls.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Heatmap de predicción', () => {
    it('debe crear heatLayer con 9 puntos de predicción', () => {
      createDemoLayers(mockMap);

      expect(L.heatLayer).toHaveBeenCalled();
      
      const heatCall = L.heatLayer.mock.calls[0];
      const points = heatCall[0];
      
      expect(points).toHaveLength(9);
    });

    it('debe configurar radius: 45', () => {
      createDemoLayers(mockMap);

      const heatCall = L.heatLayer.mock.calls[0];
      const options = heatCall[1];
      
      expect(options.radius).toBe(45);
    });

    it('debe configurar blur: 35', () => {
      createDemoLayers(mockMap);

      const heatCall = L.heatLayer.mock.calls[0];
      const options = heatCall[1];
      
      expect(options.blur).toBe(35);
    });

    it('debe configurar maxZoom: 14', () => {
      createDemoLayers(mockMap);

      const heatCall = L.heatLayer.mock.calls[0];
      const options = heatCall[1];
      
      expect(options.maxZoom).toBe(14);
    });

    it('debe configurar gradiente de colores', () => {
      createDemoLayers(mockMap);

      const heatCall = L.heatLayer.mock.calls[0];
      const options = heatCall[1];
      
      expect(options.gradient).toEqual({
        0.4: 'blue',
        0.6: 'cyan',
        0.8: 'yellow',
        1.0: 'red'
      });
    });

    it('debe incluir puntos con coordenadas y valores de intensidad', () => {
      createDemoLayers(mockMap);

      const heatCall = L.heatLayer.mock.calls[0];
      const points = heatCall[0];
      
      // Verificar formato [lat, lng, intensity]
      points.forEach(point => {
        expect(point).toHaveLength(3);
        expect(typeof point[0]).toBe('number'); // lat
        expect(typeof point[1]).toBe('number'); // lng
        expect(typeof point[2]).toBe('number'); // intensity
        expect(point[2]).toBeGreaterThan(0);
        expect(point[2]).toBeLessThanOrEqual(1);
      });
    });

    it('debe agregar heatmap al grupo telemetry-predict', () => {
      createDemoLayers(mockMap);

      const predictGroup = AppState.layerGroups['telemetry-predict'];
      expect(predictGroup).toBeDefined();
      expect(predictGroup.addLayer).toHaveBeenCalled();
    });

    it('debe manejar ausencia de L.heatLayer gracefully', () => {
      // Simular que leaflet-heat no está cargado
      delete global.L.heatLayer;
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      createDemoLayers(mockMap);

      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('Leaflet.heat no está cargado')
      );
      
      consoleWarn.mockRestore();
    });
  });

  describe('Vías bloqueadas (polylines)', () => {
    beforeEach(() => {
      // Restaurar L.heatLayer para estos tests
      global.L.heatLayer = vi.fn(() => mockHeatLayer);
    });

    it('debe crear 3 vías bloqueadas', () => {
      createDemoLayers(mockMap);

      expect(L.polyline).toHaveBeenCalledTimes(3);
    });

    it('debe configurar polyline con color rojo (#ef4444)', () => {
      createDemoLayers(mockMap);

      const polylineCalls = L.polyline.mock.calls;
      
      polylineCalls.forEach(call => {
        const options = call[1];
        expect(options.color).toBe('#ef4444');
      });
    });

    it('debe configurar weight: 5', () => {
      createDemoLayers(mockMap);

      const polylineCall = L.polyline.mock.calls[0];
      const options = polylineCall[1];
      
      expect(options.weight).toBe(5);
    });

    it('debe configurar opacity: 0.85', () => {
      createDemoLayers(mockMap);

      const polylineCall = L.polyline.mock.calls[0];
      const options = polylineCall[1];
      
      expect(options.opacity).toBe(0.85);
    });

    it('debe configurar dashArray "12 8" (línea punteada)', () => {
      createDemoLayers(mockMap);

      const polylineCall = L.polyline.mock.calls[0];
      const options = polylineCall[1];
      
      expect(options.dashArray).toBe('12 8');
    });

    it('debe configurar lineCap "round"', () => {
      createDemoLayers(mockMap);

      const polylineCall = L.polyline.mock.calls[0];
      const options = polylineCall[1];
      
      expect(options.lineCap).toBe('round');
    });

    it('debe crear polyline para Autopista Sur', () => {
      createDemoLayers(mockMap);

      const polylineCalls = L.polyline.mock.calls;
      const autopistaSur = polylineCalls.find(call => 
        call[0].length === 4 // Autopista Sur tiene 4 coordenadas
      );
      
      expect(autopistaSur).toBeDefined();
      expect(autopistaSur[0]).toHaveLength(4);
    });

    it('debe crear polyline para Calle 10', () => {
      createDemoLayers(mockMap);

      const polylineCalls = L.polyline.mock.calls;
      const calle10 = polylineCalls.find(call => 
        call[0].length === 3 && call[0][0][0] === 6.2518
      );
      
      expect(calle10).toBeDefined();
    });

    it('debe crear polyline para Av. Oriental', () => {
      createDemoLayers(mockMap);

      const polylineCalls = L.polyline.mock.calls;
      const avOriental = polylineCalls.find(call => 
        call[0].length === 3 && call[0][0][1] === -75.5636
      );
      
      expect(avOriental).toBeDefined();
    });

    it('debe bindPopup en cada polyline', () => {
      createDemoLayers(mockMap);

      expect(mockPolyline.bindPopup).toHaveBeenCalledTimes(3);
    });

    it('debe incluir título "Vía bloqueada" en popup', () => {
      createDemoLayers(mockMap);

      const popupCalls = mockPolyline.bindPopup.mock.calls;
      
      popupCalls.forEach(call => {
        const popupContent = call[0];
        expect(popupContent).toContain('Vía bloqueada');
      });
    });

    it('debe incluir nombre de la vía en popup', () => {
      createDemoLayers(mockMap);

      const popupCalls = mockPolyline.bindPopup.mock.calls;
      
      // Verificar que al menos un popup contenga info de las vías
      const allPopups = popupCalls.map(call => call[0]).join(' ');
      expect(allPopups).toContain('Autopista Sur');
      expect(allPopups).toContain('Calle 10');
      expect(allPopups).toContain('Av. Oriental');
    });

    it('debe agregar polylines al grupo blocked-roads', () => {
      createDemoLayers(mockMap);

      const blockedGroup = AppState.layerGroups['blocked-roads'];
      expect(blockedGroup).toBeDefined();
      // Al menos 3 polylines (puede tener más si se agregan otras capas)
      expect(blockedGroup.addLayer.mock.calls.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Integración de capas', () => {
    it('debe crear todos los grupos de capas necesarios', () => {
      createDemoLayers(mockMap);

      const expectedGroups = [
        'safe-route',
        'blocked-roads',
        'accident-clusters',
        'fatalities-layer',
        'flood-zones',
        'telemetry-gps',
        'reports-collision',
        'telemetry-predict',
        'rain-risk',
        'weather-alerts',
        'reports-flood',
        'reports-obstacle'
      ];

      expectedGroups.forEach(group => {
        expect(AppState.layerGroups[group]).toBeDefined();
      });
    });

    it('debe crear combinación de layerGroup y markerClusterGroup', () => {
      createDemoLayers(mockMap);

      expect(L.layerGroup).toHaveBeenCalled();
      expect(L.markerClusterGroup).toHaveBeenCalled();
    });
  });
});
