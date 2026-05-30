# Re-exporta Base desde base_class para que alembic/env.py y models/__init__.py
# puedan importar desde aquí sin importar directamente desde base_class.
from app.db.base_class import Base  # noqa: F401

# Importamos todos los modelos aquí para que Alembic los detecte
# en el autogenerate y no genere migraciones vacías.
from app.models.user import User  # noqa: F401
from app.models.report import Report  # noqa: F401
from app.models.accident_zone import AccidentZone  # noqa: F401
from app.models.flood_hazard import FloodHazard  # noqa: F401
from app.models.vehicle import Vehicle  # noqa: F401
from app.models.telemetry import Telemetry  # noqa: F401
from app.models.alert import Alert  # noqa: F401
from app.models.weather import WeatherSnapshot  # noqa: F401
from app.models.zone import Zone  # noqa: F401
from app.models.accident_incident import AccidentIncident  # noqa: F401

__all__ = [
    "Base",
    "User",
    "Report",
    "AccidentZone",
    "FloodHazard",
    "Vehicle",
    "Telemetry",
    "Alert",
    "WeatherSnapshot",
    "Zone",
    "AccidentIncident",
]
