const { Router } = require("express");
const diaBloqueadoController = require("./diaBloqueado.controller");
const router = Router();

router.get("/", diaBloqueadoController.listarDias);
router.post("/", diaBloqueadoController.crearDia);
router.delete("/:id", diaBloqueadoController.eliminarDia);

module.exports = router;
