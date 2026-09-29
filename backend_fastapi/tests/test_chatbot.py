from app.modules.chatbot.service import local_reply


def test_local_chatbot_reports_configured_hours() -> None:
    reply = local_reply("¿Cuáles son los horarios?", "07:00", "19:00")
    assert "07:00" in reply
    assert "19:00" in reply


def test_local_chatbot_rejects_unrelated_topics() -> None:
    reply = local_reply("Explícame cálculo diferencial", "07:00", "19:00")
    assert "solo puedo orientarte" in reply
