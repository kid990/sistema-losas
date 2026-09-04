const pool = require("../../config/db");
const { AppError } = require("../../shared/middlewares/error.middleware");
const { uploadFile } = require("../../utils/storage");

async function uploadImagen(file, id_l) {
  if (!file) throw new AppError("No se subió ninguna imagen", 400);
  if (!id_l) throw new AppError("Falta el ID de la losa", 400);

  const uploadResult = await uploadFile(file);
  await pool.query("INSERT INTO imagenes (nombre, url, id_l) VALUES (?, ?, ?)", [file.originalname, uploadResult.url, id_l]);
  return uploadResult.url;
}

async function getImagenes() {
  const [rows] = await pool.query(
    `SELECT i.id_img, i.nombre AS nombre_imagen, i.url, i.id_l, i.created_at, l.nombre AS nombre_losa
     FROM imagenes i LEFT JOIN losas l ON i.id_l = l.id_l ORDER BY i.created_at DESC`
  );
  return rows.map((img) => ({
    id_img: img.id_img,
    nombre_imagen: img.nombre_imagen,
    nombre_losa: img.nombre_losa,
    id_l: img.id_l,
    foto: img.url,
  }));
}

async function deleteImagen(id_img) {
  const [result] = await pool.query("DELETE FROM imagenes WHERE id_img = ?", [id_img]);
  if (result.affectedRows === 0) throw new AppError("Imagen no encontrada", 404);
}

module.exports = { uploadImagen, getImagenes, deleteImagen };
