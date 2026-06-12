import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import Report from '../pages/Report.jsx';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Report.jsx - Flujo de reporte ciudadano', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    
    // Mock navigator.geolocation usando defineProperty (geolocation es read-only)
    const mockGeolocation = {
      watchPosition: vi.fn((success) => {
        success({
          coords: {
            latitude: 6.2518,
            longitude: -75.5696,
            accuracy: 10,
          },
          timestamp: Date.now(),
        });
        return 123; // watchId
      }),
      clearWatch: vi.fn(),
    };

    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    });

    // Mock AbortSignal.timeout (Node 18+)
    if (!global.AbortSignal.timeout) {
      global.AbortSignal.timeout = vi.fn(() => new AbortSignal());
    }
  });

  it('debe solicitar geolocalización al cargar el componente', async () => {
    render(
      <BrowserRouter>
        <Report />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(navigator.geolocation.watchPosition).toHaveBeenCalled();
    });

    // Verificar que la ubicación se muestra con precisión
    await waitFor(() => {
      expect(screen.getByText(/6\.251800, -75\.569600/)).toBeInTheDocument();
    });
  });

  it('debe enviar POST al backend con los datos del formulario', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 123 }),
    });

    render(
      <BrowserRouter>
        <Report />
      </BrowserRouter>
    );

    // Esperar geolocalización
    await waitFor(() => {
      expect(screen.getByText(/6\.251800, -75\.569600/)).toBeInTheDocument();
    });

    // Seleccionar tipo de incidente
    const accidentButton = screen.getByText('Accidente de tránsito');
    fireEvent.click(accidentButton);

    // Escribir descripción
    const textarea = screen.getByPlaceholderText(/Describe brevemente/);
    fireEvent.change(textarea, { target: { value: 'Choque en la autopista' } });

    // Escribir nombre
    const nameInput = screen.getByPlaceholderText(/Ej: Juan Pérez/);
    fireEvent.change(nameInput, { target: { value: 'Test User' } });

    // Enviar formulario
    const submitButton = screen.getByText('Enviar reporte');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/reports/',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            report_type: 'accident',
            description: 'Choque en la autopista',
            latitude: 6.2518,
            longitude: -75.5696,
            reporter_name: 'Test User',
          }),
        })
      );
    });
  });

  it('debe redirigir al mapa con lat/lng después de enviar el reporte', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 456 }),
    });

    render(
      <BrowserRouter>
        <Report />
      </BrowserRouter>
    );

    // Esperar geolocalización
    await waitFor(() => {
      expect(screen.getByText(/6\.251800, -75\.569600/)).toBeInTheDocument();
    });

    // Seleccionar tipo
    fireEvent.click(screen.getByText('Inundación'));

    // Escribir nombre
    const nameInput = screen.getByPlaceholderText(/Ej: Juan Pérez/);
    fireEvent.change(nameInput, { target: { value: 'Test User' } });

    // Enviar
    fireEvent.click(screen.getByText('Enviar reporte'));

    // Esperar a que se muestre la pantalla de éxito
    await waitFor(() => {
      expect(screen.getByText('Reporte enviado')).toBeInTheDocument();
    });

    // Click en "Ver en el mapa"
    const mapButton = screen.getByText('Ver en el mapa');
    fireEvent.click(mapButton);

    expect(mockNavigate).toHaveBeenCalledWith('/map?lat=6.2518&lng=-75.5696&zoom=16');
  });

  it('debe detectar y mostrar WiFi/Red cuando no hay GPS (PC/laptop)', async () => {
    // Mock de ubicación WiFi/red (precisión alta = sin GPS)
    const mockGeolocationWiFi = {
      watchPosition: vi.fn((success) => {
        success({
          coords: {
            latitude: 6.2980,
            longitude: -75.5827,
            accuracy: 217594, // ±217km = WiFi/red
          },
          timestamp: Date.now(),
        });
        return 456;
      }),
      clearWatch: vi.fn(),
    };

    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocationWiFi,
      writable: true,
      configurable: true,
    });

    render(
      <BrowserRouter>
        <Report />
      </BrowserRouter>
    );

    // Debe mostrar indicador WiFi/Red
    await waitFor(() => {
      expect(screen.getByText(/📶 WiFi\/Red/)).toBeInTheDocument();
      expect(screen.getByText(/Sin GPS \(PC\/laptop\)/)).toBeInTheDocument();
    });
  });

  it('debe detectar y mostrar GPS Real cuando hay GPS (celular)', async () => {
    // Mock de GPS satelital (precisión baja = GPS real)
    const mockGeolocationGPS = {
      watchPosition: vi.fn((success) => {
        success({
          coords: {
            latitude: 6.2518,
            longitude: -75.5696,
            accuracy: 12, // ±12m = GPS real
          },
          timestamp: Date.now(),
        });
        return 789;
      }),
      clearWatch: vi.fn(),
    };

    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocationGPS,
      writable: true,
      configurable: true,
    });

    render(
      <BrowserRouter>
        <Report />
      </BrowserRouter>
    );

    // Debe mostrar indicador GPS Real
    await waitFor(() => {
      expect(screen.getByText(/📡 GPS Real/)).toBeInTheDocument();
      expect(screen.queryByText(/Sin GPS/)).not.toBeInTheDocument();
    });
  });

  it('debe manejar errores de red y mostrar mensaje de error', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    render(
      <BrowserRouter>
        <Report />
      </BrowserRouter>
    );

    // Esperar geolocalización
    await waitFor(() => {
      expect(screen.getByText(/6\.251800, -75\.569600/)).toBeInTheDocument();
    });

    // Seleccionar tipo
    fireEvent.click(screen.getByText('Accidente de tránsito'));

    // Escribir nombre
    const nameInput = screen.getByPlaceholderText(/Ej: Juan Pérez/);
    fireEvent.change(nameInput, { target: { value: 'Test' } });

    // Enviar
    fireEvent.click(screen.getByText('Enviar reporte'));

    // Verificar mensaje de error
    await waitFor(() => {
      expect(screen.getByText(/No se pudo enviar el reporte/)).toBeInTheDocument();
    });

    // El formulario debe seguir visible
    expect(screen.getByText('Reportar un incidente')).toBeInTheDocument();
  });
});
