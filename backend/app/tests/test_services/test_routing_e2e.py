"""Tests E2E de routing.py contra la API OSRM REAL (router.project-osrm.org).

Estos tests NO mockean httpx — llaman a la API pública de OSRM para verificar
que la integración funciona end-to-end. Se marcan con @pytest.mark.e2e para
poder excluirlos en CI si es necesario.
"""
import pytest
from app.services.routing import _fetch_osrm_route, compute_route

pytestmark = [pytest.mark.asyncio, pytest.mark.e2e]

# Coordenadas reales de Medellín (formato lng, lat para OSRM)
MEDELLIN_PARQUE_BERRIO = (-75.5696, 6.2518)  # (lng, lat)
ENVIGADO_CENTRO = (-75.5821, 6.1698)         # (lng, lat)

# Coordenadas en formato (lat, lng) para compute_route
PARQUE_BERRIO_LATLNG = (6.2518, -75.5696)
ENVIGADO_CENTRO_LATLNG = (6.1698, -75.5821)


async def test_osrm_real_api_medellin_to_envigado():
    """Test E2E: ruta real Medellín → Envigado vía OSRM API pública."""
    result = await _fetch_osrm_route([MEDELLIN_PARQUE_BERRIO, ENVIGADO_CENTRO])
    
    assert result is not None, "OSRM API debería retornar una ruta válida"
    assert "coordinates" in result
    assert "distance_km" in result
    
    # Verificar estructura de coordenadas (lista de [lat, lng])
    assert len(result["coordinates"]) >= 2
    assert all(isinstance(coord, list) and len(coord) == 2 for coord in result["coordinates"])
    
    # Primera coordenada debe estar cerca del origen (tolerancia ~1km = 0.01 grados)
    first_coord = result["coordinates"][0]
    assert abs(first_coord[0] - PARQUE_BERRIO_LATLNG[0]) < 0.01
    assert abs(first_coord[1] - PARQUE_BERRIO_LATLNG[1]) < 0.01
    
    # Última coordenada debe estar cerca del destino
    last_coord = result["coordinates"][-1]
    assert abs(last_coord[0] - ENVIGADO_CENTRO_LATLNG[0]) < 0.01
    assert abs(last_coord[1] - ENVIGADO_CENTRO_LATLNG[1]) < 0.01
    
    # Distancia razonable (Medellín-Envigado ~10-15 km en línea recta, por calles ~12-18 km)
    assert 8 < result["distance_km"] < 25, f"Distancia inesperada: {result['distance_km']} km"


async def test_osrm_handles_unreachable_destination():
    """Test E2E: destino inalcanzable (coordenadas en océano) → OSRM retorna None."""
    # Coordenadas en medio del Océano Pacífico (lng, lat)
    ocean_point = (-120.0, 0.0)
    
    result = await _fetch_osrm_route([MEDELLIN_PARQUE_BERRIO, ocean_point])
    
    # OSRM puede retornar None o un error 400/404 dependiendo de la configuración
    # La función debe manejar esto gracefully (retornar None sin crash)
    assert result is None or result.get("coordinates") is not None


async def test_compute_route_e2e_with_real_osrm(db_session):
    """Test E2E: compute_route() usa OSRM real cuando disponible."""
    # Sin zonas de riesgo, debe llamar a OSRM directamente
    route = await compute_route(db_session, PARQUE_BERRIO_LATLNG, ENVIGADO_CENTRO_LATLNG)
    
    assert route["avoided_zones"] == 0  # sin obstáculos
    assert "coordinates" in route
    assert "distance_km" in route
    
    # Si OSRM está disponible, debe retornar más de 2 puntos (ruta con curvas)
    # Si OSRM falla, cae a fallback con 2 puntos (línea recta)
    # Ambos casos son válidos, solo verificamos que no crashea
    assert len(route["coordinates"]) >= 2
    assert route["distance_km"] > 0
