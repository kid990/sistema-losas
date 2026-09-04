const bcrypt = require("bcryptjs");
const axios = require("axios");
const pool = require("../../config/db");
const { AppError } = require("../../shared/middlewares/error.middleware");

async function procesarLote(lote, rol) {
  const resultados = { creados: 0, existentes: 0, errores: 0, detalles: [] };
  for (const reg of lote) {
    try {
      const { codigo, dni } = reg;
      if (!codigo || !dni) {
        resultados.errores++;
        resultados.detalles.push({ codigo, error: "Campos faltantes" });
        continue;
      }
      const [rows] = await pool.query("SELECT id_u FROM users WHERE codigo = ? LIMIT 1", [codigo]);
      if (rows[0]) {
        resultados.existentes++;
        continue;
      }
      const hash = await bcrypt.hash(codigo, 10);
      await pool.query("INSERT INTO users (codigo, password, rol) VALUES (?, ?, ?)", [codigo, hash, rol]);
      resultados.creados++;
    } catch (error) {
      resultados.errores++;
      resultados.detalles.push({ codigo: reg.codigo, error: error.message });
    }
  }
  return resultados;
}

async function cargarUsuarios() {
  const url = "http://localhost:3001/api/usuarios";
  const reporteFinal = {
    totalProcesados: 0, totalCreados: 0, totalExistentes: 0, totalErrores: 0,
    roles: {}, erroresDetalles: [],
  };

  const { data } = await axios.get(url);
  const registros = Array.isArray(data?.data) ? data.data : [];

  const registrosPorRol = {};
  for (const reg of registros) {
    const rol = reg.rol || "Alumno";
    if (!registrosPorRol[rol]) registrosPorRol[rol] = [];
    registrosPorRol[rol].push(reg);
  }

  for (const [rol, regs] of Object.entries(registrosPorRol)) {
    reporteFinal.roles[rol] = { procesados: 0, creados: 0, existentes: 0, errores: 0, detalles: [] };
    const TAMANO_LOTE = 10;
    for (let i = 0; i < regs.length; i += TAMANO_LOTE) {
      const lote = regs.slice(i, i + TAMANO_LOTE);
      const resultadoLote = await procesarLote(lote, rol);
      reporteFinal.totalProcesados += lote.length;
      reporteFinal.totalCreados += resultadoLote.creados;
      reporteFinal.totalExistentes += resultadoLote.existentes;
      reporteFinal.totalErrores += resultadoLote.errores;
      reporteFinal.roles[rol].procesados += lote.length;
      reporteFinal.roles[rol].creados += resultadoLote.creados;
      reporteFinal.roles[rol].existentes += resultadoLote.existentes;
      reporteFinal.roles[rol].errores += resultadoLote.errores;
      reporteFinal.roles[rol].detalles.push(...resultadoLote.detalles);
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
  }
  return reporteFinal;
}

async function cambiarEstado(codigo, estado) {
  if (!codigo || !estado) throw new AppError("Código y estado son requeridos", 400);
  if (!["Activo", "Inactivo"].includes(estado)) throw new AppError("Estado inválido", 400);

  const [result] = await pool.query("UPDATE users SET estado = ? WHERE codigo = ?", [estado, codigo]);
  if (result.affectedRows === 0) throw new AppError("Usuario no encontrado", 404);
  return { codigo, nuevoEstado: estado };
}

async function listarUsers() {
  const [usuarios] = await pool.query("SELECT id_u, codigo, rol, estado FROM users");
  try {
    const { data: apiData } = await axios.get("http://localhost:3001/api/usuarios");
    const vistaUsuarios = Array.isArray(apiData?.data) ? apiData.data : [];
    const mapa = {};
    for (const vu of vistaUsuarios) mapa[vu.codigo] = vu;
    return usuarios.map((u) => ({
      ...u,
      nombre_completo: mapa[u.codigo]?.nombre_completo || "-",
      escuela: mapa[u.codigo]?.escuela || "-",
    }));
  } catch {
    return usuarios.map((u) => ({ ...u, nombre_completo: "-", escuela: "-" }));
  }
}

async function obtenerUsuario(id) {
  const [rows] = await pool.query("SELECT id_u, codigo, rol, estado FROM users WHERE id_u = ? LIMIT 1", [id]);
  const usuario = rows[0];
  if (!usuario) throw new AppError("Usuario no encontrado", 404);

  try {
    const { data: apiData } = await axios.get(`http://localhost:3001/api/usuario/${usuario.codigo}`);
    if (apiData?.success && apiData?.data) {
      const vu = apiData.data;
      return {
        ...usuario, nombre_completo: vu.nombre_completo || "-",
        nombres: vu.nombres || vu.nombre_completo || "-",
        apellido_p: vu.apellido_p || "", apellido_m: vu.apellido_m || "",
        email: vu.email || "-", escuela: vu.escuela || "-", dni: vu.dni || "-",
      };
    }
  } catch {}
  return { ...usuario, nombre_completo: "-", email: "-", escuela: "-", dni: "-" };
}

async function cambiarPassword(id, actualPassword, nuevaPassword) {
  const [rows] = await pool.query("SELECT password FROM users WHERE id_u = ? LIMIT 1", [id]);
  if (!rows[0]) throw new AppError("Usuario no encontrado", 404);
  const coincide = await bcrypt.compare(actualPassword, rows[0].password);
  if (!coincide) throw new AppError("La contraseña actual es incorrecta", 400);
  const nuevoHash = await bcrypt.hash(nuevaPassword, 10);
  const [result] = await pool.query("UPDATE users SET password = ? WHERE id_u = ?", [nuevoHash, id]);
  if (result.affectedRows === 0) throw new AppError("Error al actualizar", 500);
}

module.exports = { cargarUsuarios, cambiarEstado, listarUsers, obtenerUsuario, cambiarPassword };
