"""Conexión opcional a PostgreSQL/PostGIS."""
from aplicacion.nucleo.configuracion import ajustes

_engine = None


def obtener_engine():
    global _engine
    if _engine is None:
        try:
            from sqlalchemy import create_engine, text

            _engine = create_engine(ajustes.url_base_datos, pool_pre_ping=True)
            with _engine.connect() as conn:
                conn.execute(text("SELECT 1"))
        except Exception:
            _engine = False
    return _engine if _engine is not False else None


def estado_base_datos() -> str:
    if not ajustes.verificar_bd:
        return "omitida"
    eng = obtener_engine()
    return "conectada" if eng else "desconectada"
