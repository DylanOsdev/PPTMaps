from app.db.base import Base
from app.models.user import User
from app.models.vehicle import Vehicle
from app.models.telemetry import Telemetry
from app.models.alert import Alert
from app.models.report import Report

# Se exportan para que Alembic (y otros módulos) puedan encontrarlos fácilmente.
__all__ = ["Base", "User", "Vehicle", "Telemetry", "Alert", "Report"]
