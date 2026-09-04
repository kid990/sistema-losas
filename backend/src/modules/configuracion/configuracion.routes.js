const { Router } = require("express");
const configuracionController = require("./configuracion.controller");
const router = Router();

router.get("/", configuracionController.obtenerConfiguracion);
router.put("/", configuracionController.actualizarConfiguracion);

module.exports = router;
