from sqlalchemy import Column, Date, Integer, String, Index
from geoalchemy2 import Geometry

from app.db.base_class import Base


class AccidentIncident(Base):
    """Incidente vial oficial (Secretaría de Movilidad de Medellín, 2008-2025).

    Fuente: dataset abierto Mendeley r6g5dfnpgh (CC BY 4.0). Preserva los campos
    categóricos (clase, gravedad, comuna) que alimentan el dashboard analítico.
    """

    __tablename__ = "accident_incidents"

    id = Column(Integer, primary_key=True, index=True)
    llave = Column(String(40), unique=True, index=True, nullable=False)  # id oficial, idempotencia
    year = Column(Integer, index=True, nullable=True)
    incident_date = Column(Date, nullable=True)
    incident_hour = Column(String(20), nullable=True)
    incident_class = Column(String(40), index=True, nullable=True)   # Choque, Atropello, ...
    severity = Column(String(20), index=True, nullable=True)         # SOLO DAÑOS, HERIDO, MUERTO
    comuna = Column(String(60), index=True, nullable=True)
    barrio = Column(String(80), nullable=True)
    geom = Column(Geometry(geometry_type="POINT", srid=4326, spatial_index=False), nullable=True)


Index("idx_accident_incidents_geom", AccidentIncident.geom, postgresql_using="gist")
