const { Router } = require("express");
const multer = require("multer");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
    fields: 5,
    parts: 6,
    fieldNameSize: 50,
    fieldSize: 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    callback(file.mimetype === "application/pdf" ? null : new Error("Solo se permiten archivos PDF"), file.mimetype === "application/pdf");
  },
});
const permisoController = require("./permiso.controller");
const { verifyToken, requireRole } = require("../../shared/middlewares/auth.middleware");
const router = Router();

router.use(verifyToken);
router.post("/", upload.single("documento"), permisoController.registrarPermiso);
router.get("/", requireRole("Administrador"), permisoController.obtenerPermisos);
router.get("/bloqueados-detalle", permisoController.getAllPermisosDetalleBloqueados);
router.get("/aceptado-detalle", requireRole("Administrador", "Seguridad"), permisoController.getAllPermisosDetalleAceptados);
router.get("/aceptado", requireRole("Administrador", "Seguridad"), permisoController.getAllPermisosAceptados);
router.get("/detalles/:id_p", permisoController.obtenerDetallesPermisoEspecifico);
router.put("/:id/estado", requireRole("Administrador"), permisoController.actualizarEstado);
router.get("/:id/documento", permisoController.obtenerDocumento);
router.get("/usuario/:id_u", permisoController.obtenerPermisosPorUsuario);
router.post("/trabajador", requireRole("Administrador"), upload.single("documento"), permisoController.createPermisoTrabajador);

module.exports = router;
