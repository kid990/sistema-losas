const AuthService = require("./auth.service");
const {
  setAccessCookie,
  setRefreshCookie,
  clearAccessCookie,
  clearRefreshCookie,
  getRefreshCookie,
} = require("../../shared/middlewares/cookies");
const { AppError } = require("../../shared/middlewares/error.middleware");

function getReqInfo(req) {
  return {
    ip_address: req.ip || req.socket?.remoteAddress || null,
    user_agent: req.headers["user-agent"] || null,
  };
}

async function loginUsuario(req, res) {
  console.log("[AUTH] POST /login/usuario - Codigo:", req.body?.codigo?.substring(0, 5) + "***");
  try {
    const { codigo, password } = req.body;
    const reqInfo = getReqInfo(req);
    const data = await AuthService.loginUsuario({ codigo, password, reqInfo });
    setAccessCookie(res, data.token);
    setRefreshCookie(res, data.refreshToken);
    res.json({ message: "Login exitoso", expiresIn: data.expiresIn, user: data.user });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    console.error("[AUTH ERROR] loginUsuario:", error.message);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}

async function loginTrabajador(req, res) {
  console.log("[AUTH] POST /login/trabajador - Email:", req.body?.email?.substring(0, 5) + "***");
  try {
    const { email, password } = req.body;
    const reqInfo = getReqInfo(req);
    const data = await AuthService.loginTrabajador({ email, password, reqInfo });
    setAccessCookie(res, data.token);
    setRefreshCookie(res, data.refreshToken);
    res.json({ message: "Login exitoso", expiresIn: data.expiresIn, user: data.user });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    console.error("[AUTH ERROR] loginTrabajador:", error.message);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}

async function refreshToken(req, res) {
  try {
    const token = getRefreshCookie(req);
    const reqInfo = getReqInfo(req);
    const data = await AuthService.refreshToken(token, reqInfo);
    setAccessCookie(res, data.token);
    setRefreshCookie(res, data.refreshToken);
    res.json({ message: "Tokens renovados", expiresIn: data.expiresIn });
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === "SESSION_TERMINATED") {
        clearAccessCookie(res);
        clearRefreshCookie(res);
      }
      return res.status(error.statusCode).json({ message: error.message, code: error.code });
    }
    console.error("[AUTH ERROR] refreshToken:", error.message);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}

async function logout(req, res) {
  try {
    const token = getRefreshCookie(req);
    await AuthService.logout(token);
    clearAccessCookie(res);
    clearRefreshCookie(res);
    res.json({ message: "Sesión cerrada exitosamente" });
  } catch (error) {
    console.error("[AUTH ERROR] logout:", error.message);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}

async function forgotPassword(req, res) {
  try {
    const { identifier } = req.body;
    await AuthService.forgotPassword(identifier);
    res.json({ message: "Si el usuario existe, recibirás un correo con las instrucciones." });
  } catch (error) {
    console.error("[AUTH ERROR] forgotPassword:", error.message);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}

async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;
    await AuthService.resetPassword(token, newPassword);
    res.json({ message: "Contraseña actualizada exitosamente. Vuelve a iniciar sesión." });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error("[AUTH ERROR] resetPassword:", error.message);
    res.status(500).json({ message: "Error interno del servidor" });
  }
}

module.exports = {
  loginUsuario,
  loginTrabajador,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
};
