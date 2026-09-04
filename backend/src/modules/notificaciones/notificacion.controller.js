const NotificacionService = require("./notificacion.service");
const { AppError } = require("../../shared/middlewares/error.middleware");

async function obtenerTodas(req, res) {
  try {
    const notificaciones = await NotificacionService.obtenerTodas();
    res.json({ success: true, data: notificaciones });
  } catch (error) {
    console.error("Error al obtener notificaciones:", error);
    res.status(500).json({ success: false, message: "Error al obtener notificaciones" });
  }
}

async function obtenerPorPermiso(req, res) {
  try {
    const { id_p } = req.params;
    const notificaciones = await NotificacionService.obtenerPorPermiso(Number(id_p));
    res.json({ success: true, data: notificaciones });
  } catch (error) {
    console.error("Error al obtener notificaciones por permiso:", error);
    res.status(500).json({ success: false, message: "Error al obtener notificaciones" });
  }
}

async function obtenerPorUsuario(req, res) {
  try {
    const { id_u } = req.params;
    if (req.user.tipo === "usuario" && Number(req.user.id) !== Number(id_u)) {
      throw new AppError("No autorizado para consultar estas notificaciones", 403);
    }
    const notificaciones = await NotificacionService.obtenerPorUsuario(Number(id_u));
    res.json({ success: true, data: notificaciones });
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
    console.error("Error al obtener notificaciones por usuario:", error);
    res.status(500).json({ success: false, message: "Error al obtener notificaciones" });
  }
}

async function crear(req, res) {
  try {
    const { mensaje, tipo, id_p } = req.body;
    const id = await NotificacionService.crear({ mensaje, tipo, id_p });
    res.status(201).json({ success: true, data: { id_n: id }, message: "Notificación creada" });
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
    console.error("Error al crear notificación:", error);
    res.status(500).json({ success: false, message: "Error al crear notificación" });
  }
}

async function marcarLeido(req, res) {
  try {
    const { id_n } = req.params;
    const userId = req.user.tipo === "usuario" ? Number(req.user.id) : undefined;
    await NotificacionService.marcarLeido(Number(id_n), userId);
    res.json({ success: true, message: "Notificación marcada como leída" });
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
    console.error("Error al marcar como leída:", error);
    res.status(500).json({ success: false, message: "Error al actualizar notificación" });
  }
}

async function marcarTodasLeidas(req, res) {
  try {
    const { id_u } = req.params;
    if (req.user.tipo === "usuario" && Number(req.user.id) !== Number(id_u)) {
      throw new AppError("No autorizado para actualizar estas notificaciones", 403);
    }
    const cantidad = await NotificacionService.marcarTodasLeidas(Number(id_u));
    res.json({ success: true, message: `${cantidad} notificación(es) marcadas como leídas` });
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
    console.error("Error al marcar todas como leídas:", error);
    res.status(500).json({ success: false, message: "Error al actualizar notificaciones" });
  }
}

async function contarNoLeidas(req, res) {
  try {
    const { id_u } = req.params;
    if (req.user.tipo === "usuario" && Number(req.user.id) !== Number(id_u)) {
      throw new AppError("No autorizado para consultar estas notificaciones", 403);
    }
    const total = await NotificacionService.contarNoLeidas(Number(id_u));
    res.json({ success: true, data: { total } });
  } catch (error) {
    if (error instanceof AppError) return res.status(error.statusCode).json({ success: false, message: error.message });
    console.error("Error al contar no leídas:", error);
    res.status(500).json({ success: false, message: "Error al contar notificaciones" });
  }
}

module.exports = { obtenerTodas, obtenerPorPermiso, obtenerPorUsuario, crear, marcarLeido, marcarTodasLeidas, contarNoLeidas };
