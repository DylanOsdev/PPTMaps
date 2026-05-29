# Import all the models, so that Base has them before being imported by Alembic
from app.db.base_class import Base
from app.models.user import User
from app.models.vehicle import Vehicle
# from app.models.shift import Shift
# from app.models.telemetry import Telemetry
# from app.models.route import Route
# from app.models.alert import Alert
