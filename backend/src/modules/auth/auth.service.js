const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const pool = require("../../config/db");
const { env } = require("../../config/env");
const { AppError } = require("../../shared/middlewares/error.middleware");
const { enviarCorreo } = require("../../utils/email");

const REFRESH_TOKEN_EXPIRY_SECONDS = env.REFRESH_TOKEN_TTL_DIAS * 24 * 60 * 60;

function generateTokens(payload) {
  const accessToken = jwt.sign({ ...payload }, env.JWT_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
  });
  const refreshToken = jwt.sign(
    {
      user_id: payload.id,
      user_type: payload.tipo,
      type: "refresh",
      jti: crypto.randomUUID(),
    },
    env.JWT_REFRESH_SECRET,
    { expiresIn: `${env.REFRESH_TOKEN_TTL_DIAS}d` }
  );
  return { accessToken, refreshToken };
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function parseUserAgent(ua) {
  const result = { device_name: "Ordenador", browser: "Otro", operating_system: "Otro" };
  if (!ua) return result;
  if (ua.includes("Chrome") && !ua.includes("Edg")) result.browser = "Chrome";
  else if (ua.includes("Firefox")) result.browser = "Firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) result.browser = "Safari";
  else if (ua.includes("Edg")) result.browser = "Edge";
  else if (ua.includes("OPR") || ua.includes("Opera")) result.browser = "Opera";
  if (ua.includes("Windows")) result.operating_system = "Windows";
  else if (ua.includes("Mac OS")) result.operating_system = "macOS";
  else if (ua.includes("Linux") && !ua.includes("Android")) result.operating_system = "Linux";
  else if (ua.includes("Android")) result.operating_system = "Android";
  else if (ua.includes("iOS") || ua.includes("iPhone") || ua.includes("iPad")) result.operating_system = "iOS";
  if (ua.includes("Mobile") || ua.includes("Android")) result.device_name = "Móvil";
  else if (ua.includes("iPad") || ua.includes("Tablet")) result.device_name = "Tablet";
  return result;
}

async function loginUsuario({ codigo, password, reqInfo }) {
  if (!codigo) throw new AppError("Código requerido", 400);

  const [rows] = await pool.query("SELECT * FROM users WHERE codigo = ? LIMIT 1", [codigo]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new AppError("Credenciales incorrectas", 401);
  }
  if (user.estado === "Inactivo") {
    throw new AppError("Tu cuenta está desactivada. Contacta al administrador.", 403);
  }

  await pool.query(
    "UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND user_type = 'usuario' AND revoked_at IS NULL",
    [user.id_u]
  );

  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000);
  const payload = { id: user.id_u, codigo: user.codigo, nombre: user.codigo, rol: user.rol, tipo: "usuario" };
  const { accessToken, refreshToken } = generateTokens(payload);
  const parsed = parseUserAgent(reqInfo.user_agent);

  await pool.query(
    `INSERT INTO user_sessions (user_id, user_type, refresh_token_hash, device_name, browser, operating_system, user_agent, ip_address, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [user.id_u, "usuario", hashToken(refreshToken), parsed.device_name, parsed.browser, parsed.operating_system,
     reqInfo.user_agent, reqInfo.ip_address, expiresAt]
  );

  return {
    token: accessToken, refreshToken, expiresIn: 15 * 60,
    user: { id: user.id_u, codigo: user.codigo, nombre: user.codigo, rol: user.rol, tipo: "usuario" },
  };
}

async function loginTrabajador({ email, password, reqInfo }) {
  if (!email) throw new AppError("Email requerido", 400);

  const [rows] = await pool.query("SELECT * FROM trabajadores WHERE email = ? LIMIT 1", [email]);
  const trab = rows[0];
  if (!trab || !(await bcrypt.compare(password, trab.password))) {
    throw new AppError("Credenciales incorrectas", 401);
  }
  if (trab.estado === "Inactivo") {
    throw new AppError("Tu cuenta está desactivada. Contacta al administrador.", 403);
  }

  await pool.query(
    "UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND user_type = 'trabajador' AND revoked_at IS NULL",
    [trab.id_t]
  );

  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000);
  const payload = { id: trab.id_t, email: trab.email, nombre: trab.nombres, rol: trab.rol, tipo: "trabajador" };
  const { accessToken, refreshToken } = generateTokens(payload);
  const parsed = parseUserAgent(reqInfo.user_agent);

  await pool.query(
    `INSERT INTO user_sessions (user_id, user_type, refresh_token_hash, device_name, browser, operating_system, user_agent, ip_address, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [trab.id_t, "trabajador", hashToken(refreshToken), parsed.device_name, parsed.browser, parsed.operating_system,
     reqInfo.user_agent, reqInfo.ip_address, expiresAt]
  );

  return {
    token: accessToken, refreshToken, expiresIn: 15 * 60,
    user: { id: trab.id_t, email: trab.email, nombre: trab.nombres, rol: trab.rol, tipo: "trabajador" },
  };
}

