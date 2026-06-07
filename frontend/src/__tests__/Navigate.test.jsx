import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import Navigate from '../pages/Navigate';

describe('Navigate.jsx - Navegación Móvil', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debe renderizar el título TPPMAPS en la status bar', () => {
    render(
      <MemoryRouter>
        <Navigate />
      </MemoryRouter>
    );
    expect(screen.getByText('TPPMAPS')).toBeInTheDocument();
  });

  it('debe renderizar el link a vista comando', () => {
    render(
      <MemoryRouter>
        <Navigate />
      </MemoryRouter>
    );
    expect(screen.getByText('← Vista comando tppmaps')).toBeInTheDocument();
  });

  it('debe renderizar el reloj que actualiza cada segundo', () => {
    render(
      <MemoryRouter>
        <Navigate />
      </MemoryRouter>
    );
    // El reloj debe mostrar formato HH:MM
    expect(screen.getByText(/\d{2}:\d{2}/)).toBeInTheDocument();
  });

  it('debe renderizar indicador de batería', () => {
    render(
      <MemoryRouter>
        <Navigate />
      </MemoryRouter>
    );
    expect(screen.getByText('98%')).toBeInTheDocument();
  });

  it('debe renderizar voz activa en sub-bar', () => {
    render(
      <MemoryRouter>
        <Navigate />
      </MemoryRouter>
    );
    expect(screen.getByText('🔊 Voz Activa')).toBeInTheDocument();
  });

  it('debe renderizar tiempo estimado de llegada', () => {
    render(
      <MemoryRouter>
        <Navigate />
      </MemoryRouter>
    );
    expect(screen.getByText('🕐 18 min')).toBeInTheDocument();
  });

  it('debe renderizar alerta de recálculo de ruta', () => {
    render(
      <MemoryRouter>
        <Navigate />
      </MemoryRouter>
    );
    expect(screen.getByText('⚠ Recalculando ruta segura…')).toBeInTheDocument();
  });

  it('debe renderizar título de ruta segura', () => {
    render(
      <MemoryRouter>
        <Navigate />
      </MemoryRouter>
    );
    expect(screen.getByText('🛡 RUTA SEGURA MOVIMED')).toBeInTheDocument();
  });

  it('debe renderizar destino (Belén)', () => {
    render(
      <MemoryRouter>
        <Navigate />
      </MemoryRouter>
    );
    expect(screen.getByText('Belén')).toBeInTheDocument();
    expect(screen.getByText('Destino')).toBeInTheDocument();
  });

  it('debe renderizar riesgo de lluvia 0%', () => {
    render(
      <MemoryRouter>
        <Navigate />
      </MemoryRouter>
    );
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('Riesgo lluvia')).toBeInTheDocument();
  });

  it('debe renderizar puntos evitados (3)', () => {
    render(
      <MemoryRouter>
        <Navigate />
      </MemoryRouter>
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Puntos evitados')).toBeInTheDocument();
  });

  it('debe renderizar navegación inferior con 3 links', () => {
    render(
      <MemoryRouter>
        <Navigate />
      </MemoryRouter>
    );
    expect(screen.getByText('📍 Inicio')).toBeInTheDocument();
    expect(screen.getByText('🧭 Navegar')).toBeInTheDocument();
    expect(screen.getByText('⚠ Reportar')).toBeInTheDocument();
  });

  it('debe marcar "Navegar" como activo', () => {
    render(
      <MemoryRouter>
        <Navigate />
      </MemoryRouter>
    );
    const navigateLink = screen.getByText('🧭 Navegar').closest('a');
    expect(navigateLink).toHaveClass('active');
  });

  it('debe renderizar placeholder del mapa', () => {
    const { container } = render(
      <MemoryRouter>
        <Navigate />
      </MemoryRouter>
    );
    expect(container.querySelector('.map-placeholder')).toBeInTheDocument();
  });

  it('debe renderizar línea de ruta en el mapa', () => {
    const { container } = render(
      <MemoryRouter>
        <Navigate />
      </MemoryRouter>
    );
    expect(container.querySelector('.route-line')).toBeInTheDocument();
  });
});
