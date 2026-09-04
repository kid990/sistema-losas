const PermisoService = require("./permiso.service");
const { AppError } = require("../../shared/middlewares/error.middleware");

async function registrarPermiso(req, res) {
  try {
    const { tipo, id_u, duracion_t, detalles } = req.body;
    if (req.user.tipo !== "usuario") throw new AppError("No autorizado", 403);
    const data = await PermisoService.registrarPermiso({
      tipo, id_u: Number(req.user.id), duracion_t: Number(duracion_t),
      detalles: typeof detalles === "string" ? JSON.parse(detalles) : detalles,
      file: req.file,
    });
    res.status(201).json({
      success: true,
      message: `Permiso ${tipo.toLowerCase()} ${data.estado.toLowerCase()} exitosamente`,
      data,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ success: false, message: error.message, conflicts: error.conflicts });
    }
    console.error("Error al registrar permiso:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

async function obtenerPermisos(req, res) {
  try {
    const { estado } = req.query;
    const data = await PermisoService.obtenerPermisos(estado);
    res.json({ success: true, data });
  } catch (error) {
    console.error("Error al obtener permisos:", error);
    res.status(500).json({ success: false, message: "Error al obtener permisos" });
  }
}

async function obtenerDetallesPermisoEspecifico(req, res) {
  try {
    const { id_p } = req.params;
    const userId = req.user.tipo === "usuario" ? Number(req.user.id) : undefined;
    const data = await PermisoService.obtenerDetallesPermisoEspecifico(Number(id_p), userId);
    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
    console.error("Error al obtener detalles del permiso:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
}

async function getAllPermisosDetalleBloqueados(req, res) {
  try {
    const data = await PermisoService.getAllPermisosDetalleBloqueados();
    res.json({ success: true, data });
  } catch (error) {
    console.error("Error al obtener horarios bloqueados:", error);
    res.status(500).json({ success: false, message: "Error al obtener horarios bloqueados" });
  }
}

async function getAllPermisosDetalleAceptados(req, res) {
  try {
    const data = await PermisoService.getAllPermisosDetalleAceptados();
    res.json({ success: true, data });
  } catch (error) {
    console.error("Error al obtener todos los permisos:", error);
    res.status(500).json({ success: false, message: "Error al obtener todos los permisos" });
  }
}

async function getAllPermisosAceptados(req, res) {
  try {
    const data = await PermisoService.getAllPermisosAceptados();
    res.json({ success: true, data });
  } catch (error) {
    console.error("Error al obtener todos los permisos:", error);
    res.status(500).json({ success: false, message: "Error al obtener todos los permisos" });
  }
}

async function actualizarEstado(req, res) {
  try {
    const id_p = Number(req.params.id);
    const { estado, id_t } = req.body;
    const data = await PermisoService.actualizarEstado(id_p, estado, Number(id_t));
    res.json(data);
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
    console.error("Error al actualizar permiso:", error);
    res.status(500).json({ success: false, message: "Error al actualizar permiso" });
  }
}

async function obtenerDocumento(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.tipo === "usuario" ? Number(req.user.id) : undefined;
    const url_drive = await PermisoService.obtenerDocumento(Number(id), userId);
    res.json({ success: true, message: "Documento encontrado", url_drive });
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
    console.error("Error en obtenerDocumento:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

async function obtenerPermisosPorUsuario(req, res) {
  try {
    const { id_u } = req.params;
    if (req.user.tipo === "usuario" && Number(req.user.id) !== Number(id_u)) {
      throw new AppError("No autorizado para consultar estos permisos", 403);
    }
    const data = await PermisoService.obtenerPermisosPorUsuario(Number(id_u));
    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
    console.error("Error al obtener historial de permisos:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
}

async function createPermisoTrabajador(req, res) {
  try {
    const { id_t, tipo, duracion_t, detalles } = req.body;
    const data = await PermisoService.createPermisoTrabajador({
      id_t: Number(id_t), tipo, duracion_t: Number(duracion_t),
      detalles: typeof detalles === "string" ? JSON.parse(detalles) : detalles,
    });
    res.status(201).json({ success: true, message: "Permiso registrado correctamente", data });
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
    console.error("Error al registrar permiso como trabajador:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

module.exports = { registrarPermiso, obtenerPermisos, obtenerDetallesPermisoEspecifico, getAllPermisosDetalleBloqueados, getAllPermisosDetalleAceptados, getAllPermisosAceptados, actualizarEstado, obtenerDocumento, obtenerPermisosPorUsuario, createPermisoTrabajador };
