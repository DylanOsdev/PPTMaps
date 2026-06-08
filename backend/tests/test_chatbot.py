"""Tests para el servicio de chatbot con Groq API y XGBoost."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from app.services.chatbot import GroqChatbot


@pytest.fixture
def mock_groq_client():
    """Mock del cliente Groq."""
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=MagicMock(content="Respuesta de prueba"))]
    mock_client.chat.completions.create.return_value = mock_response
    return mock_client


@pytest.fixture
def chatbot(mock_groq_client):
    """Instancia de chatbot con mock."""
    bot = GroqChatbot(api_key="test_key")
    bot.client = mock_groq_client
    return bot


@pytest.mark.asyncio
async def test_build_context_basic(chatbot):
    """Test que build_context retorna estructura correcta."""
    mock_db = AsyncMock()
    
    # Mock de queries
    mock_db.execute.return_value.scalars.return_value.all.return_value = []
    
    with patch('app.services.chatbot.redis.from_url') as mock_redis:
        mock_redis_instance = AsyncMock()
        mock_redis_instance.get.return_value = None
        mock_redis_instance.aclose = AsyncMock()
        mock_redis.return_value = mock_redis_instance
        
        context = await chatbot.build_context(mock_db)
    
    # Verificar estructura del contexto
    assert "predicciones_ml" in context
    assert "reportes_activos" in context
    assert "clima" in context
    assert "deprimidos_riesgo" in context
    assert "total_reportes" in context
    
    # Verificar formato de predicciones
    assert "top_5_peligrosas" in context["predicciones_ml"]
    assert "hora_actual" in context["predicciones_ml"]
    assert "dia_actual" in context["predicciones_ml"]


@pytest.mark.asyncio
async def test_build_context_with_predictions(chatbot):
    """Test que build_context procesa predicciones ML correctamente."""
    import json
    
    mock_db = AsyncMock()
    mock_db.execute.return_value.scalars.return_value.all.return_value = []
    
    # Mock de predicciones ML en Redis
    predictions = [
        {"comuna": "Castilla", "risk_score": 100},
        {"comuna": "Aranjuez", "risk_score": 99},
        {"comuna": "La Candelaria", "risk_score": 98},
    ]
    
    with patch('app.services.chatbot.redis.from_url') as mock_redis:
        mock_redis_instance = AsyncMock()
        mock_redis_instance.get.return_value = json.dumps(predictions)
        mock_redis_instance.aclose = AsyncMock()
        mock_redis.return_value = mock_redis_instance
        
        context = await chatbot.build_context(mock_db)
    
    # Verificar que las predicciones están en el contexto
    top_5 = context["predicciones_ml"]["top_5_peligrosas"]
    assert len(top_5) == 3
    assert top_5[0]["comuna"] == "Castilla"
    assert top_5[0]["risk_score"] == 100


@pytest.mark.asyncio
async def test_ask_dangerous_zones(chatbot, mock_groq_client):
    """Test de intent detection para zonas peligrosas."""
    context = {
        "predicciones_ml": {
            "top_5_peligrosas": [
                {"comuna": "Castilla", "risk_score": 100},
                {"comuna": "Aranjuez", "risk_score": 99},
            ],
            "hora_actual": "10:00",
            "dia_actual": "Lunes"
        },
        "reportes_activos": [],
        "clima": {"temp_promedio": 20.0, "lluvia_prob_max": 50},
        "deprimidos_riesgo": 0,
        "total_reportes": 0
    }
    
    response = await chatbot.ask("¿Qué zonas evitar ahora?", context)
    
    # Verificar respuesta
    assert "answer" in response or "text" in response
    assert response["intent"] == "dangerous_zones"
    assert "structured_data" in response
    assert response["structured_data"]["predictions"]


@pytest.mark.asyncio
async def test_ask_weather(chatbot, mock_groq_client):
    """Test de intent detection para clima."""
    context = {
        "predicciones_ml": {
            "top_5_peligrosas": [],
            "hora_actual": "10:00",
            "dia_actual": "Lunes"
        },
        "reportes_activos": [],
        "clima": {"temp_promedio": 20.0, "lluvia_prob_max": 80},
        "deprimidos_riesgo": 0,
        "total_reportes": 0
    }
    
    response = await chatbot.ask("¿Cómo está el clima?", context)
    
    assert response["intent"] == "weather"
    assert response["structured_data"]["rain_probability"] == 80


def test_detect_intent_dangerous_zones(chatbot):
    """Test de detección de intent para zonas peligrosas."""
    assert chatbot._detect_intent("¿Qué zonas evitar?") == "dangerous_zones"
    assert chatbot._detect_intent("¿Dónde hay peligro?") == "dangerous_zones"
    assert chatbot._detect_intent("¿Qué zonas están pesadas?") == "dangerous_zones"


def test_detect_intent_weather(chatbot):
    """Test de detección de intent para clima."""
    assert chatbot._detect_intent("¿Cómo está el clima?") == "weather"
    assert chatbot._detect_intent("¿Va a llover?") == "weather"
    assert chatbot._detect_intent("¿Qué temperatura hay?") == "weather"


def test_detect_intent_route(chatbot):
    """Test de detección de intent para rutas."""
    assert chatbot._detect_intent("¿Cómo ir a Castilla?") == "route_suggestion"
    assert chatbot._detect_intent("¿Ruta al centro?") == "route_suggestion"


def test_dia_nombre(chatbot):
    """Test de conversión de día a nombre."""
    assert chatbot._dia_nombre(0) == "Lunes"
    assert chatbot._dia_nombre(6) == "Domingo"
    assert chatbot._dia_nombre(3) == "Jueves"


@pytest.mark.asyncio
async def test_ask_fallback_on_groq_error(chatbot):
    """Test que el fallback funciona cuando Groq falla."""
    # Hacer que Groq lance una excepción
    chatbot.client.chat.completions.create.side_effect = Exception("API Error")
    
    context = {
        "predicciones_ml": {
            "top_5_peligrosas": [
                {"comuna": "Castilla", "risk_score": 100},
                {"comuna": "Aranjuez", "risk_score": 99},
                {"comuna": "La Candelaria", "risk_score": 98},
            ],
            "hora_actual": "10:00",
            "dia_actual": "Lunes"
        },
        "reportes_activos": [],
        "clima": {"temp_promedio": 20.0, "lluvia_prob_max": 50},
        "deprimidos_riesgo": 0,
        "total_reportes": 5
    }
    
    response = await chatbot.ask("¿Qué zonas evitar?", context)
    
    # Verificar que el fallback funciona
    answer = response.get("text") or response.get("answer")
    assert "Castilla" in answer
    assert "Aranjuez" in answer
    assert "La Candelaria" in answer
