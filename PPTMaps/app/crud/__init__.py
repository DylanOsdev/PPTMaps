from .crud_user import get_user_by_id, get_user_by_email, get_users, create_user, update_user, authenticate_user
from .crud_vehicle import get_vehicle, get_vehicle_by_plate, get_vehicles, create_vehicle, update_vehicle, delete_vehicle
from .crud_telemetry import create_telemetry, bulk_create_telemetry, get_telemetry, get_latest_telemetry_per_vehicle, get_telemetry_within_radius
from .crud_alert import get_alerts, create_alert, resolve_alert
