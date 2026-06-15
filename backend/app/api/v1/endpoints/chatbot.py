from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.services.chatbot import ask_groq, process_intent, fallback_classify

router = APIRouter()


class AskRequest(BaseModel):
    message: str
    history: list | None = None


@router.post("/ask")
async def chatbot_ask(body: AskRequest, db: AsyncSession = Depends(get_db)):
    fallback = fallback_classify(body.message)

    if fallback:
        intent = fallback["intent"]
        params = fallback["params"]

        if intent in ("greeting", "unknown"):
            return {"answer": fallback["answer"], "intent": intent, "params": params, "layer_updates": []}

        if intent == "clarify":
            return {"answer": fallback["answer"], "intent": intent, "params": params, "layer_updates": []}

        enriched_answer, layer_updates = await process_intent(intent, params, db)
        return {"answer": enriched_answer, "intent": intent, "params": params, "layer_updates": layer_updates}

    groq_result = await ask_groq(body.message, body.history)
    intent = groq_result.get("intent", "unknown")
    params = groq_result.get("params", {})
    groq_answer = groq_result.get("answer", "")

    if intent in ("greeting", "unknown", "clarify"):
        return {"answer": groq_answer, "intent": intent, "params": params, "layer_updates": []}

    enriched_answer, layer_updates = await process_intent(intent, params, db)

    return {
        "answer": enriched_answer,
        "intent": intent,
        "params": params,
        "layer_updates": layer_updates,
    }
