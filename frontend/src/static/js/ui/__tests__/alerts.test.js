/**
 * Tests para el módulo de alertas en tiempo real (WebSocket)
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initAlerts, __resetForTesting } from '../alerts.js';
import { AppState } from '../../core/state.js';
import * as api from '../../services/api.js';

// Mock de dependencias
vi.mock('../../core/utils.js', () => ({
  escapeHtml: (text) => text
}));

vi.mock('../../icons/react-icons.js', () => ({
  getAlertIconSvg: (type) => `<svg>${type}</svg>`
}));

vi.mock('../../services/api.js', () => ({
  onWsEvent: vi.fn(),
  fetchAlerts: vi.fn()
}));

describe('Alerts WebSocket Listener', () => {
  let alertsFeed;
  let alertCount;
  let statAlerts;
  let alertTabs;

  beforeEach(() => {
    // Setup DOM
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

    alertsFeed = document.getElementById('alertsFeed');
    alertCount = document.getElementById('alertCount');
    statAlerts = document.getElementById('statAlerts');
    alertTabs = document.querySelectorAll('.alert-tabs .tab');

    // Reset mocks
    vi.clearAllMocks();
    AppState.alertFilter = 'all';
    AppState._alertPollTimer = null;
    AppState._alertsWsHandler = null;

    // Mock fetchAlerts por defecto
    api.fetchAlerts.mockResolvedValue([]);
  });

  afterEach(() => {
    if (AppState._alertPollTimer) {
      clearInterval(AppState._alertPollTimer);
    }
  });

  describe('Inicialización', () => {
    it('debe registrar listener en WebSocket para "alerts"', async () => {
      await initAlerts();
      
      expect(api.onWsEvent).toHaveBeenCalledWith('alerts', expect.any(Function));
    });

    it('debe cargar alertas iniciales desde REST API', async () => {
      const mockAlerts = [
        { id: 1, type: 'traffic', message: 'Congestión Av. Oriental' },
        { id: 2, type: 'siata', message: 'Nivel alto Río Medellín' }
      ];
      api.fetchAlerts.mockResolvedValue(mockAlerts);

      await initAlerts();
      
      // Esperar un tick para que se resuelva la promesa
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(api.fetchAlerts).toHaveBeenCalled();
      expect(alertsFeed.children.length).toBe(2);
      expect(alertCount.textContent).toBe('2');
    });

    it('debe continuar si REST API falla', async () => {
      api.fetchAlerts.mockRejectedValue(new Error('API down'));

      initAlerts(); // No lanza error
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(api.onWsEvent).toHaveBeenCalled(); // WS sigue funcionando
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

  describe('Recepción de alertas vía WebSocket', () => {
    let wsHandler;

    beforeEach(async () => {
      api.fetchAlerts.mockResolvedValue([]); // Vacío para tests
      await initAlerts();
      await new Promise(resolve => setTimeout(resolve, 10));
      wsHandler = api.onWsEvent.mock.calls[0][1]; // Capturar el handler registrado
      
      // Limpiar alertas usando función de testing
      __resetForTesting();
    });

    it('debe agregar alerta individual al feed', () => {
      const newAlert = {
        id: 100,
        type: 'report',
        message: 'Accidente Calle 10',
        created_at: '14:00'
      };

      wsHandler(newAlert);

      expect(alertsFeed.children.length).toBe(1);
      expect(alertsFeed.innerHTML).toContain('Accidente Calle 10');
      expect(alertCount.textContent).toBe('1');
    });

    it('debe reemplazar todas las alertas si llega array', async () => {
      // Primero agregar algunas alertas
      wsHandler({ id: 1, type: 'traffic', message: 'Alerta 1' });
      wsHandler({ id: 2, type: 'traffic', message: 'Alerta 2' });
      expect(alertsFeed.children.length).toBe(2);

      // Ahora reemplazar con un array nuevo
      const newAlerts = [
        { id: 10, type: 'siata', message: 'Nueva 1' },
        { id: 11, type: 'siata', message: 'Nueva 2' },
        { id: 12, type: 'siata', message: 'Nueva 3' }
      ];
      
      wsHandler(newAlerts);

      expect(alertsFeed.children.length).toBe(3);
      expect(alertsFeed.innerHTML).toContain('Nueva 1');
      expect(alertsFeed.innerHTML).not.toContain('Alerta 1');
    });

    it('debe agregar alerta individual si ya hay alertas (array de 1)', () => {
      // Agregar alerta inicial
      wsHandler({ id: 1, type: 'traffic', message: 'Alerta inicial' });
      expect(alertsFeed.children.length).toBe(1);

      // Llega array con 1 alerta (broadcast individual)
      wsHandler([{ id: 2, type: 'report', message: 'Alerta broadcast' }]);

      expect(alertsFeed.children.length).toBe(2);
      expect(alertsFeed.innerHTML).toContain('Alerta inicial');
      expect(alertsFeed.innerHTML).toContain('Alerta broadcast');
    });

    it('no debe duplicar alertas con mismo id', () => {
      const alert = { id: 100, type: 'traffic', message: 'Duplicada' };

      wsHandler(alert);
      wsHandler(alert); // Intento duplicar
      wsHandler(alert); // Intento otra vez

      expect(alertsFeed.children.length).toBe(1);
    });

    it('no debe duplicar alertas con mismo texto y hora', () => {
      const alert1 = { id: 100, type: 'traffic', text: 'Texto igual', time: '14:00' };
      const alert2 = { id: 101, type: 'traffic', text: 'Texto igual', time: '14:00' };

      wsHandler(alert1);
      wsHandler(alert2); // Mismo texto y hora → no duplica

      expect(alertsFeed.children.length).toBe(1);
    });

    it('debe limitar a 50 alertas máximo', () => {
      // Agregar 60 alertas
      for (let i = 0; i < 60; i++) {
        wsHandler({ id: i, type: 'traffic', message: `Alerta ${i}` });
      }

      expect(alertsFeed.children.length).toBe(50);
      expect(alertCount.textContent).toBe('50');
    });

    it('debe agregar alertas más recientes al inicio', () => {
      wsHandler({ id: 1, type: 'traffic', message: 'Primera' });
      wsHandler({ id: 2, type: 'traffic', message: 'Segunda' });
      wsHandler({ id: 3, type: 'traffic', message: 'Tercera' });

      const items = alertsFeed.querySelectorAll('.alert-card');
      expect(items[0].innerHTML).toContain('Tercera'); // Más reciente primero
      expect(items[2].innerHTML).toContain('Primera'); // Más vieja al final
    });
  });

  describe('Filtrado de alertas', () => {
    let wsHandler;

    beforeEach(async () => {
      api.fetchAlerts.mockResolvedValue([]);
      await initAlerts();
      await new Promise(resolve => setTimeout(resolve, 10));
      wsHandler = api.onWsEvent.mock.calls[0][1];
      
      __resetForTesting();

      // Agregar alertas de diferentes tipos
      wsHandler({ id: 1, type: 'siata', message: 'SIATA 1' });
      wsHandler({ id: 2, type: 'report', message: 'Reporte 1' });
      wsHandler({ id: 3, type: 'traffic', message: 'Tráfico 1' });
      wsHandler({ id: 4, type: 'siata', message: 'SIATA 2' });
    });

    it('debe mostrar todas las alertas por defecto', () => {
      expect(alertsFeed.children.length).toBe(4);
    });

    it('debe filtrar solo alertas SIATA', () => {
      const siataTab = alertTabs[1]; // data-filter="siata"
      siataTab.click();

      expect(alertsFeed.children.length).toBe(2);
      expect(alertsFeed.innerHTML).toContain('SIATA 1');
      expect(alertsFeed.innerHTML).toContain('SIATA 2');
      expect(alertsFeed.innerHTML).not.toContain('Reporte 1');
    });

    it('debe filtrar solo reportes ciudadanos', () => {
      const reportsTab = alertTabs[2]; // data-filter="reports"
      reportsTab.click();

      expect(alertsFeed.children.length).toBe(1);
      expect(alertsFeed.innerHTML).toContain('Reporte 1');
    });

    it('debe filtrar solo tráfico', () => {
      const trafficTab = alertTabs[3]; // data-filter="traffic"
      trafficTab.click();

      expect(alertsFeed.children.length).toBe(1);
      expect(alertsFeed.innerHTML).toContain('Tráfico 1');
    });

    it('debe actualizar clase active del tab', () => {
      const reportsTab = alertTabs[2];
      
      reportsTab.click();

      expect(reportsTab.classList.contains('active')).toBe(true);
      expect(alertTabs[0].classList.contains('active')).toBe(false);
    });
  });

  describe('Renderizado de alertas', () => {
    let wsHandler;

    beforeEach(async () => {
      api.fetchAlerts.mockResolvedValue([]);
      await initAlerts();
      await new Promise(resolve => setTimeout(resolve, 10));
      wsHandler = api.onWsEvent.mock.calls[0][1];
      
      __resetForTesting();
    });

    it('debe renderizar estructura HTML correcta', () => {
      wsHandler({
        id: 1,
        type: 'report',
        message: 'Test message',
        created_at: '14:30',
        source: 'Ciudadano'
      });

      const card = alertsFeed.querySelector('.alert-card');
      expect(card).toBeTruthy();
      expect(card.querySelector('.alert-icon')).toBeTruthy();
      expect(card.querySelector('.alert-meta')).toBeTruthy();
      expect(card.querySelector('.alert-text')).toBeTruthy();
    });

    it('debe usar valores por defecto si faltan campos', () => {
      wsHandler({ id: 1 }); // Alerta mínima

      const card = alertsFeed.querySelector('.alert-card');
      expect(card.innerHTML).toContain('Sistema'); // source por defecto
      expect(card.innerHTML).toContain('Evento'); // text por defecto
    });

    it('debe actualizar contador en dos lugares', () => {
      wsHandler({ id: 1, message: 'Test 1' });
      wsHandler({ id: 2, message: 'Test 2' });
      wsHandler({ id: 3, message: 'Test 3' });

      expect(alertCount.textContent).toBe('3');
      expect(statAlerts.textContent).toBe('3');
    });
  });
});
