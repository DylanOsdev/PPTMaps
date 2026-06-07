import { describe, it, expect, beforeEach } from 'vitest';
import { AppState } from '../static/js/core/state';

describe('core/state.js - AppState', () => {
  beforeEach(() => {
    // Reset AppState a su estado inicial
    AppState.map = null;
    AppState.layerGroups = {};
    AppState.comunasData = null;
    AppState.alertFilter = 'all';
    AppState.activeComuna = null;
    AppState.wsConnected = false;
    AppState.userLocation = null;
    AppState.userMarker = null;
    AppState.watchId = null;
    AppState.followUser = false;
  });

  it('debe tener map inicializado en null', () => {
    expect(AppState.map).toBe(null);
  });

  it('debe tener layerGroups como objeto vacío', () => {
    expect(AppState.layerGroups).toEqual({});
  });

  it('debe tener comunasData en null', () => {
    expect(AppState.comunasData).toBe(null);
  });

  it('debe tener startTime como timestamp', () => {
    expect(typeof AppState.startTime).toBe('number');
    expect(AppState.startTime).toBeGreaterThan(0);
  });

  it('debe tener alertFilter como "all" por defecto', () => {
    expect(AppState.alertFilter).toBe('all');
  });

  it('debe tener activeComuna en null', () => {
    expect(AppState.activeComuna).toBe(null);
  });

  it('debe tener wsConnected en false', () => {
    expect(AppState.wsConnected).toBe(false);
  });

  it('debe tener userLocation en null', () => {
    expect(AppState.userLocation).toBe(null);
  });

  it('debe tener userMarker en null', () => {
    expect(AppState.userMarker).toBe(null);
  });

  it('debe tener watchId en null', () => {
    expect(AppState.watchId).toBe(null);
  });

  it('debe tener followUser en false', () => {
    expect(AppState.followUser).toBe(false);
  });

  it('debe permitir asignar map', () => {
    const mockMap = { center: [6.2518, -75.5636] };
    AppState.map = mockMap;
    expect(AppState.map).toBe(mockMap);
  });

  it('debe permitir agregar layerGroups', () => {
    AppState.layerGroups['accidents'] = { name: 'Accidentes' };
    expect(AppState.layerGroups['accidents']).toEqual({ name: 'Accidentes' });
  });

  it('debe permitir asignar comunasData', () => {
    const mockData = { comunas: [] };
    AppState.comunasData = mockData;
    expect(AppState.comunasData).toBe(mockData);
  });

  it('debe permitir cambiar alertFilter', () => {
    AppState.alertFilter = 'traffic';
    expect(AppState.alertFilter).toBe('traffic');
  });

  it('debe permitir asignar activeComuna', () => {
    AppState.activeComuna = 'LAURELES';
    expect(AppState.activeComuna).toBe('LAURELES');
  });

  it('debe permitir cambiar wsConnected', () => {
    AppState.wsConnected = true;
    expect(AppState.wsConnected).toBe(true);
  });

  it('debe permitir asignar userLocation', () => {
    AppState.userLocation = { lat: 6.2518, lng: -75.5636 };
    expect(AppState.userLocation).toEqual({ lat: 6.2518, lng: -75.5636 });
  });

  it('debe permitir cambiar followUser', () => {
    AppState.followUser = true;
    expect(AppState.followUser).toBe(true);
  });
});
