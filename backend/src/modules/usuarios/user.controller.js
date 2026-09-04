const UserService = require("./user.service");
const { AppError } = require("../../shared/middlewares/error.middleware");

async function cargarUsuarios(req, res) {
  try {
    const data = await UserService.cargarUsuarios();
    res.json({ success: true, message: "Carga masiva completada", data });
  } catch (error) {
    console.error("Error en carga masiva:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

async function cambiarEstado(req, res) {
  try {
    const { codigo, estado } = req.body;
    const data = await UserService.cambiarEstado(codigo, estado);
    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error("Error actualizando estado:", error);
    res.status(500).json({ success: false, message: "Error en base de datos" });
  }
}

async function listarUsers(req, res) {
  try {
    const data = await UserService.listarUsers();
    res.json({ success: true, data });
  } catch (err) {
    console.error("Error listando usuarios:", err);
    res.status(500).json({ success: false, message: "Error de servidor" });
  }
}

async function obtenerUsuario(req, res) {
  try {
    const { id } = req.params;
    const data = await UserService.obtenerUsuario(Number(id));
    res.json({ success: true, data });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    console.error("Error al obtener usuario:", err);
    res.status(500).json({ success: false, message: "Error de servidor" });
  }
}

async function cambiarPassword(req, res) {
  try {
    const id = Number(req.params.id);
    const { actualPassword, nuevaPassword } = req.body;
    await UserService.cambiarPassword(id, actualPassword, nuevaPassword);
    res.json({ message: "Contraseña actualizada correctamente" });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error(error);
    res.status(500).json({ message: "Error en el servidor" });
  }
}

module.exports = { cargarUsuarios, cambiarEstado, listarUsers, obtenerUsuario, cambiarPassword };
