import pytest
from unittest.mock import AsyncMock, patch
from shapely.geometry import LineString, Polygon
from sqlalchemy import text
import httpx

from app.services.routing import compute_route, _fetch_osrm_route

pytestmark = pytest.mark.asyncio

# Origen y destino que definen una recta que pasa por ~ (6.24, -75.57).
ORIGIN = (6.20, -75.58)
DEST = (6.28, -75.56)


async def _seed_flood(db, status, lng_lat_polygon):
    coords = ",".join(f"{lng} {lat}" for lng, lat in lng_lat_polygon)
    await db.execute(
        text(
            "INSERT INTO flood_hazards (name, status, geom) VALUES "
            f"('Z', '{status}', ST_SetSRID(ST_GeomFromText('POLYGON(({coords}))'),4326))"
        )
    )
    await db.commit()


def _path_as_lnglat(coordinates):
    # coordinates vienen como [lat, lng]; shapely usa (lng, lat).
    return LineString([(lng, lat) for lat, lng in coordinates])


async def test_direct_route_when_no_risk(db_session):
    # Mock OSRM para evitar llamada real y controlar el resultado
    with patch("app.services.routing._fetch_osrm_route", return_value=None):
        route = await compute_route(db_session, ORIGIN, DEST)
        assert route["coordinates"][0] == [ORIGIN[0], ORIGIN[1]]
        assert route["coordinates"][-1] == [DEST[0], DEST[1]]
        assert route["avoided_zones"] == 0
        assert route["distance_km"] > 0


async def test_route_avoids_active_flood_zone(db_session):
    # Polígono inundado sobre la recta directa (alrededor del punto medio).
    poly = [(-75.575, 6.235), (-75.565, 6.235), (-75.565, 6.245), (-75.575, 6.245), (-75.575, 6.235)]
    await _seed_flood(db_session, "flooded", poly)

    route = await compute_route(db_session, ORIGIN, DEST)

    assert route["avoided_zones"] >= 1
    assert len(route["coordinates"]) >= 3  # insertó al menos un waypoint
    # El camino resultante NO cruza la zona de riesgo.
    assert not _path_as_lnglat(route["coordinates"]).intersects(Polygon(poly))


async def test_dry_zone_is_ignored(db_session):
    poly = [(-75.575, 6.235), (-75.565, 6.235), (-75.565, 6.245), (-75.575, 6.245), (-75.575, 6.235)]
    await _seed_flood(db_session, "dry", poly)

    # Mock OSRM para probar solo la lógica de fallback
    with patch("app.services.routing._fetch_osrm_route", return_value=None):
        route = await compute_route(db_session, ORIGIN, DEST)
        assert route["avoided_zones"] == 0
        assert len(route["coordinates"]) == 2  # ruta directa, sin desvío


# ──────────────────────────────────────────────────────────────────────────────
# Tests para _fetch_osrm_route() — mocking de API externa OSRM
# ──────────────────────────────────────────────────────────────────────────────

async def test_fetch_osrm_route_timeout():
    """OSRM timeout → devuelve None (fallback a líneas rectas)"""
    with patch("app.services.routing.httpx.AsyncClient") as mock_client_class:
        mock_instance = AsyncMock()
        mock_instance.__aenter__.return_value = mock_instance
        mock_instance.__aexit__.return_value = AsyncMock()
        mock_instance.get = AsyncMock(side_effect=httpx.TimeoutException("Timeout after 10s"))
        mock_client_class.return_value = mock_instance
        
        result = await _fetch_osrm_route([ORIGIN[::-1], DEST[::-1]])
        assert result is None


# ──────────────────────────────────────────────────────────────────────────────
# Tests de conversión de coordenadas (lat,lng) ↔ (lng,lat)
# ──────────────────────────────────────────────────────────────────────────────

async def test_coordinate_conversion_medellin(db_session):
    """compute_route() debe manejar correctamente la conversión (lat, lng) ↔ (lng, lat)"""
    # Origen y destino en formato (lat, lng) — API pública de compute_route()
    origin_latlng = (6.2518, -75.5696)  # Parque Berrío, Medellín
    dest_latlng = (6.1698, -75.5821)    # Centro, Envigado
    
    # Mock OSRM para controlar el resultado
    fake_osrm = {
        "coordinates": [[6.25, -75.57], [6.20, -75.58], [6.17, -75.58]],
        "distance_km": 12.5
    }
    
    with patch("app.services.routing._fetch_osrm_route", return_value=fake_osrm) as mock_osrm:
        route = await compute_route(db_session, origin_latlng, dest_latlng)
        
        # Verificar que _fetch_osrm_route recibió coordenadas en formato (lng, lat)
        called_coords = mock_osrm.call_args[0][0]
        assert called_coords[0] == (-75.5696, 6.2518), "Primer punto debe ser (lng, lat)"
        assert called_coords[1] == (-75.5821, 6.1698), "Segundo punto debe ser (lng, lat)"
        
        # Verificar que el resultado tiene formato [lat, lng]
        assert route["coordinates"][0] == [6.25, -75.57]
        assert route["distance_km"] == 12.5


