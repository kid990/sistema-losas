const pool = require("../../config/db");
const { AppError } = require("../../shared/middlewares/error.middleware");

async function listarDisciplinas() {
  const [rows] = await pool.query("SELECT * FROM disciplinas ORDER BY id_d ASC");
  return rows;
}

async function listarActivas() {
  const [rows] = await pool.query("SELECT * FROM disciplinas WHERE estado = 'Activo' ORDER BY id_d ASC");
  return rows;
}

async function crearDisciplina(nombre) {
  const [rows] = await pool.query("SELECT id_d FROM disciplinas WHERE nombre = ? LIMIT 1", [nombre]);
  if (rows[0]) throw new AppError("El nombre ya está registrado", 400);
  const [result] = await pool.query("INSERT INTO disciplinas (nombre) VALUES (?)", [nombre]);
  return result.insertId;
}

async function obtenerDisciplina(id) {
  const [rows] = await pool.query("SELECT * FROM disciplinas WHERE id_d = ? LIMIT 1", [id]);
  if (!rows[0]) throw new AppError("No encontrada", 404);
  return rows[0];
}

async function actualizarDisciplina(id, nombre) {
  await pool.query("UPDATE disciplinas SET nombre = ? WHERE id_d = ?", [nombre, id]);
}

async function eliminarDisciplina(id) {
  await pool.query("DELETE FROM disciplinas WHERE id_d = ?", [id]);
}

async function cambiarEstado(id, estado) {
  if (!["Activo", "Inactivo"].includes(estado)) throw new AppError("Estado inválido. Use Activo o Inactivo", 400);
  const [result] = await pool.query("UPDATE disciplinas SET estado = ? WHERE id_d = ?", [estado, id]);
  if (result.affectedRows === 0) throw new AppError("Disciplina no encontrada", 404);
}

module.exports = { listarDisciplinas, listarActivas, crearDisciplina, obtenerDisciplina, actualizarDisciplina, eliminarDisciplina, cambiarEstado };
