"""Simulador de conductores sobre rutas reales de Medellín.

Los vehículos siguen rutas predefinidas (Av. Oriental, El Poblado,
Autopista Sur, etc.) en vez de moverse aleatoriamente.
"""

import asyncio
import json
import logging
import math
import os
import random
from datetime import datetime, timezone

from sqlalchemy import select, text

from app.db.database import async_session_maker
from app.models.telemetry import Telemetry
from app.models.vehicle import Vehicle, VehicleStatus

logger = logging.getLogger(__name__)

SIM_INTERVAL = 3.0

_ROUTES_FILE = os.path.join(
    os.path.dirname(__file__), "..", "..", "..",
    "frontend", "public", "assets", "data", "rutas_medellin.json",
)


class RouteFollower:
    """Sigue una ruta de waypoints interpolando posición entre paradas."""

    def __init__(self, route_name: str, waypoints: list, direction: int = 1):
        self.route_name = route_name
        self.waypoints = waypoints
        self.direction = direction
        self.current_stop = 0
        self.progress = 0.0  # 0..1 entre current_stop y la siguiente
        self.speed_kmh = random.uniform(15, 35)
        self.dwell_timer = 0.0  # tiempo detenido en estación

    @property
    def total_stops(self):
        return len(self.waypoints)

    def current_pos(self) -> tuple:
        i = self.current_stop
        j = (i + 1) % self.total_stops
        p = self.progress
        lat = self.waypoints[i][0] + (self.waypoints[j][0] - self.waypoints[i][0]) * p
        lng = self.waypoints[i][1] + (self.waypoints[j][1] - self.waypoints[i][1]) * p
        return lat, lng

    def current_heading(self) -> float:
        i = self.current_stop
        j = (i + 1) % self.total_stops
        dx = self.waypoints[j][1] - self.waypoints[i][1]
        dy = self.waypoints[j][0] - self.waypoints[i][0]
        deg = math.degrees(math.atan2(dx, dy))
        return (deg + 360) % 360

    def advance(self, dt: float):
        if self.dwell_timer > 0:
            self.dwell_timer -= dt
            self.speed_kmh = max(self.speed_kmh - 1, 0)
            return

        segment_m = self._segment_length()
        step = (self.speed_kmh / 3.6) * dt / max(segment_m, 1)
        self.progress += step

        if self.progress >= 1.0:
            self.progress = 0.0
            self.current_stop = (self.current_stop + 1) % self.total_stops
            self.dwell_timer = random.uniform(2, 6)
            self.speed_kmh = random.uniform(15, 45)
            if self.current_stop == 0:
                self.direction *= -1
                self.waypoints = list(reversed(self.waypoints))
                self.current_stop = 0

    def _segment_length(self) -> float:
        i = self.current_stop
        j = (i + 1) % self.total_stops
        lat1, lng1 = self.waypoints[i]
        lat2, lng2 = self.waypoints[j]
        return math.sqrt((lat2 - lat1)**2 + (lng2 - lng1)**2) * 111_320


async def run_demo_simulator(stop_event: asyncio.Event):
    logger.info("Simulador de rutas reales iniciado (intervalo=%ss)", SIM_INTERVAL)
    await asyncio.sleep(2)

    routes_data = _load_routes()
    if not routes_data:
        logger.warning("No se encontraron rutas — usando movimiento aleatorio")
        await _fallback_random(stop_event)
        return

    followers: dict[str, RouteFollower] = {}

    while not stop_event.is_set():
        try:
            await _tick_routes(routes_data, followers)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning("Error en tick: %s", e)

        try:
            await asyncio.wait_for(
                asyncio.get_running_loop().create_future(), timeout=SIM_INTERVAL
            )
        except asyncio.TimeoutError:
            continue
        except asyncio.CancelledError:
            break


def _load_routes() -> list:
    try:
        with open(_ROUTES_FILE) as f:
            data = json.load(f)
        features = data.get("features", [])
        routes = []
        for feat in features:
            props = feat.get("properties", {})
            coords = feat.get("geometry", {}).get("coordinates", [])
            if coords:
                latlngs = [(c[1], c[0]) for c in coords]
                routes.append({
                    "name": props.get("name", "Ruta"),
                    "type": props.get("type", "bus"),
                    "color": props.get("color", "#888"),
                    "waypoints": latlngs,
                })
        logger.info("Rutas cargadas: %d", len(routes))
        return routes
    except Exception as e:
        logger.warning("Error cargando rutas: %s", e)
        return []


