const { env, isProd } = require("../../config/env");

/**
 * Clase de error personalizada con código HTTP
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = "AppError";
  }
}

/**
 * Manejador centralizado de errores.
 */
const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${err.name}: ${err.message}`);
  if (!isProd && err.stack) {
    console.error(err.stack);
  }

  // AppError personalizado
  if (err instanceof AppError) {
    const response = { message: err.message };
    if (err.code) response.code = err.code;
    if (err.conflicts) response.conflicts = err.conflicts;
    res.status(err.statusCode).json(response);
    return;
  }

  if (err.name === "MulterError" && err.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({ message: "El archivo no debe superar 10 MB", code: "FILE_TOO_LARGE" });
    return;
  }

  if (err.message === "Solo se permiten archivos PDF") {
    res.status(400).json({ message: err.message, code: "INVALID_FILE_TYPE" });
    return;
  }

  // Error de JWT
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    res.status(401).json({
      message: err.name === "TokenExpiredError" ? "Token expirado" : "Token inválido",
      code: err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "TOKEN_INVALID",
    });
    return;
  }

  // Error de sintaxis JSON
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ message: "JSON mal formado", code: "INVALID_JSON" });
    return;
  }

  // Error genérico
  res.status(500).json({
    message: isProd ? "Error interno del servidor" : err.message,
    code: "INTERNAL_ERROR",
    ...(isProd ? {} : { stack: err.stack }),
  });
};

module.exports = { AppError, errorHandler };
