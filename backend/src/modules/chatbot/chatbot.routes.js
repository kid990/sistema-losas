const { Router } = require("express");
const rateLimit = require("express-rate-limit");
const chatbotController = require("./chatbot.controller");

const router = Router();

// Rate limiter específico para el chatbot: 20 mensajes por minuto por IP
const chatbotRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message:
      "Has enviado demasiados mensajes. Por favor, espera un momento antes de intentar de nuevo.",
    code: "CHATBOT_RATE_LIMITED",
  },
});

router.use(chatbotRateLimiter);
router.post("/", chatbotController.sendMessage);

module.exports = router;
