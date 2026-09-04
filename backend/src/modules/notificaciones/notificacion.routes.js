const { Router } = require("express");
const notificacionController = require("./notificacion.controller");
const { verifyToken, requireRole } = require("../../shared/middlewares/auth.middleware");
const router = Router();

router.use(verifyToken);
router.get("/", requireRole("Administrador"), notificacionController.obtenerTodas);
router.get("/permiso/:id_p", requireRole("Administrador"), notificacionController.obtenerPorPermiso);
router.get("/usuario/:id_u", notificacionController.obtenerPorUsuario);
router.get("/usuario/:id_u/no-leidas", notificacionController.contarNoLeidas);
router.post("/", requireRole("Administrador"), notificacionController.crear);
router.patch("/:id_n/leido", notificacionController.marcarLeido);
router.patch("/usuario/:id_u/leidas", notificacionController.marcarTodasLeidas);

module.exports = router;
