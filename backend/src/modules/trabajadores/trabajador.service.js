const bcrypt = require("bcryptjs");
const pool = require("../../config/db");
const { AppError } = require("../../shared/middlewares/error.middleware");

async function registrarTrabajador({ dni, nombres, apellidos, rol, email, password, telefono }) {
  const partes = (apellidos || "").trim().split(" ");
  const apellidoP = partes[0] || "";
  const apellidoM = partes.slice(1).join(" ") || "";

  const [rows] = await pool.query("SELECT id_t FROM trabajadores WHERE email = ? LIMIT 1", [email]);
  if (rows[0]) throw new AppError("El correo ya está registrado", 400);
  if (!password || password.length < 4) throw new AppError("La contraseña debe tener al menos 4 caracteres", 400);

  const hashedPassword = await bcrypt.hash(password, 10);
  const [result] = await pool.query(
    "INSERT INTO trabajadores (dni, nombres, apellido_p, apellido_m, rol, email, password, telefono) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [dni, nombres, apellidoP, apellidoM, rol, email, hashedPassword, telefono || null]
  );
  return result.insertId;
}

async function listarTrabajadores() {
  const [rows] = await pool.query("SELECT * FROM trabajadores");
  return rows;
}

async function editarTrabajador(id, { nombres, apellidos, rol, telefono }) {
  const partes = (apellidos || "").trim().split(" ");
  const apellidoP = partes[0] || "";
  const apellidoM = partes.slice(1).join(" ") || "";
  const [result] = await pool.query(
    "UPDATE trabajadores SET nombres = ?, apellido_p = ?, apellido_m = ?, rol = ?, telefono = ? WHERE id_t = ?",
    [nombres, apellidoP, apellidoM, rol, telefono || null, id]
  );
  if (result.affectedRows === 0) throw new AppError("Trabajador no encontrado", 404);
}

async function eliminarTrabajador(id) {
  const [result] = await pool.query("DELETE FROM trabajadores WHERE id_t = ?", [id]);
  if (result.affectedRows === 0) throw new AppError("Trabajador no encontrado", 404);
}

async function cambiarPassword(id, actualPassword, nuevaPassword) {
  const [rows] = await pool.query("SELECT password FROM trabajadores WHERE id_t = ? LIMIT 1", [id]);
  if (!rows[0]) throw new AppError("Trabajador no encontrado", 404);
  const coincide = await bcrypt.compare(actualPassword, rows[0].password);
  if (!coincide) throw new AppError("La contraseña actual es incorrecta", 400);
  const nuevoHash = await bcrypt.hash(nuevaPassword, 10);
  const [result] = await pool.query("UPDATE trabajadores SET password = ? WHERE id_t = ?", [nuevoHash, id]);
  if (result.affectedRows === 0) throw new AppError("Error al actualizar", 500);
}

async function obtenerTrabajador(id) {
  const [rows] = await pool.query("SELECT * FROM trabajadores WHERE id_t = ? LIMIT 1", [id]);
  if (!rows[0]) throw new AppError("Trabajador no encontrado", 404);
  return rows[0];
}

module.exports = { registrarTrabajador, listarTrabajadores, editarTrabajador, eliminarTrabajador, cambiarPassword, obtenerTrabajador };
