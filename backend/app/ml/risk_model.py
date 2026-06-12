import logging
from typing import List, Optional

from app.ml.feature_pipeline import RiskFeatures, RiskPrediction

logger = logging.getLogger(__name__)


class SimpleRiskModel:
    _instance = None

    def __init__(self):
        self._trained = False
        self._weights = {
            "accident_density": 0.35,
            "precipitation": 0.20,
            "weather_event": 0.15,
            "reports": 0.10,
            "night_hours": 0.10,
            "weekend": 0.05,
            "temp_extreme": 0.05,
        }

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def train(self, features: List[RiskFeatures]) -> dict:
        if not features:
            logger.warning("No training data provided, using default weights")
            return self._weights

        n = len(features)
        high_sev = [f for f in features if f.severity and f.severity >= 4]
        if not high_sev:
            logger.info("No high-severity samples, keeping default weights")
            self._trained = True
            return self._weights

        high_ratio = len(high_sev) / n
        avg_precip_high = sum(f.precipitation_mm for f in high_sev) / len(high_sev)
        avg_precip_all = sum(f.precipitation_mm for f in features) / n

        night_high = sum(1 for f in high_sev if f.hour < 6 or f.hour >= 20) / len(high_sev)
        night_all = sum(1 for f in features if f.hour < 6 or f.hour >= 20) / n

        self._weights = self._adjust_weights({
            "accident_density": round(0.35 + (high_ratio - 0.1) * 0.5, 3),
            "precipitation": round(0.20 + (avg_precip_high - avg_precip_all) * 0.01, 3),
            "weather_event": 0.15,
            "reports": 0.10,
            "night_hours": round(0.10 + (night_high - night_all) * 0.3, 3),
            "weekend": 0.05,
            "temp_extreme": 0.05,
        })
        self._trained = True
        logger.info(f"Trained risk model on {n} samples (weights: {self._weights})")
        return self._weights

    def predict(self, f: RiskFeatures) -> float:
        score = 0.0
        score += self._weights["accident_density"] * self._norm_density(f.accident_density_1km)
        score += self._weights["precipitation"] * self._norm_precipitation(f.precipitation_mm)
        score += self._weights["weather_event"] * min(f.weather_event_nearby / 5, 1.0)
        score += self._weights["reports"] * min(f.reports_last_24h / 10, 1.0)
        score += self._weights["night_hours"] * (1.0 if f.hour < 6 or f.hour >= 20 else 0.0)
        score += self._weights["weekend"] * (1.0 if f.is_weekend else 0.0)
        score += self._weights["temp_extreme"] * self._norm_temp_extreme(f.temperature_c)
        return min(max(round(score, 4), 0.0), 1.0)

    def predict_batch(self, features: List[RiskFeatures]) -> List[RiskPrediction]:
        now = __import__("datetime").datetime.utcnow()
        return [
            RiskPrediction(
                lat=f.lat,
                lng=f.lng,
                comuna=None,
                risk_score=self.predict(f),
                timestamp=now,
            )
            for f in features
        ]

    @property
    def is_trained(self) -> bool:
        return self._trained

    def _norm_density(self, count: int) -> float:
        return min(count / 500, 1.0)

    @staticmethod
    def _norm_precipitation(mm: float) -> float:
        if mm <= 0:
            return 0.0
        if mm < 5:
            return 0.2
        if mm < 15:
            return 0.5
        if mm < 30:
            return 0.75
        return 1.0

    @staticmethod
    def _norm_temp_extreme(temp_c: Optional[float]) -> float:
        if temp_c is None:
            return 0.0
        if temp_c > 35 or temp_c < 10:
            return 1.0
        if temp_c > 30 or temp_c < 15:
            return 0.5
        return 0.0

    def _adjust_weights(self, raw: dict) -> dict:
        total = sum(raw.values())
        return {k: round(v / total, 4) for k, v in raw.items()}
