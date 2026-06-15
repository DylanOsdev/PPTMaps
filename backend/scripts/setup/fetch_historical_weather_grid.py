"""Fetch historical precipitation for a grid of points over Medellín from Open-Meteo.

ERA5-Land grid cells (0.1°) covering Medellín valley:
  Lats: 6.2, 6.3  (covers 6.15-6.35)
  Lngs: -75.7, -75.6, -75.5  (covers -75.75 to -75.45)
→ 6 distinct cells, ~11km resolution, hourly data 2008-2025
"""
import asyncio
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import httpx
from sqlalchemy import text
from app.db.database import async_session_maker

# Known ERA5-Land 0.1° grid cells covering Medellín
GRID_CELLS = [
    (6.2, -75.7),
    (6.2, -75.6),
    (6.2, -75.5),
    (6.3, -75.7),
    (6.3, -75.6),
    (6.3, -75.5),
]

START_DATE = "2008-01-01"
END_DATE = "2025-12-31"


async def fetch_openmeteo():
    lats = ",".join(str(c[0]) for c in GRID_CELLS)
    lngs = ",".join(str(c[1]) for c in GRID_CELLS)

    params = {
        "latitude": lats,
        "longitude": lngs,
        "start_date": START_DATE,
        "end_date": END_DATE,
        "hourly": "precipitation,temperature_2m",
        "timezone": "America/Bogota",
        "model": "era5_land",
    }

    print(f"📡 Fetching {len(GRID_CELLS)} grid cells from Open-Meteo...")
    print(f"   Lats: {lats}")
    print(f"   Lngs: {lngs}")
    print(f"   Period: {START_DATE} to {END_DATE}")

    async with httpx.AsyncClient(timeout=180) as client:
        resp = await client.get(
            "https://archive-api.open-meteo.com/v1/archive",
            params=params,
        )
        resp.raise_for_status()
        data = resp.json()

    # data is a list of dicts (one per location) when multiple coords
    locations = data if isinstance(data, list) else [data]
    print(f"   API returned {len(locations)} location(s)")

    # Deduplicate by actual cell center (API may collapse nearby coords)
    cell_map: dict[tuple[float, float], dict] = {}
    for loc in locations:
        cell_lat = round(loc["latitude"], 6)
        cell_lng = round(loc["longitude"], 6)
        key = (cell_lat, cell_lng)
        if key not in cell_map:
            hourly = loc.get("hourly", {})
            times = hourly.get("time", [])
            precip = hourly.get("precipitation", [])
            temp = hourly.get("temperature_2m", [])
            print(f"   📍 Cell ({cell_lat}, {cell_lng}): {len(times)} records")
            cell_map[key] = {"times": times, "precipitation": precip, "temperature": temp}

    print(f"\n✅ {len(cell_map)} unique grid cells after dedup\n")
    return cell_map


async def store_grid(cell_map: dict):
    async with async_session_maker() as db:
        # Check existing count
        result = await db.execute(text("SELECT COUNT(*) FROM historical_weather_grid"))
        existing = result.scalar()
        if existing > 0:
            print(f"⚠️  Table already has {existing} records. Truncating and reloading...")
            await db.execute(text("TRUNCATE historical_weather_grid"))
            await db.commit()

        total = 0
        for (cell_lat, cell_lng), d in cell_map.items():
            batch = []
            for i, ts_str in enumerate(d["times"]):
                try:
                    ts = datetime.fromisoformat(ts_str)
                except ValueError:
                    continue
                p = float(d["precipitation"][i]) if d["precipitation"][i] is not None else None
                t = float(d["temperature"][i]) if d["temperature"][i] is not None else None
                batch.append({
                    "grid_cell_lat": cell_lat,
                    "grid_cell_lng": cell_lng,
                    "timestamp": ts,
                    "precipitation_mm": p,
                    "temperature_c": t,
                })

            # Store in batches of 5000
            BATCH_SIZE = 5000
            for i in range(0, len(batch), BATCH_SIZE):
                chunk = batch[i:i + BATCH_SIZE]
                await db.execute(
                    text("""
                        INSERT INTO historical_weather_grid
                            (grid_cell_lat, grid_cell_lng, timestamp, precipitation_mm, temperature_c)
                        VALUES
                            (:grid_cell_lat, :grid_cell_lng, :timestamp, :precipitation_mm, :temperature_c)
                        ON CONFLICT (grid_cell_lat, grid_cell_lng, timestamp) DO NOTHING
                    """),
                    chunk,
                )
            total += len(batch)
            print(f"   ✅ Cell ({cell_lat}, {cell_lng}): {len(batch)} records stored")

        # Update geom column (POINT from lat/lng)
        await db.execute(text("""
            UPDATE historical_weather_grid
            SET geom = ST_SetSRID(ST_MakePoint(grid_cell_lng, grid_cell_lat), 4326)
            WHERE geom IS NULL
        """))

        await db.commit()
        print(f"\n📊 Total: {total} records across {len(cell_map)} grid cells")


async def main():
    cell_map = await fetch_openmeteo()
    await store_grid(cell_map)
    print("✅ Done!")


if __name__ == "__main__":
    asyncio.run(main())
