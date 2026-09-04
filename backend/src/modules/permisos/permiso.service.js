const axios = require("axios");
const pool = require("../../config/db");
const { AppError } = require("../../shared/middlewares/error.middleware");
const { uploadFile } = require("../../utils/storage");
const { enviarCorreo } = require("../../utils/email");

// =========================================
// Verificar día bloqueado
// =========================================
async function verificarDiaBloqueado() {
  const hoy = new Date().toISOString().split("T")[0];
  const [rows] = await pool.query("SELECT * FROM dias_bloqueados WHERE fecha = ? LIMIT 1", [hoy]);
  if (rows[0]) {
    return { permitido: false, mensaje: `Hoy no se permiten solicitudes: ${rows[0].motivo}` };
  }
  return { permitido: true };
}

// =========================================
// Verificar permisos de grupo desde API externa
// =========================================
async function verificarPermisoGrupoDesdeApi(id_u) {
  const [userRows] = await pool.query("SELECT codigo FROM users WHERE id_u = ? LIMIT 1", [id_u]);
  if (!userRows[0]) return { permitido: false, mensaje: "Usuario no encontrado" };

  try {
    const { data: usuarioRes } = await axios.get(`http://localhost:3001/api/usuario/${userRows[0].codigo}`);
    if (!usuarioRes.success || usuarioRes.data.rol !== "Alumno") {
      return { permitido: false, mensaje: "Solo los alumnos están sujetos a esta restricción" };
    }

    const { año_academico, escuela } = usuarioRes.data;
    if (!año_academico || !escuela) return { permitido: false, mensaje: "Faltan datos académicos del alumno" };

    const { data: vista } = await axios.get("http://localhost:3001/api/usuarios");
    const grupo = (vista.data || []).filter(
      (u) => u.rol === "Alumno" && u.año_academico === año_academico && u.escuela === escuela
    );
    if (grupo.length === 0) return { permitido: true };

    const codigosGrupo = grupo.map((u) => u.codigo);
    const [configRows] = await pool.query("SELECT * FROM configuracion_global WHERE id = 1 LIMIT 1");
    const config = configRows[0];
    const maxHoras = parseFloat(config?.max_horas_semana || "3");
    const restriccionHora = config?.restriccion_hoy || "09:00";

    const placeholders = codigosGrupo.map(() => "?").join(",");
    const [usersDelGrupo] = await pool.query(`SELECT id_u FROM users WHERE codigo IN (${placeholders})`, codigosGrupo);
    const userIdsGrupo = usersDelGrupo.map((u) => u.id_u);
    if (userIdsGrupo.length === 0) return { permitido: true };

    const userPlaceholders = userIdsGrupo.map(() => "?").join(",");

    // Verificar si ya hay permiso HOY del grupo
    const [hoyRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM permisos p
       WHERE p.id_u IN (${userPlaceholders})
         AND DATE(p.fecha_creacion) = CURDATE()
         AND p.tipo = 'Normal' AND p.estado = 'Aceptado'`,
      userIdsGrupo
    );

    if (Number(hoyRows[0].total) > 0) {
      return { permitido: false, mensaje: "Ya existe un permiso aceptado hoy de alguien de tu año y escuela" };
    }

    // Sumar horas semanales del grupo
    const [horasRows] = await pool.query(
      `SELECT COALESCE(SUM(p.duracion_t), 0) AS total FROM permisos p
       WHERE p.id_u IN (${userPlaceholders})
         AND WEEK(p.fecha_creacion, 1) = WEEK(CURDATE(), 1)
         AND YEAR(p.fecha_creacion) = YEAR(CURDATE())
         AND p.tipo = 'Normal' AND p.estado = 'Aceptado'`,
      userIdsGrupo
    );

    const totalHoras = Number(horasRows[0].total);
    if (totalHoras >= maxHoras) {
      return { permitido: false, mensaje: `Tu grupo ya ha alcanzado el límite semanal de ${maxHoras} horas permitidas` };
    }

    // Verificar si hubo permisos anteriores esta semana
    const [anterioresRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM permisos p
       WHERE p.id_u IN (${userPlaceholders})
         AND DATE(p.fecha_creacion) < CURDATE()
         AND WEEK(p.fecha_creacion, 1) = WEEK(CURDATE(), 1)
         AND YEAR(p.fecha_creacion) = YEAR(CURDATE())
         AND p.tipo = 'Normal' AND p.estado = 'Aceptado'`,
      userIdsGrupo
    );

    const yaHuboAntes = Number(anterioresRows[0].total) > 0;
    const horaActual = new Date().toTimeString().slice(0, 5);

    if (yaHuboAntes && horaActual < restriccionHora) {
      return { permitido: false, mensaje: `Tu grupo ya tuvo permisos esta semana. Solo puedes solicitar después de las ${restriccionHora}` };
    }

    return { permitido: true };
  } catch (error) {
    console.error("Error al verificar permisos del grupo:", error.message);
    return { permitido: false, mensaje: "Error interno al verificar permisos del grupo" };
  }
}

