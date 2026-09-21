const ChatbotService = require("./chatbot.service");
const { AppError } = require("../../shared/middlewares/error.middleware");

/**
 * POST /api/chatbot
 * Body: { message: string, history?: Array<{role, parts}> }
 */
async function sendMessage(req, res) {
  try {
    const { message, history } = req.body;

    // Validación básica del mensaje
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        message: "El mensaje es requerido y debe ser un texto válido.",
        code: "INVALID_MESSAGE",
      });
    }

    // Limitar longitud del mensaje para evitar abusos
    const trimmedMessage = message.trim();
    if (trimmedMessage.length > 500) {
      return res.status(400).json({
        message: "El mensaje no debe exceder los 500 caracteres.",
        code: "MESSAGE_TOO_LONG",
      });
    }

    // Validar y limitar historial (máximo últimos 10 turnos para conservar contexto sin gastar tokens)
    let sanitizedHistory = [];
    if (Array.isArray(history)) {
      sanitizedHistory = history
        .filter(
          (entry) =>
            entry &&
            typeof entry.role === "string" &&
            ["user", "model"].includes(entry.role) &&
            Array.isArray(entry.parts) &&
            entry.parts.length > 0 &&
            typeof entry.parts[0]?.text === "string"
        )
        .slice(-10);
    }

    const reply = await ChatbotService.chat(trimmedMessage, sanitizedHistory);

    res.json({
      reply,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AppError) {
      return res
        .status(error.statusCode)
        .json({ message: error.message, code: error.code });
    }

    console.error("[CHATBOT ERROR]", error.message);

    // Fallback amigable cuando Gemini falla
    res.status(503).json({
      message:
        "LosaBot no está disponible en este momento. Por favor, intenta de nuevo en unos segundos.",
      code: "CHATBOT_UNAVAILABLE",
    });
  }
}

module.exports = { sendMessage };
