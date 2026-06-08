"""Servicio de chatbot IA integrado con Groq API y modelo XGBoost."""
import json
from datetime import datetime, timezone
from typing import Dict, List, Optional
from groq import Groq
import redis.asyncio as redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.report import Report
from app.models.flood_hazard import FloodHazard
from app.models.weather import WeatherSnapshot


class GroqChatbot:
    """Chatbot inteligente con Groq API + XGBoost ML predictions."""
    
    def __init__(self, api_key: str):
        self.client = Groq(api_key=api_key)
        self.model = settings.GROQ_MODEL
    
    async def build_context(self, db: AsyncSession, user_location: Optional[Dict] = None) -> Dict:
        """Construye contexto con datos reales del backend + predicciones ML.
        
        Args:
            db: Sesión de base de datos
            user_location: {lat, lng} opcional para filtrar por cercanía
        
        Returns:
            Dict con predicciones ML, reportes, clima, SIATA
        """
        now = datetime.now(timezone.utc)
        
        # 1. Predicciones ML de congestión (desde caché Redis)
        redis_client = redis.from_url(settings.REDIS_URL)
        try:
            predictions_cache = await redis_client.get("ml:traffic_predictions")
            
            if predictions_cache:
                cache_data = json.loads(predictions_cache)
                predictions = cache_data.get('predictions', [])
                # Top 5 zonas más peligrosas ahora
                top_dangerous = sorted(predictions, key=lambda x: x['risk_score'], reverse=True)[:5]
            else:
                top_dangerous = []
        except Exception:
            top_dangerous = []
        finally:
            await redis_client.aclose()
        
        # 2. Últimos reportes ciudadanos activos (últimos 10)
        reportes_query = await db.execute(
            select(Report)
            .order_by(Report.created_at.desc())
            .limit(10)
        )
        reportes = reportes_query.scalars().all()
        
        # 3. Clima actual (últimos 5 puntos)
        clima_query = await db.execute(
            select(WeatherSnapshot)
            .order_by(WeatherSnapshot.recorded_at.desc())
            .limit(5)
        )
        clima_snapshots = clima_query.scalars().all()
        
        # 4. Deprimidos en riesgo SIATA
        deprimidos_query = await db.execute(
            select(FloodHazard)
            .where(FloodHazard.status.in_(["watch", "flooded"]))
        )
        deprimidos_list = deprimidos_query.scalars().all()
        
        # Construir contexto compacto
        context = {
            "predicciones_ml": {
                "top_5_peligrosas": [
                    {
                        "comuna": p.get('comuna', 'Desconocida'),
                        "risk_score": p.get('risk_score', 0)
                    }
                    for p in top_dangerous
                ],
                "hora_actual": now.strftime("%H:%M"),
                "dia_actual": self._dia_nombre(now.weekday())
            },
            "reportes_activos": [
                {
                    "tipo": r.report_type.value if hasattr(r.report_type, 'value') else str(r.report_type),
                    "descripcion": r.description[:40] if r.description else "Sin descripción",
                    "minutos_atras": int((now - r.created_at).total_seconds() // 60)
                }
                for r in reportes[:5]
            ],
            "clima": {
                "temp_promedio": round(sum(c.temperature_c for c in clima_snapshots if c.temperature_c) / len(clima_snapshots), 1) if clima_snapshots else None,
                "lluvia_prob_max": max((c.precipitation_prob_2h for c in clima_snapshots if c.precipitation_prob_2h), default=0) if clima_snapshots else 0,
            },
            "deprimidos_riesgo": len(deprimidos_list),
            "total_reportes": len(reportes)
        }
        
        return context
    
    async def ask(self, question: str, context: Dict) -> Dict:
        """Procesa pregunta del usuario con contexto ML + datos reales.
        
        Args:
            question: Pregunta del usuario
            context: Contexto construido con build_context()
        
        Returns:
            {
                "text": str,  # Respuesta del chatbot
                "intent": str,  # Intención detectada
                "structured_data": dict  # Datos estructurados relevantes
            }
        """
        # Construir prompt con predicciones ML
        top_5 = context['predicciones_ml']['top_5_peligrosas']
        top_5_str = "\n".join([
            f"  • {p['comuna']} ({p['risk_score']}/100 riesgo)"
            for p in top_5
        ])
        
        reportes_str = "\n".join([
            f"  • {r['tipo']} - {r['descripcion']} (hace {r['minutos_atras']} min)"
            for r in context['reportes_activos'][:3]
        ]) if context['reportes_activos'] else "  • Sin reportes activos"
        
        prompt = f"""Eres el asistente virtual de PPTMaps, plataforma de movilidad inteligente de Medellín.

DATOS EN TIEMPO REAL ({context['predicciones_ml']['hora_actual']} - {context['predicciones_ml']['dia_actual']}):

🚦 PREDICCIÓN ML DE CONGESTIÓN (modelo XGBoost):
Zonas con MAYOR riesgo de accidentes AHORA:
{top_5_str}

📍 REPORTES CIUDADANOS ACTIVOS ({context['total_reportes']}):
{reportes_str}

🌦️ CLIMA ACTUAL:
  • Temperatura: {context['clima']['temp_promedio']}°C
  • Probabilidad lluvia: {context['clima']['lluvia_prob_max']}%
  • Deprimidos en riesgo: {context['deprimidos_riesgo']}

PREGUNTA: {question}

INSTRUCCIONES:
- Responde en español coloquial paisa (Medellín)
- Usa las predicciones ML para dar recomendaciones inteligentes
- Si preguntan por zonas peligrosas, menciona el top 5 del modelo
- Máximo 4 líneas cortas
- Si recomiendas evitar una zona, sugiere alternativas
- Usa emojis: 🚨 peligro, ✅ seguro, ⚠️ precaución, 🚗 tráfico, 🌧️ lluvia"""

        try:
            # Llamar Groq API
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=250
            )
            
            answer = response.choices[0].message.content
        except Exception as e:
            # Log del error para debug
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error Groq API: {type(e).__name__}: {str(e)}")
            
            # Fallback si Groq falla
            answer = f"⚠️ Disculpa parce, tengo un problema técnico. Pero te puedo decir que las zonas más pesadas ahora son: {', '.join([p['comuna'] for p in top_5[:3]])}. ¿Te sirve?"
        
        # Detectar intent
        intent = self._detect_intent(question)
        
        return {
            "text": answer,
            "intent": intent,
            "structured_data": {
                "predictions": top_5,
                "reports_count": context['total_reportes'],
                "flood_risk": context['deprimidos_riesgo'] > 0,
                "rain_probability": context['clima']['lluvia_prob_max']
            }
        }
    
    def _detect_intent(self, question: str) -> str:
        """Detecta la intención del usuario."""
        q = question.lower()
        
        if any(word in q for word in ["evitar", "peligro", "riesgo", "zonas", "pesad"]):
            return "dangerous_zones"
        elif any(word in q for word in ["ir a", "viajar", "ruta", "llegar"]):
            return "route_suggestion"
        elif any(word in q for word in ["clima", "lluvia", "temperatura", "tiempo"]):
            return "weather"
        elif any(word in q for word in ["reporte", "accidente", "inundación", "colisión"]):
            return "reports"
        elif any(word in q for word in ["segur", "mejor hora", "cuándo"]):
            return "best_time"
        else:
            return "general"
    
    def _dia_nombre(self, weekday: int) -> str:
        """Convierte número de día a nombre en español."""
        dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
        return dias[weekday]


# Singleton instance
_chatbot: Optional[GroqChatbot] = None


def get_chatbot() -> GroqChatbot:
    """Obtiene instancia singleton del chatbot."""
    global _chatbot
    if _chatbot is None:
        if not settings.GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY no está configurada en .env")
        _chatbot = GroqChatbot(api_key=settings.GROQ_API_KEY)
    return _chatbot
