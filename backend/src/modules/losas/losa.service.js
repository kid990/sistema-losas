const pool = require("../../config/db");
const { AppError } = require("../../shared/middlewares/error.middleware");
const { getSignedStoredObjectUrl } = require("../../utils/storage");

async function obtenerLosas() {
  const [rows] = await pool.query(
    `SELECT l.*, d.nombre AS nombre_disciplina 
     FROM losas l INNER JOIN disciplinas d ON l.id_d = d.id_d`
  );
  return rows;
}

async function obtenerLosaPorId(id) {
  const [rows] = await pool.query("SELECT * FROM losas WHERE id_l = ? LIMIT 1", [id]);
  return rows[0] || null;
}

async function crearLosa(data) {
  const estadoFinal = data.estado || "Disponible";
  const [result] = await pool.query(
    "INSERT INTO losas (nombre, numero_l, ubicacion, dimensiones, superficie, iluminacion, id_d, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [data.nombre, data.numero_l, data.ubicacion, data.dimensiones || null, data.superficie || null, data.iluminacion || null, data.id_d, estadoFinal]
  );
  return result.insertId;
}

async function actualizarLosa(id, data) {
  await pool.query(
    "UPDATE losas SET nombre = ?, numero_l = ?, ubicacion = ?, dimensiones = ?, superficie = ?, iluminacion = ?, id_d = ?, estado = COALESCE(?, estado) WHERE id_l = ?",
    [data.nombre, data.numero_l, data.ubicacion, data.dimensiones, data.superficie, data.iluminacion, data.id_d, data.estado || null, id]
  );
}

async function eliminarLosa(id) {
  await pool.query("DELETE FROM losas WHERE id_l = ?", [id]);
}

async function obtenerLosasConDisciplinaYImagenes(id_l) {
  const [rows] = await pool.query("SELECT * FROM losas WHERE id_l = ? LIMIT 1", [id_l]);
  const losa = rows[0];
  if (!losa) throw new AppError("Losa no encontrada", 404);

  const [disciplinas] = await pool.query("SELECT * FROM disciplinas WHERE id_d = ? LIMIT 1", [losa.id_d]);
  const [imagenesList] = await pool.query("SELECT * FROM imagenes WHERE id_l = ?", [losa.id_l]);

  return {
    ...losa,
    nombre_disciplina: disciplinas[0] ? disciplinas[0].nombre : "Sin disciplina",
    imagenes: await Promise.all(
      imagenesList.map(async (img) => ({
        id_img: img.id_img,
        nombre_imagen: img.nombre,
        foto: await getSignedStoredObjectUrl(img.url),
      }))
    ),
  };
}

module.exports = { obtenerLosas, obtenerLosaPorId, crearLosa, actualizarLosa, eliminarLosa, obtenerLosasConDisciplinaYImagenes };