async function refreshToken(refreshToken, reqInfo) {
  if (!refreshToken) throw new AppError("Refresh token requerido", 400);

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError("Refresh token inválido o expirado", 401);
  }
  if (decoded.type !== "refresh") throw new AppError("Token inválido", 401);

  const tokenHash = hashToken(refreshToken);
  const [sessions] = await pool.query(
    "SELECT * FROM user_sessions WHERE refresh_token_hash = ? AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1",
    [tokenHash]
  );
  const session = sessions[0];
  if (!session) {
    throw new AppError("Sesión cerrada. Has iniciado sesión en otro dispositivo.", 401, "SESSION_TERMINATED");
  }
  if (session.user_id !== decoded.user_id || session.user_type !== decoded.user_type) {
    throw new AppError("Sesión inválida", 401);
  }

  await pool.query("UPDATE user_sessions SET revoked_at = NOW() WHERE id = ?", [session.id]);

  let payload;
  if (session.user_type === "usuario") {
    const [rows] = await pool.query("SELECT * FROM users WHERE id_u = ? LIMIT 1", [session.user_id]);
    const user = rows[0];
    if (!user) throw new AppError("Usuario no encontrado", 404);
    payload = { id: user.id_u, codigo: user.codigo, nombre: user.codigo, rol: user.rol, tipo: "usuario" };
  } else {
    const [rows] = await pool.query("SELECT * FROM trabajadores WHERE id_t = ? LIMIT 1", [session.user_id]);
    const trab = rows[0];
    if (!trab) throw new AppError("Trabajador no encontrado", 404);
    payload = { id: trab.id_t, email: trab.email, nombre: trab.nombres, rol: trab.rol, tipo: "trabajador" };
  }

  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000);
  const tokens = generateTokens(payload);
  const parsed = parseUserAgent(reqInfo.user_agent);

  await pool.query(
    `INSERT INTO user_sessions (user_id, user_type, refresh_token_hash, device_name, browser, operating_system, user_agent, ip_address, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [session.user_id, session.user_type, hashToken(tokens.refreshToken), parsed.device_name, parsed.browser,
     parsed.operating_system, reqInfo.user_agent || session.user_agent, reqInfo.ip_address, expiresAt]
  );

  return { token: tokens.accessToken, refreshToken: tokens.refreshToken, expiresIn: 15 * 60 };
}

async function logout(refreshToken) {
  if (!refreshToken) return;
  const tokenHash = hashToken(refreshToken);
  const [sessions] = await pool.query("SELECT id FROM user_sessions WHERE refresh_token_hash = ? LIMIT 1", [tokenHash]);
  if (sessions[0]) {
    await pool.query("UPDATE user_sessions SET revoked_at = NOW() WHERE id = ?", [sessions[0].id]);
  }
}

async function forgotPassword(identifier) {
  if (!identifier) return;
  const isEmail = identifier.includes("@");
  let userId = null, userType = null, userEmail = null, userNombre = "";

  if (isEmail) {
    const [rows] = await pool.query("SELECT * FROM trabajadores WHERE email = ? LIMIT 1", [identifier]);
    if (rows[0]) {
      userId = rows[0].id_t; userType = "trabajador"; userEmail = rows[0].email; userNombre = rows[0].nombres;
    }
  } else {
    const [rows] = await pool.query("SELECT * FROM users WHERE codigo = ? LIMIT 1", [identifier]);
    if (rows[0]) { userId = rows[0].id_u; userType = "usuario"; }
  }

  if (!userId || !userEmail || !userType) return;

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await pool.query(
    "UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND user_type = ? AND used_at IS NULL",
    [userId, userType]
  );
  await pool.query(
    "INSERT INTO password_reset_tokens (user_id, user_type, token_hash, expires_at) VALUES (?, ?, ?, ?)",
    [userId, userType, tokenHash, expiresAt]
  );

  const resetLink = `${env.FRONTEND_URL}/reset-password?token=${token}`;
  await enviarCorreo({
    para: userEmail, asunto: "Recuperación de contraseña - Sistema UNHEVAL",
    texto: `Hola ${userNombre},\n\nHas solicitado restablecer tu contraseña. Haz clic en el siguiente enlace:\n${resetLink}\n\nEste enlace expira en 60 minutos.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px;"><h2 style="color:#1B6EB6;margin-bottom:16px;">Recuperación de contraseña</h2><p>Hola <strong>${userNombre}</strong>,</p><p>Has solicitado restablecer tu contraseña. Haz clic en el botón de abajo:</p><div style="text-align:center;margin:24px 0;"><a href="${resetLink}" style="display:inline-block;padding:12px 32px;background:#1B6EB6;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Restablecer contraseña</a></div></div>`,
  }).catch((e) => console.warn(`Error enviando correo reset: ${e.message}`));
}

async function resetPassword(token, newPassword) {
  if (!token || !newPassword) throw new AppError("Token y nueva contraseña requeridos", 400);
  if (newPassword.length < 6) throw new AppError("La contraseña debe tener al menos 6 caracteres", 400);

  const tokenHash = hashToken(token);
  const [rows] = await pool.query(
    "SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW() LIMIT 1",
    [tokenHash]
  );
  const resetToken = rows[0];
  if (!resetToken) throw new AppError("Token inválido o expirado", 401);

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  if (resetToken.user_type === "usuario") {
    await pool.query("UPDATE users SET password = ? WHERE id_u = ?", [hashedPassword, resetToken.user_id]);
  } else {
    await pool.query("UPDATE trabajadores SET password = ? WHERE id_t = ?", [hashedPassword, resetToken.user_id]);
  }

  await pool.query(
    "UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND user_type = ? AND revoked_at IS NULL",
    [resetToken.user_id, resetToken.user_type]
  );
  await pool.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?", [resetToken.id]);
}

module.exports = {
  loginUsuario,
  loginTrabajador,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
};
