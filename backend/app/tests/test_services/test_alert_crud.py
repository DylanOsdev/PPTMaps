import pytest

from app.crud import crud_alert
from app.models.alert import AlertSeverity
from app.schemas.alert import AlertCreate, AlertUpdate

pytestmark = pytest.mark.asyncio


async def test_create_alert(db_session):
    alert = await crud_alert.create_alert(
        db_session,
        AlertCreate(type="OVERSPEED", severity=AlertSeverity.WARNING, message="Exceso de velocidad"),
    )
    assert alert.id is not None
    assert alert.severity == AlertSeverity.WARNING
    assert alert.is_resolved is False


async def test_list_alerts_filter_unresolved(db_session):
    a1 = await crud_alert.create_alert(db_session, AlertCreate(type="A", message="m1"))
    await crud_alert.create_alert(db_session, AlertCreate(type="B", message="m2"))
    await crud_alert.update_alert(db_session, a1.id, AlertUpdate(is_resolved=True))

    unresolved = await crud_alert.get_alerts(db_session, is_resolved=False)
    assert len(unresolved) == 1
    assert unresolved[0].type == "B"

    all_alerts = await crud_alert.get_alerts(db_session)
    assert len(all_alerts) == 2


async def test_resolve_alert_sets_resolved_at(db_session):
    a = await crud_alert.create_alert(db_session, AlertCreate(type="C", message="m"))
    updated = await crud_alert.update_alert(db_session, a.id, AlertUpdate(is_resolved=True))
    assert updated.is_resolved is True
    assert updated.resolved_at is not None
