const express = require("express");
const crypto = require("crypto");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { env } = require("./config/env");
const { errorHandler } = require("./shared/middlewares/error.middleware");

// Rutas de módulos
const authRoutes = require("./modules/auth/auth.routes");
const trabajadorRoutes = require("./modules/trabajadores/trabajador.routes");
const userRoutes = require("./modules/usuarios/user.routes");
const permisoRoutes = require("./modules/permisos/permiso.routes");
const disciplinaRoutes = require("./modules/disciplinas/disciplina.routes");
const configuracionRoutes = require("./modules/configuracion/configuracion.routes");
const diasRoutes = require("./modules/dias_bloqueados/dias.routes");
const losaRoutes = require("./modules/losas/losa.routes");
const imagenesRoutes = require("./modules/imagenes/imagenes.routes");
const reniecRoutes = require("./modules/reniec/reniec.routes");
const notificacionRoutes = require("./modules/notificaciones/notificacion.routes");
const chatbotRoutes = require("./modules/chatbot/chatbot.routes");

const app = express();

// =========================================
// Pipeline Global
// =========================================

// Seguridad
app.use(helmet());
app.use(cookieParser(env.COOKIE_SECRET));

// Limita por sesión autenticada para que el SSR no agrupe a todos los usuarios
// bajo la misma IP. Las peticiones anónimas continúan limitándose por IP.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  keyGenerator: (req) => {
    const accessToken = req.signedCookies?.accessToken;
    if (accessToken) {
      const tokenHash = crypto.createHash("sha256").update(accessToken).digest("hex");
      return `session:${tokenHash}`;
    }
    return `ip:${ipKeyGenerator(req.ip)}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Demasiadas peticiones, intenta de nuevo en 15 minutos",
    code: "RATE_LIMITED",
  },
});
app.use(globalLimiter);

// CORS
const allowedOrigins = [
  env.CORS_ORIGIN,
  env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }
      callback(new Error("Origen no permitido por CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =========================================
// Health Check
// =========================================
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// =========================================
// Montado de módulos
// =========================================
app.use("/api/auth", authRoutes);
app.use("/api/trabajadores", trabajadorRoutes);
app.use("/api/users", userRoutes);
app.use("/api/permisos", permisoRoutes);
app.use("/api/disciplinas", disciplinaRoutes);
app.use("/api/losas", losaRoutes);
app.use("/api/imagenes", imagenesRoutes);
app.use("/api/configuracion", configuracionRoutes);
app.use("/api/dias-bloqueados", diasRoutes);
app.use("/api/reniec", reniecRoutes);
app.use("/api/notificaciones", notificacionRoutes);
app.use("/api/chatbot", chatbotRoutes);

// =========================================
// Manejador de errores (debe ir al final)
// =========================================
app.use(errorHandler);

// =========================================
// Inicio del servidor
// =========================================
const PORT = env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✓ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`✓ Health check en http://localhost:${PORT}/health`);
  console.log(`✓ Entorno: ${env.NODE_ENV}`);
});

module.exports = app;
