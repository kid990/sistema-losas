const { Router } = require("express");
const trabajadorController = require("./trabajador.controller");
const router = Router();

router.post("/", trabajadorController.registrarTrabajador);
router.get("/", trabajadorController.listarTrabajadores);
router.put("/:id", trabajadorController.editarTrabajador);
router.delete("/:id", trabajadorController.eliminarTrabajador);
router.put("/password/:id", trabajadorController.cambiarPassword);
router.get("/:id", trabajadorController.obtenerTrabajador);

module.exports = router;
