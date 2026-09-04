const { Router } = require("express");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
const imagenesController = require("./imagenes.controller");
const router = Router();

router.post("/upload", upload.single("imagen"), imagenesController.uploadImagen);
router.get("/", imagenesController.getImagenes);
router.delete("/:id_img", imagenesController.deleteImagen);

module.exports = router;
