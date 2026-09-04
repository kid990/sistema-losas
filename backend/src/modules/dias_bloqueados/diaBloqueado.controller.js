const DiaBloqueadoService = require("./diaBloqueado.service");

async function listarDias(req, res) {
  try {
    const dias = await DiaBloqueadoService.listarDias();
    res.json(dias);
  } catch (error) {
    console.error("Error al listar días bloqueados:", error);
    res.status(500).json({ message: "Error al listar días bloqueados" });
  }
}

async function crearDia(req, res) {
  try {
    const id = await DiaBloqueadoService.crearDia(req.body);
    res.status(201).json({ message: "Día bloqueado registrado correctamente", id });
  } catch (error) {
    if (error.message === "DUPLICATE_DATE") {
      return res.status(409).json({ message: "La fecha ya está registrada" });
    }
    res.status(500).json({ message: "Error al registrar día bloqueado" });
  }
}

async function eliminarDia(req, res) {
  try {
    await DiaBloqueadoService.eliminarDia(Number(req.params.id));
    res.json({ message: "Día bloqueado eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar día bloqueado:", error);
    res.status(500).json({ message: "Error al eliminar día bloqueado" });
  }
}

module.exports = { listarDias, crearDia, eliminarDia };
