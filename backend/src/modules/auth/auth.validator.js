const { z } = require("zod");

const loginUsuarioSchema = z.object({
  codigo: z.string().min(1, "El código es requerido").max(15, "El código es muy largo"),
  password: z.string().min(1, "La contraseña es requerida"),
});

const loginTrabajadorSchema = z.object({
  email: z.string().min(1, "El correo es requerido").email("El correo no es válido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

const forgotPasswordSchema = z.object({
  identifier: z.string().min(1, "El identificador es requerido"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "El token es requerido"),
  newPassword: z.string().min(6, "La nueva contraseña debe tener al menos 6 caracteres"),
});

module.exports = {
  loginUsuarioSchema,
  loginTrabajadorSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
