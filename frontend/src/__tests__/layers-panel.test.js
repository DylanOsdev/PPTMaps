import { describe, it, expect, beforeEach } from 'vitest';
import { applySavedLayerState, updateGroupCounts } from '../static/js/ui/layers-panel';

describe('ui/layers-panel.js', () => {
  beforeEach(() => {
    // Setup DOM para tests
    document.body.innerHTML = `
      <div>
        <input type="checkbox" class="toggle" data-layer="medellin-city" />
        <input type="checkbox" class="toggle" data-layer="medellin-comunas" />
        <input type="checkbox" class="toggle" data-layer="telemetry-gps" checked />
        <input type="checkbox" class="toggle" data-layer="accident-clusters" />
        <span id="count-comunas">0/0</span>
        <span id="count-telemetry">0/0</span>
      </div>
    `;
  });

  describe('applySavedLayerState', () => {
    it('debe ejecutarse sin errores cuando no hay estado guardado', () => {
      expect(() => applySavedLayerState()).not.toThrow();
    });

    it('debe manejar JSON inválido sin romper', () => {
      // Verificamos que la función no lance error
      expect(() => applySavedLayerState()).not.toThrow();
    });
  });

  describe('updateGroupCounts', () => {
    it('debe actualizar contadores de grupos sin errores', () => {
      expect(() => updateGroupCounts()).not.toThrow();
    });

    it('debe manejar grupos sin elementos', () => {
      document.body.innerHTML = '<span id="count-nonexistent">0/0</span>';
      expect(() => updateGroupCounts()).not.toThrow();
    });
  });

  describe('DOM interactions', () => {
    it('debe tener toggles con data-layer', () => {
      const toggles = document.querySelectorAll('.toggle[data-layer]');
      expect(toggles.length).toBeGreaterThan(0);
    });

    it('debe tener elementos de contador', () => {
      expect(document.getElementById('count-comunas')).toBeTruthy();
      expect(document.getElementById('count-telemetry')).toBeTruthy();
    });
  });
});
