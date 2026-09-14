const pool = require("../../config/db");
const { env } = require("../../config/env");
const { AppError } = require("../../shared/middlewares/error.middleware");
const {
  deleteFile,
  getObjectKey,
  getSignedDownloadUrl,
  getSignedStoredObjectUrl,
  uploadFile,
} = require("../../utils/storage");

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function isValidImage(file) {
  if (!file?.buffer || file.size === 0 || file.size > MAX_IMAGE_SIZE) return false;
  const isJpeg = file.buffer.length >= 3 && file.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  const isPng = file.buffer.length >= 8 && file.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return (file.mimetype === "image/jpeg" && isJpeg) || (file.mimetype === "image/png" && isPng);
}

async function uploadImagen(file, id_l) {
  if (!file) throw new AppError("No se subió ninguna imagen", 400);
  if (!id_l) throw new AppError("Falta el ID de la losa", 400);
  if (!isValidImage(file)) {
    throw new AppError("Solo se permiten imágenes JPG o PNG válidas de hasta 5 MB", 400);
  }

  const uploadResult = await uploadFile(file, env.S3_IMAGE_KEY_PREFIX);
  try {
    await pool.query("INSERT INTO imagenes (nombre, url, id_l) VALUES (?, ?, ?)", [file.originalname, uploadResult.url, id_l]);
  } catch (error) {
    await deleteFile(uploadResult.key).catch(() => {});
    throw error;
  }
  return getSignedDownloadUrl(uploadResult.key);
}

async function getImagenes() {
  const [rows] = await pool.query(
    `SELECT i.id_img, i.nombre AS nombre_imagen, i.url, i.id_l, i.created_at, l.nombre AS nombre_losa
     FROM imagenes i LEFT JOIN losas l ON i.id_l = l.id_l ORDER BY i.created_at DESC`
  );
  return Promise.all(
    rows.map(async (img) => ({
      id_img: img.id_img,
      nombre_imagen: img.nombre_imagen,
      nombre_losa: img.nombre_losa,
      id_l: img.id_l,
      foto: await getSignedStoredObjectUrl(img.url),
    }))
  );
}

async function deleteImagen(id_img) {
  const [rows] = await pool.query("SELECT url FROM imagenes WHERE id_img = ? LIMIT 1", [id_img]);
  if (!rows[0]) throw new AppError("Imagen no encontrada", 404);
  const key = getObjectKey(rows[0].url);
  if (key) await deleteFile(key);
  await pool.query("DELETE FROM imagenes WHERE id_img = ?", [id_img]);
}

module.exports = { uploadImagen, getImagenes, deleteImagen };
