import pytest

from app.crud import crud_vehicle
from app.models.vehicle import VehicleStatus
from app.schemas.vehicle import VehicleCreate, VehicleUpdate

pytestmark = pytest.mark.asyncio


async def test_create_and_get_vehicle(db_session):
    created = await crud_vehicle.create_vehicle(
        db_session, VehicleCreate(plate="ABC123", model="Ambulancia X", type="ambulance")
    )
    assert created.id is not None
    assert created.plate == "ABC123"
    assert created.status == VehicleStatus.ACTIVE

    fetched = await crud_vehicle.get_vehicle(db_session, created.id)
    assert fetched is not None
    assert fetched.plate == "ABC123"


async def test_get_vehicle_by_plate(db_session):
    await crud_vehicle.create_vehicle(db_session, VehicleCreate(plate="XYZ789", type="patrol"))
    found = await crud_vehicle.get_vehicle_by_plate(db_session, "XYZ789")
    assert found is not None
    assert found.plate == "XYZ789"
    assert await crud_vehicle.get_vehicle_by_plate(db_session, "NOPE000") is None


async def test_list_vehicles(db_session):
    await crud_vehicle.create_vehicle(db_session, VehicleCreate(plate="L001", type="ambulance"))
    await crud_vehicle.create_vehicle(db_session, VehicleCreate(plate="L002", type="patrol"))
    vehicles = await crud_vehicle.get_vehicles(db_session)
    assert len(vehicles) == 2


async def test_update_vehicle_status(db_session):
    v = await crud_vehicle.create_vehicle(db_session, VehicleCreate(plate="UPD001", type="ambulance"))
    updated = await crud_vehicle.update_vehicle(
        db_session, v.id, VehicleUpdate(status=VehicleStatus.ON_MISSION)
    )
    assert updated.status == VehicleStatus.ON_MISSION


async def test_delete_vehicle(db_session):
    v = await crud_vehicle.create_vehicle(db_session, VehicleCreate(plate="DEL001", type="patrol"))
    ok = await crud_vehicle.delete_vehicle(db_session, v.id)
    assert ok is True
    assert await crud_vehicle.get_vehicle(db_session, v.id) is None
