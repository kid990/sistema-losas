from fastapi import APIRouter, Request

from app.core.database import DBSession
from app.core.exceptions import AppError
from app.core.rate_limit import limiter
from app.modules.chatbot import service
from app.modules.chatbot.schemas import ChatRequest

router = APIRouter(prefix="/chatbot", tags=["LosaBot"])


@router.post("/")
async def send_message(payload: ChatRequest, request: Request, db: DBSession) -> dict[str, str]:
    client_ip = request.client.host if request.client else "unknown"
    if not await limiter.hit(f"chatbot:{client_ip}", 20, 60):
        raise AppError(
            "Has enviado demasiados mensajes. Espera un momento antes de continuar.",
            429,
            "CHATBOT_RATE_LIMITED",
        )
    reply, source = await service.chat(db, payload.message.strip(), payload.history)
    return service.response_payload(reply, source)
