/**
 * Tests para el módulo de alertas
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initAlerts } from '../alerts.js';
import { AppState } from '../../core/state.js';
import * as api from '../../services/api.js';

vi.mock('../../core/utils.js', () => ({
  escapeHtml: (text) => text
}));

vi.mock('../../icons/react-icons.js', () => ({
  getAlertIconSvg: (type) => `<svg>${type}</svg>`
}));

vi.mock('../../services/api.js', () => ({
  fetchAlerts: vi.fn()
}));

function setupAlertsDOM() {
  document.body.innerHTML = `
    <div id="alertsFeed"></div>
    <div id="alertCount">0</div>
    <div id="statAlerts">0</div>
    <div class="alert-tabs">
      <button class="tab active" data-filter="all">Todas</button>
      <button class="tab" data-filter="siata">SIATA</button>
      <button class="tab" data-filter="reports">Reportes</button>
      <button class="tab" data-filter="traffic">Tráfico</button>
    </div>
  `;
}

const MOCK_ALERTS = [
  { id: 1, type: 'siata', message: 'SIATA 1', created_at: '10:00', source: 'SIATA' },
  { id: 2, type: 'report', message: 'Reporte 1', created_at: '11:00', source: 'Ciudadano' },
  { id: 3, type: 'traffic', message: 'Tráfico 1', created_at: '12:00', source: 'Sistema' },
  { id: 4, type: 'siata', message: 'SIATA 2', created_at: '13:00', source: 'SIATA' },
];

describe('Alerts Module', () => {
  let alertsFeed;
  let alertCount;
  let statAlerts;
  let alertTabs;

  beforeEach(() => {
    setupAlertsDOM();

    alertsFeed = document.getElementById('alertsFeed');
    alertCount = document.getElementById('alertCount');
    statAlerts = document.getElementById('statAlerts');
    alertTabs = document.querySelectorAll('.alert-tabs .tab');

    vi.clearAllMocks();
    AppState.alertFilter = 'all';
    AppState._alertPollTimer = null;
  });

  afterEach(() => {
    if (AppState._alertPollTimer) {
      clearInterval(AppState._alertPollTimer);
    }
  });

  describe('Inicialización', () => {
    it('debe cargar alertas iniciales desde REST API', async () => {
      api.fetchAlerts.mockResolvedValue(MOCK_ALERTS);

      await initAlerts();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(api.fetchAlerts).toHaveBeenCalled();
      expect(alertsFeed.children.length).toBe(4);
      expect(alertCount.textContent).toBe('4');
    });

    it('debe continuar si REST API falla', async () => {
      api.fetchAlerts.mockRejectedValue(new Error('API down'));

      expect(() => initAlerts()).not.toThrow();
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('debe iniciar polling cada 30s', async () => {
      vi.useFakeTimers();

      await initAlerts();

      expect(api.fetchAlerts).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(30000);
      expect(api.fetchAlerts).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(30000);
      expect(api.fetchAlerts).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });
  });

  describe('Filtrado de alertas', () => {
    beforeEach(async () => {
      api.fetchAlerts.mockResolvedValue(MOCK_ALERTS);
      await initAlerts();
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it('debe mostrar todas las alertas por defecto', () => {
      expect(alertsFeed.children.length).toBe(4);
    });

    it('debe filtrar solo alertas SIATA', () => {
      alertTabs[1].click();

      expect(alertsFeed.children.length).toBe(2);
      expect(alertsFeed.innerHTML).toContain('SIATA 1');
      expect(alertsFeed.innerHTML).toContain('SIATA 2');
      expect(alertsFeed.innerHTML).not.toContain('Reporte 1');
    });

    it('debe filtrar solo reportes ciudadanos', () => {
      alertTabs[2].click();

      expect(alertsFeed.children.length).toBe(1);
      expect(alertsFeed.innerHTML).toContain('Reporte 1');
    });

    it('debe filtrar solo tráfico', () => {
      alertTabs[3].click();

      expect(alertsFeed.children.length).toBe(1);
      expect(alertsFeed.innerHTML).toContain('Tráfico 1');
    });

    it('debe actualizar clase active del tab', () => {
      alertTabs[2].click();

      expect(alertTabs[2].classList.contains('active')).toBe(true);
      expect(alertTabs[0].classList.contains('active')).toBe(false);
    });
  });

  describe('Renderizado de alertas', () => {
    it('debe renderizar estructura HTML correcta', async () => {
      api.fetchAlerts.mockResolvedValue([
        { id: 1, type: 'report', message: 'Test message', created_at: '14:30', source: 'Ciudadano' },
      ]);
      await initAlerts();
      await new Promise(resolve => setTimeout(resolve, 10));

      const card = alertsFeed.querySelector('.alert-card');
      expect(card).toBeTruthy();
      expect(card.querySelector('.alert-icon')).toBeTruthy();
      expect(card.querySelector('.alert-meta')).toBeTruthy();
      expect(card.querySelector('.alert-text')).toBeTruthy();
    });

    it('debe usar valores por defecto si faltan campos', async () => {
      api.fetchAlerts.mockResolvedValue([{ id: 1 }]);
      await initAlerts();
      await new Promise(resolve => setTimeout(resolve, 10));

      const card = alertsFeed.querySelector('.alert-card');
      expect(card.innerHTML).toContain('Sistema');
      expect(card.innerHTML).toContain('Evento');
    });

    it('debe actualizar contador en dos lugares', async () => {
      api.fetchAlerts.mockResolvedValue([
        { id: 1, message: 'Test 1' },
        { id: 2, message: 'Test 2' },
        { id: 3, message: 'Test 3' },
      ]);
      await initAlerts();
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(alertCount.textContent).toBe('3');
      expect(statAlerts.textContent).toBe('3');
    });
  });
});