async def test_coordinate_conversion_preserves_precision(db_session):
    """La conversión de coordenadas debe preservar la precisión (6 decimales)"""
    # Coordenadas con alta precisión (típico GPS)
    origin_precise = (6.251834, -75.569612)  # 6 decimales (~10 cm de precisión)
    dest_precise = (6.169845, -75.582167)
    
    with patch("app.services.routing._fetch_osrm_route", return_value=None):
        route = await compute_route(db_session, origin_precise, dest_precise)
        
        # Verificar que las coordenadas de salida preservan la precisión
        first = route["coordinates"][0]
        last = route["coordinates"][-1]
        
        assert abs(first[0] - origin_precise[0]) < 1e-6
        assert abs(first[1] - origin_precise[1]) < 1e-6
        assert abs(last[0] - dest_precise[0]) < 1e-6
        assert abs(last[1] - dest_precise[1]) < 1e-6


async def test_fetch_osrm_route_500_error():
    """OSRM retorna 500 → devuelve None + warning log"""
    with patch("app.services.routing.httpx.AsyncClient") as mock_client_class:
        mock_instance = AsyncMock()
        mock_instance.__aenter__.return_value = mock_instance
        mock_instance.__aexit__.return_value = AsyncMock()
        
        # Simular respuesta 500
        mock_response = AsyncMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        mock_instance.get = AsyncMock(return_value=mock_response)
        mock_client_class.return_value = mock_instance
        
        result = await _fetch_osrm_route([ORIGIN[::-1], DEST[::-1]])  # (lng, lat)
        assert result is None


async def test_fetch_osrm_route_no_routes():
    """OSRM retorna 200 pero sin rutas → devuelve None"""
    with patch("app.services.routing.httpx.AsyncClient") as mock_client_class:
        mock_instance = AsyncMock()
        mock_instance.__aenter__.return_value = mock_instance
        mock_instance.__aexit__.return_value = AsyncMock()
        
        # Simular respuesta 200 pero sin campo "routes"
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.json = lambda: {"code": "NoRoute", "routes": []}
        mock_instance.get = AsyncMock(return_value=mock_response)
        mock_client_class.return_value = mock_instance
        
        result = await _fetch_osrm_route([ORIGIN[::-1], DEST[::-1]])
        assert result is None


async def test_fetch_osrm_route_connection_error():
    """OSRM connection error → devuelve None"""
    with patch("app.services.routing.httpx.AsyncClient") as mock_client_class:
        mock_instance = AsyncMock()
        mock_instance.__aenter__.return_value = mock_instance
        mock_instance.__aexit__.return_value = AsyncMock()
        
        # Simular error de conexión
        mock_instance.get = AsyncMock(side_effect=httpx.ConnectError("Connection refused"))
        mock_client_class.return_value = mock_instance
        
        result = await _fetch_osrm_route([ORIGIN[::-1], DEST[::-1]])
        assert result is None


async def test_compute_route_uses_osrm_when_available(db_session):
    """compute_route() intenta OSRM primero, fallback a líneas rectas si falla"""
    # Mockear _fetch_osrm_route para simular OSRM exitoso
    fake_osrm_result = {
        "coordinates": [[6.20, -75.58], [6.24, -75.57], [6.28, -75.56]],
        "distance_km": 10.0
    }
    
    with patch("app.services.routing._fetch_osrm_route", return_value=fake_osrm_result):
        route = await compute_route(db_session, ORIGIN, DEST)
        
        assert route["coordinates"][0] == [6.20, -75.58]
        assert route["coordinates"][-1] == [6.28, -75.56]
        assert route["distance_km"] == 10.0  # viene del mock
        assert route["avoided_zones"] == 0


async def test_compute_route_fallback_when_osrm_fails(db_session):
    """Si OSRM falla (timeout), compute_route() usa fallback de líneas rectas"""
    with patch("app.services.routing.httpx.AsyncClient") as mock_client_class:
        mock_instance = AsyncMock()
        mock_instance.__aenter__.return_value = mock_instance
        mock_instance.__aexit__.return_value = AsyncMock()
        mock_instance.get = AsyncMock(side_effect=httpx.TimeoutException("Timeout"))
        mock_client_class.return_value = mock_instance
        
        route = await compute_route(db_session, ORIGIN, DEST)
        
        # Fallback: líneas rectas (2 puntos: origen y destino)
        assert len(route["coordinates"]) == 2
        assert route["coordinates"][0] == [ORIGIN[0], ORIGIN[1]]
        assert route["coordinates"][-1] == [DEST[0], DEST[1]]
        assert route["distance_km"] > 0  # haversine
        assert route["avoided_zones"] == 0
