const { Router } = require("express");
const rateLimit = require("express-rate-limit");
const { validateBody } = require("../../shared/middlewares/validation.middleware");
const {
  loginUsuarioSchema,
  loginTrabajadorSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require("./auth.validator");
const authController = require("./auth.controller");

const router = Router();

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Demasiadas peticiones desde esta IP, por favor intenta de nuevo en 15 minutos.",
    code: "RATE_LIMITED",
  },
});

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Has superado el límite de 3 intentos fallidos. Tu cuenta está bloqueada temporalmente por 15 minutos.",
    code: "LOGIN_RATE_LIMITED",
  },
});

router.use(authRateLimiter);
router.post("/login/usuario", loginRateLimiter, validateBody(loginUsuarioSchema), authController.loginUsuario);
router.post("/login/trabajador", loginRateLimiter, validateBody(loginTrabajadorSchema), authController.loginTrabajador);
router.post("/refresh", authController.refreshToken);
router.post("/logout", authController.logout);
router.post("/forgot-password", validateBody(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password", validateBody(resetPasswordSchema), authController.resetPassword);

module.exports = router;