// =========================================
// Verificar conflictos de horario
// =========================================
async function checkConflicts(detalles) {
  const conflicts = [];
  for (const detalle of detalles) {
    const [losaRows] = await pool.query("SELECT * FROM losas WHERE id_l = ? LIMIT 1", [detalle.id_l]);
    const losa = losaRows[0];
    if (!losa) { conflicts.push({ detalle, error: "Losa no encontrada" }); continue; }
    if (losa.estado !== "Disponible") {
      conflicts.push({ detalle, error: `La losa "${losa.nombre}" no está disponible (estado: ${losa.estado})` });
      continue;
    }

    const [existing] = await pool.query(
      `SELECT dp.* FROM detalle_permisos dp
       INNER JOIN permisos p ON dp.id_p = p.id_p
       WHERE dp.id_l = ? AND dp.fecha = ?
         AND p.estado IN ('Pendiente', 'Aceptado')
         AND (dp.hora_inicio < ? AND dp.hora_fin > ?)
       LIMIT 1`,
      [detalle.id_l, detalle.fecha, detalle.hora_fin, detalle.hora_inicio]
    );

    if (existing.length > 0) conflicts.push({ detalle, conflictos: existing });
  }
  return conflicts;
}

// =========================================
// Obtener datos de usuario desde API externa
// =========================================
async function obtenerDatosUsuarioPorId(id_u) {
  const [rows] = await pool.query("SELECT codigo FROM users WHERE id_u = ? LIMIT 1", [id_u]);
  if (!rows[0]) return null;
  try {
    const { data: usuarioRes } = await axios.get(`http://localhost:3001/api/usuario/${rows[0].codigo}`);
    if (!usuarioRes.success || !usuarioRes.data) return null;
    return usuarioRes.data;
  } catch { return null; }
}

// =========================================
// Crear notificación
// =========================================
async function crearNotificacionDb({ mensaje, tipo, id_p }) {
  await pool.query("INSERT INTO notificacion (mensaje, tipo, id_p, leido) VALUES (?, ?, ?, FALSE)", [mensaje, tipo, id_p]);
}

// =========================================
// SERVICIOS EXPORTADOS
// =========================================