async def _tick_routes(routes_data: list, followers: dict[str, RouteFollower]):
    from geoalchemy2.functions import ST_MakePoint, ST_SetSRID

    async with async_session_maker() as db:
        rows = (
            await db.execute(
                select(Vehicle).where(Vehicle.status == VehicleStatus.ACTIVE)
            )
        ).scalars().all()

        if not rows:
            return

        positions = []
        for veh in rows:
            vid = str(veh.id)

            if vid not in followers:
                route = random.choice(routes_data)
                wps = route["waypoints"]
                direction = random.choice([1, -1])
                follower = RouteFollower(route["name"], wps if direction == 1 else list(reversed(wps)))
                follower.current_stop = random.randint(0, max(0, len(wps) - 2))
                follower.progress = random.random()
                followers[vid] = follower

            f = followers[vid]
            f.advance(SIM_INTERVAL)
            lat, lng = f.current_pos()
            hdg = f.current_heading()
            now = datetime.now(timezone.utc)

            telemetry = Telemetry(
                vehicle_id=veh.id,
                latitude=lat,
                longitude=lng,
                speed=round(f.speed_kmh, 1),
                heading=round(hdg, 1),
                location=ST_SetSRID(ST_MakePoint(lng, lat), 4326),
                timestamp=now,
            )
            db.add(telemetry)

            positions.append({
                "id": vid,
                "vehicle_id": vid,
                "plate": veh.plate,
                "type": veh.type,
                "route": f.route_name,
                "lat": round(lat, 5),
                "lng": round(lng, 5),
                "speed": round(f.speed_kmh, 1),
                "heading": round(hdg, 1),
                "timestamp": now.isoformat(),
            })

        await db.commit()

    if positions:
        from app.websocket.connection_manager import manager
        await manager.broadcast({"type": "telemetry", "data": positions})


async def _fallback_random(stop_event: asyncio.Event):
    """Movimiento aleatorio si no hay rutas cargadas."""
    from geoalchemy2.functions import ST_MakePoint, ST_SetSRID

    bounds = {"min_lat": 6.05, "max_lat": 6.45, "min_lng": -75.75, "max_lng": -75.35}
    state: dict[str, dict] = {}

    def _rand(lo, hi):
        return lo + random.random() * (hi - lo)

    def _move(lat, lng, speed, heading):
        m = (speed / 3.6) * SIM_INTERVAL
        r = math.radians(heading)
        dlat = m * math.cos(r) / 111320
        dlng = m * math.sin(r) / (111320 * math.cos(math.radians(lat)))
        return lat + dlat, lng + dlng

    while not stop_event.is_set():
        try:
            async with async_session_maker() as db:
                rows = (await db.execute(select(Vehicle).where(Vehicle.status == VehicleStatus.ACTIVE))).scalars().all()
                if not rows:
                    await asyncio.sleep(SIM_INTERVAL)
                    continue

                positions = []
                for veh in rows:
                    vid = str(veh.id)
                    s = state.get(vid)
                    if s is None:
                        s = {"lat": _rand(6.10, 6.40), "lng": _rand(-75.70, -75.40),
                             "heading": _rand(0, 360), "speed": _rand(10, 50),
                             "target_h": _rand(0, 360), "target_s": _rand(10, 50),
                             "timer": _rand(3, 8)}
                        state[vid] = s
                    s["timer"] -= SIM_INTERVAL
                    if s["timer"] <= 0:
                        s["target_h"] = (s["heading"] + _rand(-45, 45)) % 360
                        s["target_s"] = _rand(5, 60)
                        s["timer"] = _rand(4, 12)
                    s["heading"] += (s["target_h"] - s["heading"] + 540) % 360 - 180 * 0.15
                    s["speed"] += (s["target_s"] - s["speed"]) * 0.1

                    lat, lng = _move(s["lat"], s["lng"], s["speed"], s["heading"])
                    s["lat"] = max(6.05, min(6.45, lat))
                    s["lng"] = max(-75.75, min(-75.35, lng))

                    now = datetime.now(timezone.utc)
                    db.add(Telemetry(
                        vehicle_id=veh.id, latitude=s["lat"], longitude=s["lng"],
                        speed=round(s["speed"], 1), heading=round(s["heading"], 1),
                        location=ST_SetSRID(ST_MakePoint(s["lng"], s["lat"]), 4326),
                        timestamp=now,
                    ))
                    positions.append({
                        "id": vid, "vehicle_id": vid, "plate": veh.plate,
                        "type": veh.type, "lat": round(s["lat"], 5), "lng": round(s["lng"], 5),
                        "speed": round(s["speed"], 1), "heading": round(s["heading"], 1),
                        "timestamp": now.isoformat(),
                    })
                await db.commit()

            if positions:
                from app.websocket.connection_manager import manager
                await manager.broadcast({"type": "telemetry", "data": positions})
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning("Error en fallback: %s", e)

        try:
            await asyncio.wait_for(
                asyncio.get_running_loop().create_future(), timeout=SIM_INTERVAL
            )
        except asyncio.TimeoutError:
            continue
        except asyncio.CancelledError:
            break
