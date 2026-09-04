const pool = require("../../config/db");

async function listarDias() {
  const [rows] = await pool.query("SELECT * FROM dias_bloqueados ORDER BY fecha DESC");
  return rows;
}

async function crearDia(data) {
  const { fecha, motivo } = data;
  const [existing] = await pool.query("SELECT id FROM dias_bloqueados WHERE fecha = ? LIMIT 1", [fecha]);
  if (existing[0]) throw new Error("DUPLICATE_DATE");
  const [result] = await pool.query("INSERT INTO dias_bloqueados (fecha, motivo) VALUES (?, ?)", [fecha, motivo]);
  return result.insertId;
}

async function eliminarDia(id) {
  await pool.query("DELETE FROM dias_bloqueados WHERE id = ?", [id]);
}

module.exports = { listarDias, crearDia, eliminarDia };
