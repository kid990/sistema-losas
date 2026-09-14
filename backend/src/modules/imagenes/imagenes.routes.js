const { Router } = require("express");
const multer = require("multer");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});
const imagenesController = require("./imagenes.controller");
const { verifyToken, requireRole } = require("../../shared/middlewares/auth.middleware");
const router = Router();

router.post("/upload", verifyToken, requireRole("Administrador"), upload.single("imagen"), imagenesController.uploadImagen);
router.get("/", imagenesController.getImagenes);
router.delete("/:id_img", verifyToken, requireRole("Administrador"), imagenesController.deleteImagen);

module.exports = router;