async function registrarPermiso({ tipo, id_u, duracion_t, detalles, file }) {
  const diaResult = await verificarDiaBloqueado();
  if (!diaResult.permitido) throw new AppError(diaResult.mensaje || "No se permite la solicitud el día de hoy", 400);

  if (!tipo || !id_u || !duracion_t || !detalles || detalles.length === 0) {
    throw new AppError("Faltan datos requeridos", 400);
  }

  let idArch = null;
  if (tipo === "Especial") {
    if (!file || !file.buffer) throw new AppError("El documento es obligatorio para permisos especiales", 400);
    if (file.mimetype !== "application/pdf") throw new AppError("Solo se permiten archivos PDF", 400);
    if (file.size > 10 * 1024 * 1024) throw new AppError("El archivo no debe superar 10 MB", 413);
    const uploadResult = await uploadFile(file);
    const [archResult] = await pool.query(
      "INSERT INTO archivos (nombre_original, nombre_unico, mimetype, url, tamanio) VALUES (?, ?, ?, ?, ?)",
      [file.originalname, uploadResult.key, file.mimetype, uploadResult.url, file.size || null]
    );
    idArch = archResult.insertId;
  }

  if (tipo === "Normal") {
    const restricciones = await verificarPermisoGrupoDesdeApi(id_u);
    if (!restricciones.permitido) throw new AppError(restricciones.mensaje || "No se permite registrar el permiso", 400);
    const conflicts = await checkConflicts(detalles);
    if (conflicts.length > 0) { const err = new AppError("Existen conflictos de horarios", 400); err.conflicts = conflicts; throw err; }
  }

  const estadoFinal = tipo === "Normal" ? "Aceptado" : "Pendiente";

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [permisoResult] = await conn.query(
      "INSERT INTO permisos (id_u, tipo, duracion_t, estado, id_arch) VALUES (?, ?, ?, ?, ?)",
      [id_u, tipo, duracion_t, estadoFinal, idArch]
    );
    const id_p = permisoResult.insertId;

    for (const detalle of detalles) {
      await conn.query(
        "INSERT INTO detalle_permisos (id_p, id_l, fecha, hora_inicio, hora_fin, duracion) VALUES (?, ?, ?, ?, ?, ?)",
        [id_p, detalle.id_l, detalle.fecha, detalle.hora_inicio, detalle.hora_fin, detalle.duracion]
      );
    }

    if (tipo === "Normal") {
      await conn.query("INSERT INTO notificacion (mensaje, tipo, id_p, leido) VALUES (?, ?, ?, FALSE)",
        [`Se creó un nuevo permiso de tipo ${tipo}`, estadoFinal, id_p]);
    }

    await conn.commit();

    // Enviar correo en segundo plano
    if (tipo === "Normal" || tipo === "Especial") {
      obtenerDatosUsuarioPorId(id_u).then(async (usuario) => {
        if (usuario?.email) {
          if (tipo === "Normal") {
            const detallesConLosa = await Promise.all(detalles.map(async (d, i) => {
              const [lRows] = await pool.query("SELECT * FROM losas WHERE id_l = ? LIMIT 1", [d.id_l]);
              const losa = lRows[0];
              return `<tr><td>${i+1}</td><td>${id_p}</td><td>${d.fecha}</td><td>${d.hora_inicio} - ${d.hora_fin}</td><td>${losa?.numero_l || "N/A"}</td><td>${losa?.ubicacion || "N/A"}</td></tr>`;
            }));
            const tabla = `<table border="1" cellpadding="5" cellspacing="0"><thead><tr><th>#</th><th>Id Permiso</th><th>Fecha</th><th>Horario</th><th>N° Losa</th><th>Ubicación</th></tr></thead><tbody>${detallesConLosa.join("")}</tbody></table>`;
            await enviarCorreo({ para: usuario.email, asunto: "Permiso registrado", texto: `Su permiso tipo ${tipo} fue ${estadoFinal}`, html: `<p>Hola <b>${usuario.nombre_completo}</b>,</p><p>Tu permiso de tipo <b>${tipo}</b> fue registrado exitosamente.</p>${tabla}` }).catch(() => {});
          } else {
            await enviarCorreo({ para: usuario.email, asunto: "Permiso especial registrado", texto: `Hola ${usuario.nombre_completo}, tu permiso especial fue registrado exitosamente.`, html: `<p>Hola <b>${usuario.nombre_completo}</b>,</p><p>Tu permiso de tipo <b>Especial</b> fue registrado exitosamente.</p>` }).catch(() => {});
          }
        }
      }).catch(() => {});
    }

    return { id_p, tipo, estado: estadoFinal, total_detalles: detalles.length };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function obtenerPermisos(estado) {
  let query = `SELECT p.id_p, p.fecha_creacion, a.url AS url_drive, p.tipo, p.duracion_t, p.estado, p.autor
               FROM permisos p LEFT JOIN archivos a ON p.id_arch = a.id_arch`;
  const params = [];
  if (estado) { query += " WHERE p.estado = ?"; params.push(estado); }
  query += " ORDER BY p.fecha_creacion DESC";
  const [rows] = await pool.query(query, params);
  return rows;
}

async function obtenerDetallesPermisoEspecifico(id_p, id_u) {
  if (!id_p) throw new AppError("Falta id del permiso", 400);
  const ownerFilter = id_u ? " AND p.id_u = ?" : "";
  const params = id_u ? [id_p, id_u] : [id_p];
  const [rows] = await pool.query(
    `SELECT p.id_p, p.tipo, p.estado, p.fecha_creacion, dp.id_l, dp.fecha, dp.hora_inicio, dp.hora_fin, dp.duracion, l.ubicacion, d.nombre AS disciplina
     FROM permisos p INNER JOIN detalle_permisos dp ON p.id_p = dp.id_p
     INNER JOIN losas l ON dp.id_l = l.id_l
     LEFT JOIN disciplinas d ON l.id_d = d.id_d
     WHERE p.id_p = ?${ownerFilter} ORDER BY dp.fecha ASC, dp.hora_inicio ASC`,
    params
  );
  if (rows.length === 0) throw new AppError("Permiso no encontrado", 404);
  return rows;
}

async function getAllPermisosDetalleBloqueados() {
  const [rows] = await pool.query(
    `SELECT dp.id_l, DATE_FORMAT(dp.fecha, '%Y-%m-%d') AS fecha, dp.hora_inicio, dp.hora_fin
     FROM detalle_permisos dp
     INNER JOIN permisos p ON p.id_p = dp.id_p
     WHERE p.estado IN ('Pendiente', 'Aceptado')
       AND dp.fecha >= CURDATE()
     ORDER BY dp.fecha ASC, dp.hora_inicio ASC`
  );
  return rows;
}

async function getAllPermisosDetalleAceptados() {
  const [rows] = await pool.query(
    `SELECT dp.id_l, dp.fecha, dp.hora_inicio, dp.hora_fin, p.estado, l.numero_l, d.nombre, a.url AS url_drive, p.id_p, p.tipo
     FROM detalle_permisos dp LEFT JOIN permisos p ON p.id_p = dp.id_p
     LEFT JOIN losas l ON dp.id_l = l.id_l
     LEFT JOIN disciplinas d ON d.id_d = l.id_d
     LEFT JOIN archivos a ON p.id_arch = a.id_arch
     WHERE p.estado = 'Aceptado' ORDER BY p.id_p DESC, dp.fecha ASC, dp.hora_inicio ASC`
  );
  return rows;
}

async function getAllPermisosAceptados() {
  const [rows] = await pool.query(
    `SELECT DISTINCT p.id_p, p.tipo, p.estado, a.url AS url_drive
     FROM permisos p JOIN detalle_permisos dp ON dp.id_p = p.id_p
     LEFT JOIN archivos a ON p.id_arch = a.id_arch
     WHERE p.estado = 'Aceptado'
       AND (dp.fecha > CURDATE() OR (dp.fecha = CURDATE() AND dp.hora_inicio > CURTIME()))
     ORDER BY p.id_p DESC`
  );
  return rows;
}

async function actualizarEstado(id_p, estado, id_t) {
  if (!estado || !id_t) throw new AppError("Estado o ID del trabajador aprobador faltante", 400);

  const estadosConDecision = ["Aceptado", "Rechazado", "Cancelado"];
  const fechaDecision = estadosConDecision.includes(estado) ? new Date() : null;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      "UPDATE permisos SET estado = ?, id_t = ?, fecha_decision = COALESCE(?, fecha_decision) WHERE id_p = ?",
      [estado, id_t, fechaDecision, id_p]
    );

    if (result.affectedRows > 0) {
      await conn.query("INSERT INTO notificacion (mensaje, tipo, id_p, leido) VALUES (?, ?, ?, FALSE)",
        [`El estado de tu permiso ha cambiado a: ${estado}`, estado, id_p]);

      // Enviar correo
      const [permisoRows] = await conn.query("SELECT * FROM permisos WHERE id_p = ? LIMIT 1", [id_p]);
      const permiso = permisoRows[0];
      if (permiso) {
        const detalles = await obtenerDetallesPermisoEspecifico(id_p);
        let destinatario = "", nombreCompleto = "";

        if (permiso.autor === "Administrador") {
          const [tRows] = await conn.query("SELECT * FROM trabajadores WHERE id_t = ? LIMIT 1", [permiso.id_t]);
          if (tRows[0]) { destinatario = tRows[0].email; nombreCompleto = `${tRows[0].nombres} ${tRows[0].apellido_p}`; }
        } else if (permiso.id_u) {
          const usuario = await obtenerDatosUsuarioPorId(permiso.id_u);
          if (usuario) { destinatario = usuario.email; nombreCompleto = usuario.nombre_completo; }
        }

        if (destinatario) {
          const filas = detalles.map((d, i) => `<tr><td>${i+1}</td><td>${d.id_p}</td><td>${d.fecha}</td><td>${d.hora_inicio} - ${d.hora_fin}</td><td>${d.ubicacion}</td><td>${d.disciplina || "N/A"}</td><td>${d.estado || "N/A"}</td></tr>`).join("");
          const tablaHtml = `<table border="1" cellpadding="5" cellspacing="0"><thead><tr><th>#</th><th>Id Permiso</th><th>Fecha</th><th>Horario</th><th>Losa</th><th>Disciplina</th><th>Estado</th></tr></thead><tbody>${filas}</tbody></table>`;
          enviarCorreo({ para: destinatario, asunto: "Estado de permiso actualizado", texto: `Tu permiso ${permiso.tipo} fue actualizado a: ${estado}.`, html: `<p>Estimado/a <b>${nombreCompleto}</b>,</p><p>Tu permiso tipo <b>${permiso.tipo}</b> fue actualizado a: <b>${estado}</b>.</p>${tablaHtml}` }).catch(() => {});
        }
      }
    }

    await conn.commit();
    return { success: result.affectedRows > 0, message: result.affectedRows > 0 ? "Permiso actualizado correctamente" : "Permiso no encontrado" };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function obtenerDocumento(id, id_u) {
  if (!id || isNaN(id)) throw new AppError("ID de permiso inválido", 400);
  const ownerFilter = id_u ? " AND p.id_u = ?" : "";
  const params = id_u ? [id, id_u] : [id];
  const [rows] = await pool.query(
    `SELECT a.url AS url_drive FROM permisos p LEFT JOIN archivos a ON p.id_arch = a.id_arch WHERE p.id_p = ?${ownerFilter} LIMIT 1`,
    params
  );
  if (!rows[0] || !rows[0].url_drive) throw new AppError("Permiso o documento no encontrado", 404);
  return rows[0].url_drive;
}

async function obtenerPermisosPorUsuario(id_u) {
  if (!id_u) throw new AppError("Falta id de usuario", 400);
  const [rows] = await pool.query(
    "SELECT id_p, tipo, duracion_t, estado, fecha_creacion FROM permisos WHERE id_u = ? ORDER BY fecha_creacion DESC",
    [id_u]
  );
  return rows;
}

async function createPermisoTrabajador({ id_t, tipo, duracion_t, detalles }) {
  if (!Array.isArray(detalles) || !id_t || !tipo || !duracion_t || detalles.length === 0) {
    throw new AppError("Faltan datos requeridos", 400);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const detalle of detalles) {
      const [conflict] = await conn.query(
        `SELECT 1 FROM detalle_permisos dp INNER JOIN permisos p ON dp.id_p = p.id_p
         WHERE p.estado IN ('Pendiente', 'Aceptado')
           AND dp.id_l = ? AND dp.fecha = ?
           AND (dp.hora_inicio < ? AND dp.hora_fin > ?) LIMIT 1`,
        [detalle.id_l, detalle.fecha, detalle.hora_fin, detalle.hora_inicio]
      );
      if (conflict.length > 0) throw new AppError("Conflictos detectados en horarios, verifique en permisos pendientes", 400);
    }

    const [result] = await conn.query(
      "INSERT INTO permisos (id_t, tipo, duracion_t, estado, autor) VALUES (?, ?, ?, 'Aceptado', 'Administrador')",
      [id_t, tipo, duracion_t]
    );
    const id_p = result.insertId;

    for (const detalle of detalles) {
      await conn.query(
        "INSERT INTO detalle_permisos (id_p, id_l, fecha, hora_inicio, hora_fin, duracion) VALUES (?, ?, ?, ?, ?, ?)",
        [id_p, detalle.id_l, detalle.fecha, detalle.hora_inicio, detalle.hora_fin, detalle.duracion]
      );
    }

    await conn.query("INSERT INTO notificacion (mensaje, tipo, id_p, leido) VALUES (?, 'Aceptado', ?, FALSE)",
      [`Permiso tipo ${tipo} registrado por trabajador`, id_p]);

    await conn.commit();

    // Enviar correo
    const [tRows] = await pool.query("SELECT * FROM trabajadores WHERE id_t = ? LIMIT 1", [id_t]);
    if (tRows[0]?.email) {
      const detallesPermiso = await obtenerDetallesPermisoEspecifico(id_p);
      const tablaHtml = detallesPermiso.map((d, i) => `<tr><td>${i+1}</td><td>${d.id_p || "N/A"}</td><td>${d.fecha}</td><td>${d.hora_inicio} - ${d.hora_fin}</td><td>${d.ubicacion || "N/A"}</td><td>${d.disciplina || "N/A"}</td><td>${d.estado || "N/A"}</td></tr>`).join("");
      enviarCorreo({ para: tRows[0].email, asunto: "Permiso registrado", texto: `Se ha registrado un permiso de tipo ${tipo}`, html: `<p>Estimado/a <b>${tRows[0].nombres} ${tRows[0].apellido_p}</b>,</p><table border="1" cellpadding="5" cellspacing="0">${tablaHtml}</table>` }).catch(() => {});
    }

    return { id_p, tipo, estado: "Aceptado", duracion_t, detalles };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

module.exports = { registrarPermiso, obtenerPermisos, obtenerDetallesPermisoEspecifico, getAllPermisosDetalleBloqueados, getAllPermisosDetalleAceptados, getAllPermisosAceptados, actualizarEstado, obtenerDocumento, obtenerPermisosPorUsuario, createPermisoTrabajador };
