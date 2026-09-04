const { Router } = require("express");
const losaController = require("./losa.controller");
const router = Router();

router.get("/", losaController.obtenerLosas);
router.post("/", losaController.crearLosa);
router.put("/:id", losaController.actualizarLosa);
router.delete("/:id", losaController.eliminarLosa);
router.get("/losas-detalles/:id_l", losaController.obtenerLosasConDisciplinaYImagenes);

module.exports = router;
