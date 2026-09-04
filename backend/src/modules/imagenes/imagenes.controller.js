const ImagenesService = require("./imagenes.service");
const { AppError } = require("../../shared/middlewares/error.middleware");

async function uploadImagen(req, res) {
  try {
    const { id_l } = req.body;
    const url = await ImagenesService.uploadImagen(req.file, Number(id_l));
    res.json({ message: "Imagen guardada correctamente", url });
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ message: error.message });
    res.status(500).json({ message: "Error en el servidor", error: error.message });
  }
}

async function getImagenes(req, res) {
  try {
    const data = await ImagenesService.getImagenes();
    res.json(data);
  } catch (error) {
    console.error("[IMAGENES ERROR] getImagenes:", error.message);
    res.status(500).json({ message: "Error al obtener imágenes", error: error.message });
  }
}

async function deleteImagen(req, res) {
  try {
    const { id_img } = req.params;
    await ImagenesService.deleteImagen(Number(id_img));
    res.json({ message: "Imagen eliminada correctamente" });
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ message: error.message });
    res.status(500).json({ message: "Error al eliminar la imagen" });
  }
}

module.exports = { uploadImagen, getImagenes, deleteImagen };
