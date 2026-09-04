const DisciplinaService = require("./disciplina.service");
const { AppError } = require("../../shared/middlewares/error.middleware");

async function listarDisciplinas(req, res) {
  try {
    const data = await DisciplinaService.listarDisciplinas();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al listar disciplinas" });
  }
}

async function listarActivas(req, res) {
  try {
    const data = await DisciplinaService.listarActivas();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al listar disciplinas activas" });
  }
}

async function crearDisciplina(req, res) {
  try {
    const { nombre } = req.body;
    const id = await DisciplinaService.crearDisciplina(nombre);
    res.status(201).json({ message: "Disciplina creada correctamente", id });
  } catch (err) {
    if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: "Error al crear disciplina" });
  }
}

async function obtenerDisciplina(req, res) {
  try {
    const id = Number(req.params.id);
    const data = await DisciplinaService.obtenerDisciplina(id);
    res.json(data);
  } catch (err) {
    if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: "Error al obtener disciplina" });
  }
}

async function actualizarDisciplina(req, res) {
  try {
    const id = Number(req.params.id);
    const { nombre } = req.body;
    await DisciplinaService.actualizarDisciplina(id, nombre);
    res.json({ message: "Disciplina actualizada correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al actualizar disciplina" });
  }
}

async function eliminarDisciplina(req, res) {
  try {
    const id = Number(req.params.id);
    await DisciplinaService.eliminarDisciplina(id);
    res.json({ message: "Disciplina eliminada correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al eliminar disciplina" });
  }
}

async function cambiarEstado(req, res) {
  try {
    const id = Number(req.params.id);
    const { estado } = req.body;
    await DisciplinaService.cambiarEstado(id, estado);
    res.json({ message: `Disciplina marcada como ${estado}` });
  } catch (err) {
    if (err instanceof AppError) return res.status(err.statusCode).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: "Error al cambiar estado de disciplina" });
  }
}

module.exports = { listarDisciplinas, listarActivas, crearDisciplina, obtenerDisciplina, actualizarDisciplina, eliminarDisciplina, cambiarEstado };
