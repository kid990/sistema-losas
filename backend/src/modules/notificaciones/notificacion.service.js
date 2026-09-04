const pool = require("../../config/db");
const { AppError } = require("../../shared/middlewares/error.middleware");

async function obtenerTodas() {
  const [rows] = await pool.query("SELECT id_n, mensaje, fecha_envio, tipo, id_p, leido FROM notificacion ORDER BY fecha_envio DESC");
  return rows;
}

async function obtenerPorPermiso(id_p) {
  const [rows] = await pool.query(
    "SELECT id_n, mensaje, fecha_envio, tipo, id_p, leido FROM notificacion WHERE id_p = ? ORDER BY fecha_envio DESC",
    [id_p]
  );
  return rows;
}

async function obtenerPorUsuario(id_u) {
  const [rows] = await pool.query(
    `SELECT n.id_n, n.mensaje, n.fecha_envio, n.tipo, n.id_p, n.leido
     FROM notificacion n INNER JOIN permisos p ON n.id_p = p.id_p
     WHERE p.id_u = ? ORDER BY n.fecha_envio DESC`,
    [id_u]
  );
  return rows;
}

async function crear({ mensaje, tipo, id_p }) {
  if (!mensaje || !tipo || !id_p) throw new AppError("Faltan datos requeridos", 400);
  const [result] = await pool.query(
    "INSERT INTO notificacion (mensaje, tipo, id_p, leido) VALUES (?, ?, ?, FALSE)",
    [mensaje, tipo, id_p]
  );
  return result.insertId;
}

async function marcarLeido(id_n, id_u) {
  const ownerJoin = id_u ? " INNER JOIN permisos p ON n.id_p = p.id_p" : "";
  const ownerFilter = id_u ? " AND p.id_u = ?" : "";
  const params = id_u ? [id_n, id_u] : [id_n];
  const [result] = await pool.query(
    `UPDATE notificacion n${ownerJoin} SET n.leido = TRUE WHERE n.id_n = ?${ownerFilter}`,
    params
  );
  if (result.affectedRows === 0) throw new AppError("Notificación no encontrada", 404);
}

async function marcarTodasLeidas(id_u) {
  const [result] = await pool.query(
    `UPDATE notificacion n INNER JOIN permisos p ON n.id_p = p.id_p
     SET n.leido = TRUE WHERE p.id_u = ? AND n.leido = FALSE`,
    [id_u]
  );
  return result.affectedRows;
}

async function contarNoLeidas(id_u) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM notificacion n
     INNER JOIN permisos p ON n.id_p = p.id_p
     WHERE p.id_u = ? AND n.leido = FALSE`,
    [id_u]
  );
  return rows[0].total;
}

module.exports = { obtenerTodas, obtenerPorPermiso, obtenerPorUsuario, crear, marcarLeido, marcarTodasLeidas, contarNoLeidas };
