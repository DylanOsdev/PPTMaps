"""Endpoints del chatbot IA."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.services.chatbot import get_chatbot

router = APIRouter()


class ChatRequest(BaseModel):
    """Request del chatbot."""
    question: str = Field(..., min_length=1, max_length=500, description="Pregunta del usuario")
    user_location: Optional[dict] = Field(None, description="Ubicación del usuario {lat, lng}")


class ChatResponse(BaseModel):
    """Response del chatbot."""
    answer: str = Field(..., description="Respuesta del chatbot")
    intent: str = Field(..., description="Intención detectada")
    structured_data: dict = Field(..., description="Datos estructurados relevantes")


@router.post("/ask", response_model=ChatResponse)
async def chatbot_ask(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db)
):
    """Pregunta al chatbot IA con datos en tiempo real.
    
    El chatbot responde usando:
    - Predicciones ML de congestión (XGBoost)
    - Reportes ciudadanos activos
    - Clima actual
    - Deprimidos en riesgo (SIATA)
    
    Ejemplos de preguntas:
    - "¿Qué zonas evitar ahora?"
    - "¿Es seguro ir a Castilla?"
    - "¿Cómo está el clima?"
    - "¿Hay reportes cerca?"
    """
    try:
        chatbot = get_chatbot()
    except ValueError as e:
        raise HTTPException(
            status_code=503,
            detail="Chatbot no disponible. GROQ_API_KEY no configurada."
        )
    
    # Construir contexto desde BD
    context = await chatbot.build_context(db, request.user_location)
    
    # Procesar pregunta
    response = await chatbot.ask(request.question, context)
    
    return ChatResponse(
        answer=response["text"],
        intent=response["intent"],
        structured_data=response["structured_data"]
    )
