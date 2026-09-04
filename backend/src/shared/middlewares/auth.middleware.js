const jwt = require("jsonwebtoken");
const { env } = require("../../config/env");

/**
 * Extrae el access token: primero desde la cookie firmada httpOnly,
 * con fallback a header Authorization Bearer.
 */
const verifyToken = (req, res, next) => {
  const cookieToken = req.signedCookies?.accessToken;
  const authHeader = req.headers["authorization"];
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  const token = cookieToken || bearerToken;

  if (!token) {
    return res.status(403).json({ message: "Token requerido" });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      if (cookieToken) res.clearCookie("accessToken");
      return res.status(401).json({ message: "Token expirado", code: "TOKEN_EXPIRED" });
    }
    return res.status(401).json({ message: "Token inválido" });
  }
};

/**
 * Middleware para requerir un rol específico
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({ message: "Token requerido" });
    }
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ message: "No tienes permisos para esta acción" });
    }
    next();
  };
};

module.exports = { verifyToken, requireRole };
