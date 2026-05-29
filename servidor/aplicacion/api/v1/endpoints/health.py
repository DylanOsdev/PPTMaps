from fastapi import APIRouter

router = APIRouter()


@router.get("/status")
async def api_status():
    return {"status": "ok", "version": "v1"}
