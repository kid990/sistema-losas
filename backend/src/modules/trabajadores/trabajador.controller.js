const TrabajadorService = require("./trabajador.service");
const { AppError } = require("../../shared/middlewares/error.middleware");

async function registrarTrabajador(req, res) {
  try {
    const insertId = await TrabajadorService.registrarTrabajador(req.body);
    res.status(201).json({ message: "Trabajador registrado", id: insertId });
  } catch (err) {
    if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: "Error al registrar trabajador" });
  }
}

async function listarTrabajadores(req, res) {
  try {
    const trabajadores = await TrabajadorService.listarTrabajadores();
    res.json(trabajadores);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener trabajadores" });
  }
}

async function editarTrabajador(req, res) {
  try {
    await TrabajadorService.editarTrabajador(Number(req.params.id), req.body);
    res.json({ message: "Trabajador actualizado correctamente" });
  } catch (err) {
    if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: "Error al actualizar trabajador" });
  }
}

async function eliminarTrabajador(req, res) {
  try {
    await TrabajadorService.eliminarTrabajador(Number(req.params.id));
    res.json({ message: "Trabajador eliminado correctamente" });
  } catch (err) {
    if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: "Error al eliminar trabajador" });
  }
}

async function cambiarPassword(req, res) {
  try {
    const { actualPassword, nuevaPassword } = req.body;
    await TrabajadorService.cambiarPassword(Number(req.params.id), actualPassword, nuevaPassword);
    res.json({ message: "Contraseña actualizada correctamente" });
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ message: error.message });
    console.error(error);
    res.status(500).json({ message: "Error en el servidor" });
  }
}

async function obtenerTrabajador(req, res) {
  try {
    const dato = await TrabajadorService.obtenerTrabajador(Number(req.params.id));
    res.status(200).json({ success: true, data: dato });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error al obtener trabajador" });
  }
}

module.exports = { registrarTrabajador, listarTrabajadores, editarTrabajador, eliminarTrabajador, cambiarPassword, obtenerTrabajador };
