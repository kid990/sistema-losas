const LosaService = require("./losa.service");
const { AppError } = require("../../shared/middlewares/error.middleware");

async function obtenerLosas(req, res) {
  try {
    const losas = await LosaService.obtenerLosas();
    res.json(losas);
  } catch (err) {
    console.error("Error al obtener losas:", err);
    res.status(500).json({ error: "Error al obtener lista de losas" });
  }
}

async function crearLosa(req, res) {
  try {
    const nuevaId = await LosaService.crearLosa(req.body);
    res.status(201).json({ id: nuevaId });
  } catch (err) {
    console.error("Error al crear losa:", err);
    res.status(500).json({ error: "Error al crear losa" });
  }
}

async function actualizarLosa(req, res) {
  try {
    const { id } = req.params;
    await LosaService.actualizarLosa(Number(id), req.body);
    res.json({ mensaje: "Losa actualizada" });
  } catch (err) {
    console.error("Error al actualizar losa:", err);
    res.status(500).json({ error: "Error al actualizar losa" });
  }
}

async function eliminarLosa(req, res) {
  try {
    const { id } = req.params;
    await LosaService.eliminarLosa(Number(id));
    res.json({ mensaje: "Losa eliminada" });
  } catch (err) {
    console.error("Error al eliminar losa:", err);
    res.status(500).json({ error: "Error al eliminar losa" });
  }
}

async function obtenerLosasConDisciplinaYImagenes(req, res) {
  try {
    const { id_l } = req.params;
    const losaConDetalles = await LosaService.obtenerLosasConDisciplinaYImagenes(Number(id_l));
    res.json(losaConDetalles);
  } catch (err) {
    if (err instanceof AppError) return res.status(err.statusCode).json({ error: err.message });
    console.error("Error al obtener losa con disciplina e imágenes:", err);
    res.status(500).json({ error: "Error al obtener losa con disciplina e imágenes" });
  }
}

module.exports = { obtenerLosas, crearLosa, actualizarLosa, eliminarLosa, obtenerLosasConDisciplinaYImagenes };
