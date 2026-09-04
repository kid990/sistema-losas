const { Router } = require("express");
const userController = require("./user.controller");
const router = Router();

router.post("/cargar", userController.cargarUsuarios);
router.put("/estado", userController.cambiarEstado);
router.get("/", userController.listarUsers);
router.get("/:id", userController.obtenerUsuario);
router.put("/password/:id", userController.cambiarPassword);

module.exports = router;
