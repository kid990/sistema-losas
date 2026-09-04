const { Router } = require("express");
const disciplinaController = require("./disciplina.controller");
const router = Router();

router.get("/", disciplinaController.listarDisciplinas);
router.get("/activas", disciplinaController.listarActivas);
router.post("/", disciplinaController.crearDisciplina);
router.get("/:id", disciplinaController.obtenerDisciplina);
router.put("/:id", disciplinaController.actualizarDisciplina);
router.delete("/:id", disciplinaController.eliminarDisciplina);
router.patch("/:id/estado", disciplinaController.cambiarEstado);

module.exports = router;
