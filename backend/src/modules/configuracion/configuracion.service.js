const pool = require("../../config/db");

async function obtenerConfiguracion() {
  let [rows] = await pool.query("SELECT * FROM configuracion_global WHERE id = 1 LIMIT 1");
  let config = rows[0];
  if (!config) {
    await pool.query("INSERT IGNORE INTO configuracion_global (id) VALUES (1)");
    [rows] = await pool.query("SELECT * FROM configuracion_global WHERE id = 1 LIMIT 1");
    config = rows[0];
  }
  return config;
}

async function actualizarConfiguracion(data) {
  await pool.query(
    `UPDATE configuracion_global SET
      hora_min_solicitud = ?, hora_max_solicitud = ?,
      hora_min_apertura = ?, hora_max_apertura = ?,
      restriccion_hoy = ?, max_horas_semana = ?
     WHERE id = 1`,
    [data.hora_min_solicitud, data.hora_max_solicitud, data.hora_min_apertura,
     data.hora_max_apertura, data.restriccion_hoy, data.max_horas_semana]
  );
}

module.exports = { obtenerConfiguracion, actualizarConfiguracion };
