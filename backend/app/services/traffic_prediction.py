"""Servicio de predicción de congestión en tiempo real usando modelo XGBoost."""
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional
import joblib
import pandas as pd
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class TrafficPredictionService:
    """Servicio de predicción de congestión por zona usando ML."""
    
    def __init__(self):
        self.model = None
        self.encoder = None
        self._load_model()
    
    def _load_model(self):
        """Carga modelo y encoder desde disco."""
        models_dir = Path(__file__).parent.parent / "ml" / "models"
        model_path = models_dir / "traffic_model.joblib"
        encoder_path = models_dir / "comuna_encoder.joblib"
        
        if model_path.exists() and encoder_path.exists():
            self.model = joblib.load(model_path)
            self.encoder = joblib.load(encoder_path)
        else:
            raise FileNotFoundError(f"Modelo no encontrado en {models_dir}")
    
    async def predict_current(self, db: AsyncSession) -> List[Dict]:
        """Predice riesgo de congestión para todas las comunas en hora actual.
        
        Returns:
            Lista de dicts con {comuna, lat, lng, risk_score, hora, dia}
        """
        now = datetime.now()
        hora = now.hour
        dia_semana = now.weekday()  # 0=Lun, 6=Dom
        mes = now.month
        
        # Features temporales
        es_hora_pico = 1 if (6 <= hora <= 9) or (17 <= hora <= 20) else 0
        es_fin_semana = 1 if dia_semana in (5, 6) else 0  # Sábado=5, Domingo=6
        
        # Obtener clima agregado para este mes+hora desde archivo histórico
        try:
            import pandas as pd
            from pathlib import Path
            clima_path = Path(__file__).parent.parent.parent / "clima_historico_medellin.csv"
            if clima_path.exists():
                df_clima = pd.read_csv(clima_path)
                df_clima['timestamp'] = pd.to_datetime(df_clima['timestamp'])
                df_clima['mes'] = df_clima['timestamp'].dt.month
                df_clima['hora'] = df_clima['timestamp'].dt.hour
                clima_mes_hora = df_clima[(df_clima['mes'] == mes) & (df_clima['hora'] == hora)]
                temp_avg = float(clima_mes_hora['temp'].mean()) if len(clima_mes_hora) > 0 else 21.0
                lluvia_avg = float(clima_mes_hora['lluvia'].mean()) if len(clima_mes_hora) > 0 else 0.1
            else:
                temp_avg, lluvia_avg = 21.0, 0.1  # Defaults
        except Exception:
            temp_avg, lluvia_avg = 21.0, 0.1
        
        # Obtener count de deprimidos en riesgo (SIATA en tiempo real)
        deprimidos_result = await db.execute(text("""
            SELECT COUNT(*) as count
            FROM flood_hazards
            WHERE status IN ('watch', 'flooded')
        """))
        deprimidos_riesgo = int(deprimidos_result.scalar() or 0)
        
        # Obtener todas las comunas de zones
        result = await db.execute(text("""
            SELECT DISTINCT
                name AS comuna,
                ST_Y(ST_Centroid(geom)) as lat,
                ST_X(ST_Centroid(geom)) as lng
            FROM zones
            WHERE kind = 'comuna'
        """))
        
        comunas = result.fetchall()
        predictions = []
        
        for comuna_row in comunas:
            comuna = comuna_row.comuna
            lat = float(comuna_row.lat)
            lng = float(comuna_row.lng)
            
            try:
                # Codificar comuna
                comuna_encoded = self.encoder.transform([comuna])[0]
            except ValueError:
                # Comuna no está en el encoder - usar promedio de comunas conocidas
                # Esto permite predecir para las 7 comunas sin datos de training
                comuna_encoded = len(self.encoder.classes_) // 2  # Mediana
            
            # Features: h, d, m, ce, lat, lng, g, hp, fs, temp, lluvia, deprimidos_riesgo
            X = pd.DataFrame([[
                hora, dia_semana, mes, comuna_encoded,
                lat, lng, 2.0,  # gravedad promedio default
                es_hora_pico, es_fin_semana,
                temp_avg, lluvia_avg,
                deprimidos_riesgo  # Count de deprimidos inundados (SIATA real-time)
            ]], columns=[
                'h', 'd', 'm', 'ce', 'lat', 'lng', 'g', 'hp', 'fs', 'temp', 'lluvia', 'deprimidos_riesgo'
            ])
            
            # Predecir
            risk_score = int(self.model.predict(X)[0])
            
            predictions.append({
                'comuna': comuna,
                'lat': lat,
                'lng': lng,
                'risk_score': max(0, min(100, risk_score)),  # Clamp 0-100
                'hora': hora,
                'dia_semana': dia_semana,
                'timestamp': now.isoformat()
            })
        
        # Ordenar por riesgo descendente
        predictions.sort(key=lambda x: x['risk_score'], reverse=True)
        
        return predictions
    
    async def predict_for_zone(
        self, 
        db: AsyncSession,
        comuna: str,
        hora: Optional[int] = None,
        dia_semana: Optional[int] = None
    ) -> Optional[Dict]:
        """Predice riesgo para una comuna específica en una hora/día dado.
        
        Args:
            comuna: Nombre de la comuna
            hora: Hora del día (0-23), None = hora actual
            dia_semana: Día semana (0=Lun, 6=Dom), None = hoy
        
        Returns:
            Dict con predicción o None si comuna no existe
        """
        now = datetime.now()
        hora = hora if hora is not None else now.hour
        dia_semana = dia_semana if dia_semana is not None else now.weekday()
        
        # Obtener coordenadas de la comuna
        result = await db.execute(text("""
            SELECT 
                AVG(ST_Y(geom)) as lat,
                AVG(ST_X(geom)) as lng
            FROM accident_incidents
            WHERE comuna = :comuna AND geom IS NOT NULL
            GROUP BY comuna
        """), {'comuna': comuna})
        
        row = result.fetchone()
        if not row:
            return None
        
        lat = float(row.lat)
        lng = float(row.lng)
        
        try:
            comuna_encoded = self.encoder.transform([comuna])[0]
            
            X = pd.DataFrame([[
                hora, dia_semana, now.month, comuna_encoded,
                lat, lng, 2.0
            ]], columns=['hora', 'dia_semana', 'mes', 'comuna_encoded', 'lat', 'lng', 'gravedad'])
            
            risk_score = int(self.model.predict(X)[0])
            
            return {
                'comuna': comuna,
                'lat': lat,
                'lng': lng,
                'risk_score': max(0, min(100, risk_score)),
                'hora': hora,
                'dia_semana': dia_semana,
                'timestamp': now.isoformat()
            }
        except ValueError:
            return None


# Singleton instance
_service: Optional[TrafficPredictionService] = None


def get_prediction_service() -> TrafficPredictionService:
    """Obtiene instancia singleton del servicio de predicción."""
    global _service
    if _service is None:
        _service = TrafficPredictionService()
    return _service
