import enum

class UserRole(str, enum.Enum):
    admin = 'admin'
    dispatcher = 'dispatcher'
    driver = 'driver'
    viewer = 'viewer'

class VehicleStatus(str, enum.Enum):
    available = 'available'
    on_mission = 'on_mission'
    maintenance = 'maintenance'
    out_of_service = 'out_of_service'

class VehicleType(str, enum.Enum):
    ambulance_basic = 'ambulance_basic'
    ambulance_advanced = 'ambulance_advanced'
    rescue_vehicle = 'rescue_vehicle'
    medical_car = 'medical_car'

class ShiftStatus(str, enum.Enum):
    scheduled = 'scheduled'
    active = 'active'
    completed = 'completed'
    cancelled = 'cancelled'

class RouteStatus(str, enum.Enum):
    planned = 'planned'
    active = 'active'
    completed = 'completed'
    cancelled = 'cancelled'

class AlertType(str, enum.Enum):
    speeding = 'speeding'
    stopped = 'stopped'
    geofence_exit = 'geofence_exit'
    accident = 'accident'
    eta_delayed = 'eta_delayed'
    maintenance = 'maintenance'
