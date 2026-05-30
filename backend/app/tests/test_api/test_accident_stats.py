import pytest
from sqlalchemy import text

pytestmark = pytest.mark.asyncio


async def _seed(db, llave, year, klass, severity, comuna):
    await db.execute(
        text(
            "INSERT INTO accident_incidents (llave, year, incident_class, severity, comuna, geom) "
            "VALUES (:k, :y, :c, :s, :co, ST_SetSRID(ST_MakePoint(-75.57,6.24),4326))"
        ),
        {"k": llave, "y": year, "c": klass, "s": severity, "co": comuna},
    )
    await db.commit()


async def test_accidents_stats_aggregates(client, db_session):
    await _seed(db_session, "A1", 2020, "Choque", "HERIDO", "La Candelaria")
    await _seed(db_session, "A2", 2020, "Choque", "MUERTO", "El Poblado")
    await _seed(db_session, "A3", 2021, "Atropello", "HERIDO", "La Candelaria")

    resp = await client.get("/api/v1/public/accidents/stats")
    assert resp.status_code == 200
    data = resp.json()

    assert data["total"] == 3
    assert {"by_severity", "by_class", "by_comuna", "by_year"} <= set(data)
    # by_severity: HERIDO=2, MUERTO=1
    sev = {d["key"]: d["count"] for d in data["by_severity"]}
    assert sev["HERIDO"] == 2 and sev["MUERTO"] == 1
    # by_class: Choque=2, Atropello=1
    cls = {d["key"]: d["count"] for d in data["by_class"]}
    assert cls["Choque"] == 2 and cls["Atropello"] == 1
    # by_comuna: La Candelaria=2
    com = {d["key"]: d["count"] for d in data["by_comuna"]}
    assert com["La Candelaria"] == 2
    # by_year: 2020=2, 2021=1
    yr = {d["key"]: d["count"] for d in data["by_year"]}
    assert yr["2020"] == 2 and yr["2021"] == 1
