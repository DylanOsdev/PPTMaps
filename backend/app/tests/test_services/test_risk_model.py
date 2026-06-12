import pytest

from app.ml.feature_pipeline import RiskFeatures
from app.ml.risk_model import SimpleRiskModel

pytestmark = pytest.mark.asyncio


def _feature(
    lat=6.25,
    lng=-75.56,
    hour=14,
    month=6,
    dayofweek=2,
    is_weekend=0,
    precipitation_mm=0.0,
    temperature_c=24.0,
    humidity=60.0,
    accident_density_1km=0,
    reports_last_24h=0,
    weather_event_nearby=0,
    severity=None,
):
    return RiskFeatures(
        lat=lat, lng=lng, hour=hour, month=month, dayofweek=dayofweek,
        is_weekend=is_weekend, precipitation_mm=precipitation_mm,
        temperature_c=temperature_c, humidity=humidity,
        accident_density_1km=accident_density_1km,
        reports_last_24h=reports_last_24h,
        weather_event_nearby=weather_event_nearby,
        severity=severity,
    )


class TestSimpleRiskModel:

    def test_score_is_between_0_and_1(self):
        model = SimpleRiskModel()
        model.train([])
        f = _feature()
        score = model.predict(f)
        assert 0.0 <= score <= 1.0

    def test_high_precipitation_increases_risk(self):
        model = SimpleRiskModel()
        model.train([])
        dry = model.predict(_feature(precipitation_mm=0))
        wet = model.predict(_feature(precipitation_mm=30))
        assert wet > dry

    def test_high_accident_density_increases_risk(self):
        model = SimpleRiskModel()
        model.train([])
        low = model.predict(_feature(accident_density_1km=0))
        high = model.predict(_feature(accident_density_1km=500))
        assert high > low

    def test_reports_nearby_increase_risk(self):
        model = SimpleRiskModel()
        model.train([])
        none = model.predict(_feature(reports_last_24h=0))
        many = model.predict(_feature(reports_last_24h=10))
        assert many > none

    def test_weather_events_increase_risk(self):
        model = SimpleRiskModel()
        model.train([])
        none = model.predict(_feature(weather_event_nearby=0))
        active = model.predict(_feature(weather_event_nearby=5))
        assert active >= none

    def test_night_hours_increase_risk(self):
        model = SimpleRiskModel()
        model.train([])
        day = model.predict(_feature(hour=14))
        night = model.predict(_feature(hour=2))
        assert night > day

    def test_weekend_slightly_higher_risk(self):
        model = SimpleRiskModel()
        model.train([])
        weekday = model.predict(_feature(is_weekend=0))
        weekend = model.predict(_feature(is_weekend=1))
        assert weekend >= weekday

    def test_extreme_temps_increase_risk(self):
        model = SimpleRiskModel()
        model.train([])
        normal = model.predict(_feature(temperature_c=24))
        extreme = model.predict(_feature(temperature_c=38))
        assert extreme > normal

    def test_train_adjusts_weights(self):
        model = SimpleRiskModel()
        f_list = [
            _feature(precipitation_mm=25, severity=5, hour=3),
            _feature(precipitation_mm=30, severity=5, hour=2),
            _feature(precipitation_mm=0, severity=1, hour=14),
            _feature(precipitation_mm=0, severity=1, hour=15),
        ]
        weights = model.train(f_list)
        assert abs(sum(weights.values()) - 1.0) < 0.01
        assert model.is_trained

    def test_predict_batch_returns_list(self):
        model = SimpleRiskModel()
        model.train([])
        features = [_feature(lat=6.25), _feature(lat=6.26)]
        results = model.predict_batch(features)
        assert len(results) == 2
        assert results[0].lat == 6.25
        assert 0.0 <= results[0].risk_score <= 1.0
