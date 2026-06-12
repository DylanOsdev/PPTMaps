import pytest

from app.ml.risk_model import SimpleRiskModel

pytestmark = pytest.mark.asyncio


class TestAccidentRiskPublic:

    async def test_risk_point_returns_score(self, client):
        model = SimpleRiskModel.get_instance()
        model.train([])

        resp = await client.get(
            "/api/v1/public/accident-risk",
            params={"lat": 6.25, "lng": -75.56},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "risk_score" in data
        assert 0.0 <= data["risk_score"] <= 1.0
        assert data["model"] == "climate-risk-v1"

    async def test_risk_heatmap_returns_points(self, client):
        model = SimpleRiskModel.get_instance()
        model.train([])

        resp = await client.get("/api/v1/public/accident-risk/heatmap")
        assert resp.status_code == 200
        data = resp.json()
        assert "points" in data
        assert "model" in data
        assert "generated_at" in data

    async def test_risk_train_returns_weights(self, client):
        resp = await client.get("/api/v1/public/accident-risk/train")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "weights" in data
        assert abs(sum(data["weights"].values()) - 1.0) < 0.01
