const ConfiguracionService = require("./configuracion.service");

async function obtenerConfiguracion(req, res) {
  try {
    const config = await ConfiguracionService.obtenerConfiguracion();
    res.json(config);
  } catch (error) {
    console.error("Error al obtener configuración:", error);
    res.status(500).json({ error: "Error al obtener configuración" });
  }
}

async function actualizarConfiguracion(req, res) {
  try {
    await ConfiguracionService.actualizarConfiguracion(req.body);
    res.json({ mensaje: "Configuración actualizada" });
  } catch (error) {
    console.error("Error al actualizar configuración:", error);
    res.status(500).json({ error: "Error al actualizar configuración" });
  }
}

module.exports = { obtenerConfiguracion, actualizarConfiguracion };
